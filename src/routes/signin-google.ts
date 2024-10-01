import {
  OAuth2RequestError,
  generateState,
  generateCodeVerifier,
} from "arctic";
import { and, eq } from "drizzle-orm";
import express from "express";
import { generateIdFromEntropySize } from "lucia";
import { parseCookies, serializeCookie } from "oslo/cookie";
import { google, lucia } from "../lib/auth.js";
import { db } from "../lib/db.js";
import { oauthAccounts, users } from "../lib/schema.js";

export const googleLoginRouter = express.Router();

googleLoginRouter.get("/login/google", async (_, res) => {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = await google.createAuthorizationURL(state, codeVerifier, {
    scopes: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
  });

  res
    .appendHeader(
      "Set-Cookie",
      serializeCookie("google_oauth_state", state, {
        path: "/",
        httpOnly: true,
        maxAge: 60 * 10, // 10 minutes
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      })
    )
    .appendHeader(
      "Set-Cookie",
      serializeCookie("google_oauth_code_verifier", codeVerifier, {
        path: "/",
        httpOnly: true,
        maxAge: 60 * 10, // 10 minutes
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      })
    )
    .redirect(url.toString());
});

googleLoginRouter.get("/login/google/callback", async (req, res) => {
  const code = req.query.code?.toString() ?? null;
  const state = req.query.state?.toString() ?? null;
  const storedState =
    parseCookies(req.headers.cookie ?? "").get("google_oauth_state") ?? null;
  const storedCodeVerifier =
    parseCookies(req.headers.cookie ?? "").get("google_oauth_code_verifier") ??
    null;

  if (
    !code ||
    !state ||
    !storedState ||
    !storedCodeVerifier ||
    state !== storedState
  ) {
    console.log(code, state, storedState);
    res.status(400).end();
    return;
  }

  try {
    const tokens = await google.validateAuthorizationCode(
      code,
      storedCodeVerifier
    );
    const googleUserResponse = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      }
    );
    const googleUser: GoogleUser = await googleUserResponse.json();

    console.log(googleUser);

    const existingUsers = await db
      .select()
      .from(oauthAccounts)
      .where(
        and(
          eq(oauthAccounts.providerName, "google"),
          eq(oauthAccounts.providerUserId, googleUser.sub)
        )
      );

    const existingUser = existingUsers[0];

    if (existingUser) {
      const session = await lucia.createSession(existingUser.userId, {});
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
      username: googleUser.name,
      oauthProviderName: "google",
    });

    await db.insert(oauthAccounts).values({
      providerName: "google",
      providerUserId: googleUser.sub,
      userId: userId,
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

type GoogleUser = {
  sub: string;
  name: string;
};
