import { eq } from "drizzle-orm";
import { RequestHandler } from "express";
import { rateLimit } from "../lib/schema.js";
import { db } from "./db.js";

export const rateLimitOnIp: RequestHandler = async (req, res, next) => {
  const ip = req.ip;

  if (!ip)
    return res.status(400).json({
      message: "Unable to get ip",
    });

  const rateLimitEntries = await db
    .select()
    .from(rateLimit)
    .where(eq(rateLimit.ip, ip));

  const entry = rateLimitEntries[0];

  // no entry, i.e. no attempts
  if (!entry) {
    await db.insert(rateLimit).values({
      ip,
      attempts: 1,
      firstAttemptTime: new Date(),
    });
    return next();
  }

  // 1 hour, same duration as email verification code
  const firstAttemptPlusOneHour =
    entry.firstAttemptTime.getTime() + 60 * 60 * 1000;
  const lastAttemptIsWithInAnHourOfFirstAttempt =
    new Date().getTime() < firstAttemptPlusOneHour;

  // too many attempts within an hour
  if (lastAttemptIsWithInAnHourOfFirstAttempt) {
    if (entry.attempts >= 10)
      return res.status(401).json({
        message: `Too many attempts, try again at ${new Intl.DateTimeFormat(
          "en-US",
          {
            timeStyle: "long",
          }
        ).format(firstAttemptPlusOneHour)}`,
      });
    else {
      await db
        .update(rateLimit)
        .set({ attempts: entry.attempts + 1 })
        .where(eq(rateLimit.id, entry.id));
      return next();
    }
  }

  // last attempt is more than an hour away from first attempt
  if (!lastAttemptIsWithInAnHourOfFirstAttempt) {
    await db.delete(rateLimit).where(eq(rateLimit.id, entry.id));
    await db.insert(rateLimit).values({
      ip,
      attempts: 1,
      firstAttemptTime: new Date(),
    });
    return next();
  }
};
