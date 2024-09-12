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
resetPasswordRouter.post("/reset-password", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const email = req.body.email;
    if (!email)
        return res.status(400).end();
    try {
        const result = yield db.select().from(users).where(eq(users.email, email));
        if (!result[0])
            return res.status(400).json({ message: "Invalid email" });
        const user = result[0];
        const token = yield createPasswordResetToken(user.id);
        yield sendEmail(email, {
            subject: "reset password from Product Feedback",
            html: `<a href='http://localhost:5173/new-password/${token}'>Reset password</a>`,
        });
        res.json({ message: "Email sent" });
    }
    catch (e) {
        res.status(401).json({ message: "Cannot send email" });
    }
}));
resetPasswordRouter.post("/reset-password/:verificationToken", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const verificationToken = req.params.verificationToken;
    const { password } = req.body;
    if (typeof password !== "string" || password.length < 8) {
        return res.status(400).send({ message: "Invalid password" });
    }
    const tokenHash = encodeHex(yield sha256(new TextEncoder().encode(verificationToken)));
    const tokens = yield db
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.tokenHash, tokenHash));
    const token = tokens[0];
    if (token) {
        yield db
            .delete(passwordResetTokens)
            .where(eq(passwordResetTokens.tokenHash, tokenHash));
    }
    if (!token || !isWithinExpirationDate(token.expiresAt)) {
        return res.status(400).json({ message: "Invalid token" });
    }
    yield lucia.invalidateUserSessions(token.userId);
    const passwordHash = yield hash(password, {
        // recommended minimum parameters
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
    });
    yield db
        .update(users)
        .set({
        hashedPassword: passwordHash,
    })
        .where(eq(users.id, token.userId));
    const session = yield lucia.createSession(token.userId, {});
    return res
        .appendHeader("Set-Cookie", lucia.createSessionCookie(session.id).serialize())
        .json({
        message: "success",
    });
}));
