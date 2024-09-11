import { TimeSpan, createDate } from "oslo";
import { generateRandomString, alphabet } from "oslo/crypto";
import { db } from "./db.js";
import { emailVerificationCodes } from "./schema.js";
import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer/index.js";

export async function generateEmailVerificationCode(
  userId: string,
  email: string
): Promise<string> {
  await db
    .delete(emailVerificationCodes)
    .where(eq(emailVerificationCodes.userId, userId));
  const code = generateRandomString(8, alphabet("0-9"));
  await db.insert(emailVerificationCodes).values({
    userId: userId,
    email,
    code,
    expiresAt: createDate(new TimeSpan(60, "m")), // 60 minutes
  });
  return code;
}

export async function sendEmail(email: string, mailOptions: Mail.Options) {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true for port 465, false for other ports
    auth: {
      user: "a89529294@gmail.com",
      pass: "rtpn aawb tejb gbrq",
    },
  });

  async function main() {
    // send mail with defined transport object
    const info = await transporter.sendMail({
      from: "Product Feedback <a89529294@gmail.com>", // sender address
      to: email,
      ...mailOptions,
    });

    console.log("Message sent: %s", info.messageId);
  }

  await main();
}
