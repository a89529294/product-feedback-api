import { isWithinExpirationDate } from "oslo";
import type { User } from "lucia";
import { lucia } from "../lib/auth.js";
import express from "express";
import { db } from "../lib/db.js";
import { emailVerificationCodes, users } from "../lib/schema.js";
import { eq } from "drizzle-orm";

export const emailVerificationRouter = express.Router();

emailVerificationRouter.post("/email-verification", async (req, res) => {
  const user = res.locals.user;

  if (!user) {
    return res.status(401).end();
  }

  const verificationCode = req.body.verificationCode;

  if (typeof verificationCode !== "string") {
    return res.status(400).end();
  }

  const validCode = await verifyVerificationCode(user, verificationCode);
  if (!validCode) {
    return res.status(400).end();
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
});

async function verifyVerificationCode(
  user: User,
  code: string
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const databaseCode = await tx
      .select()
      .from(emailVerificationCodes)
      .where(eq(emailVerificationCodes.userId, user.id));

    if (!databaseCode[0] || databaseCode[0].code !== code) {
      return false;
    }

    await db
      .delete(emailVerificationCodes)
      .where(eq(emailVerificationCodes.userId, user.id));

    if (!isWithinExpirationDate(databaseCode[0].expiresAt)) {
      return false;
    }
    if (databaseCode[0].email !== user.email) {
      return false;
    }
    return true;
  });
}
