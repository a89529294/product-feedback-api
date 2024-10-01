var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { OAuth2RequestError, generateState, generateCodeVerifier, } from "arctic";
import { and, eq } from "drizzle-orm";
import express from "express";
import { generateIdFromEntropySize } from "lucia";
import { parseCookies, serializeCookie } from "oslo/cookie";
import { google, lucia } from "../lib/auth.js";
import { db } from "../lib/db.js";
import { oauthAccounts, users } from "../lib/schema.js";
export const googleLoginRouter = express.Router();
googleLoginRouter.get("/login/google", (_, res) => __awaiter(void 0, void 0, void 0, function* () {
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const url = yield google.createAuthorizationURL(state, codeVerifier, {
        scopes: [
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
        ],
    });
    res
        .appendHeader("Set-Cookie", serializeCookie("google_oauth_state", state, {
        path: "/",
        httpOnly: true,
        maxAge: 60 * 10, // 10 minutes
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
    }))
        .appendHeader("Set-Cookie", serializeCookie("google_oauth_code_verifier", codeVerifier, {
        path: "/",
        httpOnly: true,
        maxAge: 60 * 10, // 10 minutes
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
    }))
        .redirect(url.toString());
}));
googleLoginRouter.get("/login/google/callback", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const code = (_b = (_a = req.query.code) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : null;
    const state = (_d = (_c = req.query.state) === null || _c === void 0 ? void 0 : _c.toString()) !== null && _d !== void 0 ? _d : null;
    const storedState = (_f = parseCookies((_e = req.headers.cookie) !== null && _e !== void 0 ? _e : "").get("google_oauth_state")) !== null && _f !== void 0 ? _f : null;
    const storedCodeVerifier = (_h = parseCookies((_g = req.headers.cookie) !== null && _g !== void 0 ? _g : "").get("google_oauth_code_verifier")) !== null && _h !== void 0 ? _h : null;
    if (!code ||
        !state ||
        !storedState ||
        !storedCodeVerifier ||
        state !== storedState) {
        console.log(code, state, storedState);
        res.status(400).end();
        return;
    }
    try {
        const tokens = yield google.validateAuthorizationCode(code, storedCodeVerifier);
        const googleUserResponse = yield fetch("https://openidconnect.googleapis.com/v1/userinfo", {
            headers: {
                Authorization: `Bearer ${tokens.accessToken}`,
            },
        });
        const googleUser = yield googleUserResponse.json();
        console.log(googleUser);
        const existingUsers = yield db
            .select()
            .from(oauthAccounts)
            .where(and(eq(oauthAccounts.providerName, "google"), eq(oauthAccounts.providerUserId, googleUser.sub)));
        const existingUser = existingUsers[0];
        if (existingUser) {
            const session = yield lucia.createSession(existingUser.userId, {});
            return res
                .appendHeader("Set-Cookie", lucia.createSessionCookie(session.id).serialize())
                .redirect("http://localhost:5173/");
        }
        const userId = generateIdFromEntropySize(10);
        yield db.insert(users).values({
            id: userId,
            username: googleUser.name,
            oauthProviderName: "google",
        });
        yield db.insert(oauthAccounts).values({
            providerName: "google",
            providerUserId: googleUser.sub,
            userId: userId,
        });
        const session = yield lucia.createSession(userId, {});
        return res
            .appendHeader("Set-Cookie", lucia.createSessionCookie(session.id).serialize())
            .redirect("http://localhost:5173/");
    }
    catch (e) {
        if (e instanceof OAuth2RequestError &&
            e.message === "bad_verification_code") {
            // invalid code
            res.status(400).end();
            return;
        }
        console.log(e);
        res.status(500).end();
        return;
    }
}));
