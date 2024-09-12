var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { verify } from "@node-rs/argon2";
import express from "express";
import { lucia } from "../lib/auth.js";
import { db } from "../lib/db.js";
import { users } from "../lib/schema.js";
import { eq } from "drizzle-orm";
import { isValidEmail } from "../utils.js";
export const signinRouter = express.Router();
signinRouter.post("/signin", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const email = (_a = req.body.email) !== null && _a !== void 0 ? _a : null;
    const password = (_b = req.body.password) !== null && _b !== void 0 ? _b : null;
    if (!email || !isValidEmail(email)) {
        return res.status(401).json({ message: "Invalid email" });
    }
    if (!password || password.length < 6) {
        return res.status(401).json({ message: "Invalid password" });
    }
    const existingUsers = yield db
        .select()
        .from(users)
        .where(eq(users.email, email));
    const existingUser = existingUsers[0];
    if (!existingUser) {
        return res.status(401).json({ message: "Incorrect email or password}" });
    }
    const validPassword = yield verify(existingUser.hashedPassword, password, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
    });
    if (!validPassword) {
        // NOTE:
        // Returning immediately allows malicious actors to figure out valid usernames from response times,
        // allowing them to only focus on guessing passwords in brute-force attacks.
        // As a preventive measure, you may want to hash passwords even for invalid usernames.
        // However, valid usernames can be already be revealed with the signup page among other methods.
        // It will also be much more resource intensive.
        // Since protecting against this is non-trivial,
        // it is crucial your implementation is protected against brute-force attacks with login throttling, 2FA, etc.
        // If usernames are public, you can outright tell the user that the email is invalid.
        return res.status(401).json({
            message: "Incorrect email or password",
        });
    }
    const session = yield lucia.createSession(existingUser.id, {});
    res
        .appendHeader("Set-Cookie", lucia.createSessionCookie(session.id).serialize())
        .json({
        email: existingUser.email,
        emailVerified: existingUser.emailVerified,
    });
}));
