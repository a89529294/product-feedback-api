import express from "express";
import { db } from "../lib/db.js";
import { createPasswordResetToken, sendEmail } from "../lib/utils.js";
import { passwordResetTokens, users } from "../lib/schema.js";
import { eq } from "drizzle-orm";
import { isWithinExpirationDate } from "oslo";
import { hash } from "@node-rs/argon2";
import { sha256 } from "oslo/crypto";
import { encodeHex } from "oslo/encoding";
import { lucia } from "../lib/auth.js";

export const resetPasswordRouter = express.Router();

resetPasswordRouter.post("/reset-password", async (req, res) => {
  const email = req.body.email;

  if (!email) return res.status(400).end();

  try {
    const result = await db.select().from(users).where(eq(users.email, email));

    if (!result[0]) return res.status(400).json({ message: "Invalid email" });

    const user = result[0];

    const token = await createPasswordResetToken(user.id);

    await sendEmail(email, {
      subject: "reset password from Product Feedback",
      html: `<a href='http://localhost:5173/new-password/${token}'>Reset password</a>`,
    });
    res.json({ message: "Email sent" });
  } catch (e) {
    res.status(401).json({ message: "Cannot send email" });
  }
});

resetPasswordRouter.post(
  "/reset-password/:verificationToken",
  async (req, res) => {
    const verificationToken = req.params.verificationToken;
    const { password } = req.body;

    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).send({ message: "Invalid password" });
    }

    const tokenHash = encodeHex(
      await sha256(new TextEncoder().encode(verificationToken))
    );
    const tokens = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash));
    const token = tokens[0];
    if (token) {
      await db
        .delete(passwordResetTokens)
        .where(eq(passwordResetTokens.tokenHash, tokenHash));
    }

    if (!token || !isWithinExpirationDate(token.expiresAt)) {
      return res.status(400).json({ message: "Invalid token" });
    }

    await lucia.invalidateUserSessions(token.userId);
    const passwordHash = await hash(password, {
      // recommended minimum parameters
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    await db
      .update(users)
      .set({
        hashedPassword: passwordHash,
      })
      .where(eq(users.id, token.userId));

    const session = await lucia.createSession(token.userId, {});

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
