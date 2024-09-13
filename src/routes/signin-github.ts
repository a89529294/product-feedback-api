import express from "express";
import { OAuth2RequestError, generateState } from "arctic";
import { github, lucia } from "../lib/auth.js";
import { parseCookies, serializeCookie } from "oslo/cookie";
import { db } from "../lib/db.js";
import { DatabaseUser, users } from "../lib/schema.js";
import { eq } from "drizzle-orm";
import { generateIdFromEntropySize } from "lucia";

export const githubLoginRouter = express.Router();

githubLoginRouter.get("/login/github", async (_, res) => {
  const state = generateState();
  const url = await github.createAuthorizationURL(state);

  res
    .appendHeader(
      "Set-Cookie",
      serializeCookie("github_oauth_state", state, {
        path: "/",
        httpOnly: true,
        maxAge: 60 * 10, // 10 minutes
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        // secure: true,
        // sameSite: "none",
      })
    )
    .redirect(url.toString());
});

githubLoginRouter.get("/login/github/callback", async (req, res) => {
  const code = req.query.code?.toString() ?? null;
  const state = req.query.state?.toString() ?? null;
  const storedState =
    parseCookies(req.headers.cookie ?? "").get("github_oauth_state") ?? null;

  if (!code || !state || !storedState || state !== storedState) {
    console.log(code, state, storedState);
    res.status(400).end();
    return;
  }

  try {
    const tokens = await github.validateAuthorizationCode(code);
    const githubUserResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });
    const githubUser: GitHubUser = await githubUserResponse.json();
    console.log("githubUser: ", githubUser);

    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.githubId, githubUser.id));

    const existingUser = existingUsers[0];

    if (existingUser) {
      const session = await lucia.createSession(existingUser.id, {});
      return res
        .appendHeader(
          "Set-Cookie",
          lucia.createSessionCookie(session.id).serialize()
        )
        .redirect("http://localhost:5173/");
    }

    const userId = generateIdFromEntropySize(10);

    await db.insert(users).values({
      id: userId,
      username: githubUser.login,
      githubId: githubUser.id,
    });

    const session = await lucia.createSession(userId, {});
    return res
      .appendHeader(
        "Set-Cookie",
        lucia.createSessionCookie(session.id).serialize()
      )
      .redirect("http://localhost:5173/");
  } catch (e) {
    if (
      e instanceof OAuth2RequestError &&
      e.message === "bad_verification_code"
    ) {
      // invalid code
      res.status(400).end();
      return;
    }
    console.log(e);
    res.status(500).end();
    return;
  }
});

interface GitHubUser {
  id: number;
  login: string; //username
}
