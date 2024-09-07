import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { verifyRequestOrigin } from "lucia";
import { lucia } from "./lib/auth.js";
import { signupRouter } from "./routes/signup.js";
import { signinRouter } from "./routes/signin.js";
import { signoutRouter } from "./routes/signout.js";
import { emailVerificationRouter } from "./routes/email-verification.js";

dotenv.config();
const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  if (req.method === "GET") {
    return next();
  }
  const originHeader = req.headers.origin ?? null;
  const hostHeader = req.headers.host ?? null;

  if (
    !originHeader ||
    !hostHeader ||
    !verifyRequestOrigin(originHeader, [hostHeader, "localhost:5173"])
  ) {
    return res.status(403).end();
  }
  return next();
});

app.use(async (req, res, next) => {
  const sessionId = lucia.readSessionCookie(req.headers.cookie ?? "");

  if (!sessionId) {
    res.locals.user = null;
    res.locals.session = null;
    return next();
  }

  const { session, user } = await lucia.validateSession(sessionId);
  if (session && session.fresh) {
    res.appendHeader(
      "Set-Cookie",
      lucia.createSessionCookie(session.id).serialize()
    );
  }
  if (!session) {
    res.appendHeader(
      "Set-Cookie",
      lucia.createBlankSessionCookie().serialize()
    );
  }
  res.locals.session = session;
  res.locals.user = user;

  return next();
});

app.get("/validate-session", async (req, res) => {
  if (!res.locals.session)
    return res.status(403).json({ authenticated: false });

  return res.json({
    email: res.locals.user.email,
    emailVerified: res.locals.user.emailVerified,
  });
});

app.use(signupRouter, signinRouter, signoutRouter, emailVerificationRouter);

const port = process.env.PORT;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
