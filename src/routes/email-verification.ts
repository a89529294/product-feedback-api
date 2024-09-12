import { isWithinExpirationDate } from "oslo";
import type { User } from "lucia";
import { lucia } from "../lib/auth.js";
import express from "express";
import { db } from "../lib/db.js";
import { emailVerificationCodes, users, rateLimit } from "../lib/schema.js";
import { and, eq } from "drizzle-orm";
import { rateLimitOnIp } from "../lib/middlewares.js";
import { generateEmailVerificationCode, sendEmail } from "../lib/utils.js";

export const emailVerificationRouter = express.Router();

emailVerificationRouter.post(
  "/email-verification",
  rateLimitOnIp,
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

emailVerificationRouter.post(
  "/resend-email-verification-code",
  rateLimitOnIp,
  async (req, res) => {
    const userId = res.locals.user?.id;
    const email = req.body.email;

    if (!userId) return res.status(400).json({ message: "Not logged in" });
    if (!email) return res.status(400).json({ message: "Email is empty" });

    try {
      const verificationCode = await generateEmailVerificationCode(
        userId,
        email
      );
      await sendEmail(email, {
        subject: "Email Verification Code",
        text: verificationCode,
      });
      res.json({ message: "Email sent" });
    } catch (e) {
      console.log(e);
      res
        .status(500)
        .json({ message: "Unable to send email, try again later" });
    }
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
