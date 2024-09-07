import express from "express";
import { lucia } from "../lib/auth.js";

export const signoutRouter = express.Router();

signoutRouter.post("/signout", async (_, res) => {
  if (!res.locals.session) {
    return res.status(401).end();
  }
  await lucia.invalidateSession(res.locals.session.id);
  return res
    .setHeader("Set-Cookie", lucia.createBlankSessionCookie().serialize())
    .end();
});
