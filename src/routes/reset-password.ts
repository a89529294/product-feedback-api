import express from "express";
import { db } from "../lib/db.js";
import { sendEmail } from "../lib/utils.js";

export const resetPasswordRouter = express.Router();

resetPasswordRouter.post("/reset-password", async (req, res) => {
  const email = req.body.email;
  const token = "1234";

  if (!email) return res.status(400).end();
  try {
    await sendEmail(email, {
      subject: "reset password from Product Feedback",
      html: `<a href='http://localhost:3000/reset-password/${token}'>Reset password</a>`,
    });
    res.json({ message: "Email sent" });
  } catch (e) {
    res.status(401).json({ message: "Cannot send email" });
  }
});

resetPasswordRouter.get("/reset-password/:token", async (req, res) => {
  console.log(req.params.token);
  res.json({ hi: "hi" });
});
