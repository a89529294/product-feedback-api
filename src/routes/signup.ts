import express from "express";
import { db } from "../lib/db.js";
import { hash } from "@node-rs/argon2";
import { lucia } from "../lib/auth.js";
import { generateId } from "lucia";
import { userTable } from "../lib/schema.js";

export const signupRouter = express.Router();

signupRouter.post("/signup", async (req, res) => {
  console.log(req.body);
  const username: string | null = req.body.username ?? null;
  if (
    !username ||
    username.length < 3 ||
    username.length > 31 ||
    !/^[a-z0-9_-]+$/.test(username)
  ) {
    return res.status(400).json({
      error: "Invalid username",
    });
  }
  const password: string | null = req.body.password ?? null;
  if (!password || password.length < 6 || password.length > 255) {
    return res.status(400).json({
      error: "Invalid password",
    });
  }

  const hashedPassword = await hash(password, {
    // recommended minimum parameters
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });
  const userId = generateId(15);

  try {
    await db.insert(userTable).values({
      id: userId,
      username: username,
      hashedPassword,
    });

    const session = await lucia.createSession(userId, {});
    return res
      .appendHeader(
        "Set-Cookie",
        lucia.createSessionCookie(session.id).serialize()
      )
      .json({
        success: true,
      });
  } catch (e) {
    console.log(e);
    return res.status(500).json({
      error: "An unknown error occurred",
    });
  }
});
