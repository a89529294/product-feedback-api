var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import express from "express";
import { OAuth2RequestError, generateState } from "arctic";
import { github, lucia } from "../lib/auth.js";
import { parseCookies, serializeCookie } from "oslo/cookie";
import { db } from "../lib/db.js";
import { users } from "../lib/schema.js";
import { eq } from "drizzle-orm";
import { generateIdFromEntropySize } from "lucia";
export const githubLoginRouter = express.Router();
githubLoginRouter.get("/login/github", (_, res) => __awaiter(void 0, void 0, void 0, function* () {
    const state = generateState();
    const url = yield github.createAuthorizationURL(state);
    res
        .appendHeader("Set-Cookie", serializeCookie("github_oauth_state", state, {
        path: "/",
        httpOnly: true,
        maxAge: 60 * 10, // 10 minutes
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        // secure: true,
        // sameSite: "none",
    }))
        .redirect(url.toString());
}));
githubLoginRouter.get("/login/github/callback", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    const code = (_b = (_a = req.query.code) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : null;
    const state = (_d = (_c = req.query.state) === null || _c === void 0 ? void 0 : _c.toString()) !== null && _d !== void 0 ? _d : null;
    const storedState = (_f = parseCookies((_e = req.headers.cookie) !== null && _e !== void 0 ? _e : "").get("github_oauth_state")) !== null && _f !== void 0 ? _f : null;
    if (!code || !state || !storedState || state !== storedState) {
        console.log(code, state, storedState);
        res.status(400).end();
        return;
    }
    try {
        const tokens = yield github.validateAuthorizationCode(code);
        const githubUserResponse = yield fetch("https://api.github.com/user", {
            headers: {
                Authorization: `Bearer ${tokens.accessToken}`,
            },
        });
        const githubUser = yield githubUserResponse.json();
        console.log("githubUser: ", githubUser);
        const existingUsers = yield db
            .select()
            .from(users)
            .where(eq(users.githubId, githubUser.id));
        const existingUser = existingUsers[0];
        if (existingUser) {
            const session = yield lucia.createSession(existingUser.id, {});
            return res
                .appendHeader("Set-Cookie", lucia.createSessionCookie(session.id).serialize())
                .redirect("http://localhost:5173");
        }
        const userId = generateIdFromEntropySize(10);
        yield db.insert(users).values({
            id: userId,
            username: githubUser.login,
            githubId: githubUser.id,
        });
        const session = yield lucia.createSession(userId, {});
        return res
            .appendHeader("Set-Cookie", lucia.createSessionCookie(session.id).serialize())
            .redirect("http://localhost:5173");
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
