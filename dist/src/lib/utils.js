var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { TimeSpan, createDate } from "oslo";
import { sha256 } from "oslo/crypto";
import { encodeHex } from "oslo/encoding";
import { generateRandomString, alphabet } from "oslo/crypto";
import { db } from "./db.js";
import { emailVerificationCodes, passwordResetTokens } from "./schema.js";
import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";
import { generateIdFromEntropySize } from "lucia";
export function generateEmailVerificationCode(userId, email) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db
            .delete(emailVerificationCodes)
            .where(eq(emailVerificationCodes.userId, userId));
        const code = generateRandomString(8, alphabet("0-9"));
        yield db.insert(emailVerificationCodes).values({
            userId: userId,
            email,
            code,
            expiresAt: createDate(new TimeSpan(60, "m")), // 60 minutes
        });
        return code;
    });
}
export function sendEmail(email, mailOptions) {
    return __awaiter(this, void 0, void 0, function* () {
        const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false, // true for port 465, false for other ports
            auth: {
                user: "a89529294@gmail.com",
                pass: "rtpn aawb tejb gbrq",
            },
        });
        function main() {
            return __awaiter(this, void 0, void 0, function* () {
                // send mail with defined transport object
                const info = yield transporter.sendMail(Object.assign({ from: "Product Feedback <a89529294@gmail.com>", to: email }, mailOptions));
                console.log("Message sent: %s", info.messageId);
            });
        }
        yield main();
    });
}
export function createPasswordResetToken(userId) {
    return __awaiter(this, void 0, void 0, function* () {
        // optionally invalidate all existing tokens
        yield db
            .delete(passwordResetTokens)
            .where(eq(passwordResetTokens.userId, userId));
        const tokenId = generateIdFromEntropySize(25); // 40 character
        const tokenHash = encodeHex(yield sha256(new TextEncoder().encode(tokenId)));
        yield db.insert(passwordResetTokens).values({
            tokenHash: tokenHash,
            userId: userId,
            expiresAt: createDate(new TimeSpan(1, "h")),
        });
        return tokenId;
    });
}
