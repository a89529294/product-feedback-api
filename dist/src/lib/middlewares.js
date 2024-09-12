var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { eq } from "drizzle-orm";
import { rateLimit } from "../lib/schema.js";
import { db } from "./db.js";
export const rateLimitOnIp = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const ip = req.ip;
    if (!ip)
        return res.status(400).json({
            message: "Unable to get ip",
        });
    const rateLimitEntries = yield db
        .select()
        .from(rateLimit)
        .where(eq(rateLimit.ip, ip));
    const entry = rateLimitEntries[0];
    // no entry, i.e. no attempts
    if (!entry) {
        yield db.insert(rateLimit).values({
            ip,
            attempts: 1,
            firstAttemptTime: new Date(),
        });
        return next();
    }
    // 1 hour, same duration as email verification code
    const firstAttemptPlusOneHour = entry.firstAttemptTime.getTime() + 60 * 60 * 1000;
    const lastAttemptIsWithInAnHourOfFirstAttempt = new Date().getTime() < firstAttemptPlusOneHour;
    // too many attempts within an hour
    if (lastAttemptIsWithInAnHourOfFirstAttempt) {
        if (entry.attempts >= 10)
            return res.status(401).json({
                message: `Too many attempts, try again at ${new Intl.DateTimeFormat("en-US", {
                    timeStyle: "long",
                }).format(firstAttemptPlusOneHour)}`,
            });
        else {
            yield db
                .update(rateLimit)
                .set({ attempts: entry.attempts + 1 })
                .where(eq(rateLimit.id, entry.id));
            return next();
        }
    }
    // last attempt is more than an hour away from first attempt
    if (!lastAttemptIsWithInAnHourOfFirstAttempt) {
        yield db.delete(rateLimit).where(eq(rateLimit.id, entry.id));
        yield db.insert(rateLimit).values({
            ip,
            attempts: 1,
            firstAttemptTime: new Date(),
        });
        return next();
    }
});
