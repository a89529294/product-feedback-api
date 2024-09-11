import { isWithinExpirationDate } from "oslo";
import type { User } from "lucia";
import { lucia } from "../lib/auth.js";
import express from "express";
import { db } from "../lib/db.js";
import { emailVerificationCodes, users, rateLimit } from "../lib/schema.js";
import { and, eq } from "drizzle-orm";

export const emailVerificationRouter = express.Router();

emailVerificationRouter.post(
  "/email-verification",
  async (req, res, next) => {
    const user = res.locals.user;

    if (!user) return res.sendStatus(401);

    const rateLimitEntries = await db
      .select()
      .from(rateLimit)
      .where(and(eq(rateLimit.userId, user.id), eq(rateLimit.path, req.path)));

    const entry = rateLimitEntries[0];

    // no entry, i.e. no attempts
    if (!entry) {
      await db.insert(rateLimit).values({
        userId: user.id,
        path: req.path,
        attempts: 1,
        firstAttemptTime: new Date(),
      });
      return next();
    }

    // 1 hour, same duration as email verification code
    const firstAttemptPlusOneHour =
      entry.firstAttemptTime.getTime() + 60 * 60 * 1000;
    const lastAttemptIsWithInAnHourOfFirstAttempt =
      new Date().getTime() < firstAttemptPlusOneHour;

    // too many attempts within an hour
    if (lastAttemptIsWithInAnHourOfFirstAttempt) {
      if (entry.attempts >= 10)
        return res.status(401).json({
          message: `Too many attempts, try again at ${new Intl.DateTimeFormat(
            "en-US",
            {
              timeStyle: "long",
            }
          ).format(firstAttemptPlusOneHour)}`,
        });
      else {
        await db
          .update(rateLimit)
          .set({ attempts: entry.attempts + 1 })
          .where(eq(rateLimit.id, entry.id));
        return next();
      }
    }

    // last attempt is more than an hour away from first attempt
    if (!lastAttemptIsWithInAnHourOfFirstAttempt) {
      await db.delete(rateLimit).where(eq(rateLimit.id, entry.id));
      await db.insert(rateLimit).values({
        userId: user.id,
        path: req.path,
        attempts: 1,
        firstAttemptTime: new Date(),
      });
      return next();
    }
  },
  async (req, res) => {
    const user = res.locals.user;

    if (!user) {
      return res.status(401).end();
    }

    const verificationCode = req.body.verificationCode;

    if (typeof verificationCode !== "string") {
      return res.status(400).end();
    }

    const validCode = await verifyVerificationCode(user, verificationCode);
    if (!validCode.success) {
      return res.status(400).json({
        message: validCode.reason,
      });
    }

    await lucia.invalidateUserSessions(user.id);
    await db
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, user.id));

    const session = await lucia.createSession(user.id, {});
    return res
      .appendHeader(
        "Set-Cookie",
        lucia.createSessionCookie(session.id).serialize()
      )
      .json({
        message: "success",
      });
  }
);

async function verifyVerificationCode(
  user: User,
  code: string
): Promise<{ success: boolean; reason: string }> {
  return db.transaction(async (tx) => {
    const databaseCode = await tx
      .select()
      .from(emailVerificationCodes)
      .where(eq(emailVerificationCodes.userId, user.id));

    if (!databaseCode[0] || databaseCode[0].code !== code) {
      return { success: false, reason: "Wrong code" };
    }

    await db
      .delete(emailVerificationCodes)
      .where(eq(emailVerificationCodes.userId, user.id));

    if (!isWithinExpirationDate(databaseCode[0].expiresAt)) {
      return { success: false, reason: "Code expired" };
    }
    if (databaseCode[0].email !== user.email) {
      return {
        success: false,
        reason: "Wrong email",
      };
    }
    return {
      success: true,
      reason: "",
    };
  });
}
