var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { verifyRequestOrigin } from "lucia";
import { lucia } from "./lib/auth.js";
import { signupRouter } from "./routes/signup.js";
import { signinRouter } from "./routes/signin.js";
import { signoutRouter } from "./routes/signout.js";
import { emailVerificationRouter } from "./routes/email-verification.js";
import { resetPasswordRouter } from "./routes/reset-password.js";
dotenv.config();
const app = express();
// this is needed for req.ip if deployed behind a proxy
// app.set('trust proxy', true)
app.use(cors({
    origin: ["http://localhost:5173"],
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
    var _a, _b;
    if (req.method === "GET") {
        return next();
    }
    const originHeader = (_a = req.headers.origin) !== null && _a !== void 0 ? _a : null;
    const hostHeader = (_b = req.headers.host) !== null && _b !== void 0 ? _b : null;
    if (!originHeader ||
        !hostHeader ||
        !verifyRequestOrigin(originHeader, [hostHeader, "localhost:5173"])) {
        return res.status(403).end();
    }
    return next();
});
app.use((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const sessionId = lucia.readSessionCookie((_a = req.headers.cookie) !== null && _a !== void 0 ? _a : "");
    if (!sessionId) {
        res.locals.user = null;
        res.locals.session = null;
        return next();
    }
    const { session, user } = yield lucia.validateSession(sessionId);
    if (session && session.fresh) {
        res.appendHeader("Set-Cookie", lucia.createSessionCookie(session.id).serialize());
    }
    if (!session) {
        res.appendHeader("Set-Cookie", lucia.createBlankSessionCookie().serialize());
    }
    res.locals.session = session;
    res.locals.user = user;
    return next();
}));
app.get("/validate-session", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!res.locals.session)
        return res.status(403).json({ authenticated: false });
    return res.json({
        email: res.locals.user.email,
        emailVerified: res.locals.user.emailVerified,
    });
}));
app.use(signupRouter, signinRouter, signoutRouter, emailVerificationRouter, resetPasswordRouter);
const port = process.env.PORT;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
