import { hash } from "@node-rs/argon2";
import express from "express";
import { generateIdFromEntropySize } from "lucia";
import { lucia } from "../lib/auth.js";
import { db } from "../lib/db.js";
import { users } from "../lib/schema.js";
import { isValidEmail } from "../utils.js";
import { generateEmailVerificationCode, sendEmail } from "../lib/utils.js";

export const signupRouter = express.Router();

signupRouter.post("/signup", async (req, res) => {
  const email = req.body.email ?? null;
  const password = req.body.password ?? null;

  if (!email || !isValidEmail(email)) {
    return res.status(401).json({ message: "Invalid email" });
  }

  if (!password || password.length < 6) {
    return res.status(401).json({ message: "Invalid password" });
  }

  const hashedPassword = await hash(password, {
    // recommended minimum parameters
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });
  const userId = generateIdFromEntropySize(10); // 16 characters long

  try {
    await db.insert(users).values({
      id: userId,
      email,
      hashedPassword,
      emailVerified: false,
    });

    const verificationCode = await generateEmailVerificationCode(userId, email);
    await sendEmail(email, {
      subject: "Email Verification Code",
      text: verificationCode,
    });

    const session = await lucia.createSession(userId, {});
    res
      .appendHeader(
        "Set-Cookie",
        lucia.createSessionCookie(session.id).serialize()
      )
      .json({
        message: "success",
      });
  } catch {
    // db error, email taken, etc
    return res.status(401).json({ message: "Email in use." });
  }
});
