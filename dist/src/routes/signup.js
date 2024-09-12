var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { hash } from "@node-rs/argon2";
import express from "express";
import { generateIdFromEntropySize } from "lucia";
import { lucia } from "../lib/auth.js";
import { db } from "../lib/db.js";
import { users } from "../lib/schema.js";
import { isValidEmail } from "../utils.js";
import { generateEmailVerificationCode, sendEmail } from "../lib/utils.js";
import { rateLimitOnIp } from "../lib/middlewares.js";
export const signupRouter = express.Router();
signupRouter.post("/signup", rateLimitOnIp, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const email = (_a = req.body.email) !== null && _a !== void 0 ? _a : null;
    const password = (_b = req.body.password) !== null && _b !== void 0 ? _b : null;
    if (!email || !isValidEmail(email)) {
        return res.status(401).json({ message: "Invalid email" });
    }
    if (!password || password.length < 6) {
        return res.status(401).json({ message: "Invalid password" });
    }
    const hashedPassword = yield hash(password, {
        // recommended minimum parameters
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
    });
    const userId = generateIdFromEntropySize(10); // 16 characters long
    try {
        yield db.insert(users).values({
            id: userId,
            email,
            hashedPassword,
            emailVerified: false,
        });
        const verificationCode = yield generateEmailVerificationCode(userId, email);
        yield sendEmail(email, {
            subject: "Email Verification Code",
            text: verificationCode,
        });
        const session = yield lucia.createSession(userId, {});
        res
            .appendHeader("Set-Cookie", lucia.createSessionCookie(session.id).serialize())
            .json({
            message: "success",
        });
    }
    catch (_c) {
        // db error, email taken, etc
        return res.status(401).json({ message: "Email in use." });
    }
}));
