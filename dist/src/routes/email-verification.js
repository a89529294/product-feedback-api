var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { isWithinExpirationDate } from "oslo";
import { lucia } from "../lib/auth.js";
import express from "express";
import { db } from "../lib/db.js";
import { emailVerificationCodes, users } from "../lib/schema.js";
import { eq } from "drizzle-orm";
import { rateLimitOnIp } from "../lib/middlewares.js";
import { generateEmailVerificationCode, sendEmail } from "../lib/utils.js";
export const emailVerificationRouter = express.Router();
emailVerificationRouter.post("/email-verification", rateLimitOnIp, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = res.locals.user;
    if (!user) {
        return res.status(401).end();
    }
    const verificationCode = req.body.verificationCode;
    if (typeof verificationCode !== "string") {
        return res.status(400).end();
    }
    const validCode = yield verifyVerificationCode(user, verificationCode);
    if (!validCode.success) {
        return res.status(400).json({
            message: validCode.reason,
        });
    }
    yield lucia.invalidateUserSessions(user.id);
    yield db
        .update(users)
        .set({ emailVerified: true })
        .where(eq(users.id, user.id));
    const session = yield lucia.createSession(user.id, {});
    return res
        .appendHeader("Set-Cookie", lucia.createSessionCookie(session.id).serialize())
        .json({
        message: "success",
    });
}));
emailVerificationRouter.post("/resend-email-verification-code", rateLimitOnIp, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = res.locals.user) === null || _a === void 0 ? void 0 : _a.id;
    const email = req.body.email;
    if (!userId)
        return res.status(400).json({ message: "Not logged in" });
    if (!email)
        return res.status(400).json({ message: "Email is empty" });
    try {
        const verificationCode = yield generateEmailVerificationCode(userId, email);
        yield sendEmail(email, {
            subject: "Email Verification Code",
            text: verificationCode,
        });
        res.json({ message: "Email sent" });
    }
    catch (e) {
        console.log(e);
        res
            .status(500)
            .json({ message: "Unable to send email, try again later" });
    }
}));
function verifyVerificationCode(user, code) {
    return __awaiter(this, void 0, void 0, function* () {
        return db.transaction((tx) => __awaiter(this, void 0, void 0, function* () {
            const databaseCode = yield tx
                .select()
                .from(emailVerificationCodes)
                .where(eq(emailVerificationCodes.userId, user.id));
            if (!databaseCode[0] || databaseCode[0].code !== code) {
                return { success: false, reason: "Wrong code" };
            }
            yield db
                .delete(emailVerificationCodes)
                .where(eq(emailVerificationCodes.userId, user.id));
            if (!isWithinExpirationDate(databaseCode[0].expiresAt)) {
                return { success: false, reason: "Code expired" };
            }
            if (databaseCode[0].email !== user.email) {
                return {
                    success: false,
                    reason: "Wrong email",
                };
            }
            return {
                success: true,
                reason: "",
            };
        }));
    });
}
