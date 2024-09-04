import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { verifyRequestOrigin } from "lucia";
import { lucia } from "./lib/auth.js";
import { signupRouter } from "./routes/signup.js";
import { signinRouter } from "./routes/signin.js";

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
  console.log(sessionId);
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
  return res.json({ authenticated: true, username: res.locals.user.username });
});

app.use(signupRouter, signinRouter);

const port = process.env.PORT;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
