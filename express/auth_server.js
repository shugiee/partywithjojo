import express from "express";
import sqlite3 from "sqlite3";
import cookieParser from "cookie-parser";
import * as fs from "fs";
import * as dotenv from "dotenv";
import { SignJWT, jwtVerify } from 'jose-node-esm-runtime';  // Use the ESM version for Node.js

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Enable form parsing
app.use(cookieParser());

const secretsPath = "/etc/partywithjojo/secrets.env";
if (fs.existsSync(secretsPath)) {
  dotenv.config({ path: secretsPath });
} else {
  console.error(`Secrets file not found: ${secretsPath}`);
}
const { WEDDING_SITE_PASSWORD } = process.env;
const { WEDDING_SITE_JWT_SECRET_KEY } = process.env;
const SIGNED_WEDDING_SITE_JWT_SECRET_KEY = new TextEncoder().encode(WEDDING_SITE_JWT_SECRET_KEY); 

const ISSUER = "";
const AUDIENCE = "";

app.post("/login", async (req, res) => {
    const { password } = req.body;

    if (password === WEDDING_SITE_PASSWORD) {
        const jwt = await new SignJWT({})
            .setProtectedHeader({ alg: "HS256" })
            .setIssuer("partywithjojo:host")
            .setAudience("partywithjojo:guest")
            .setIssuedAt(Date.now())
            .sign(SIGNED_WEDDING_SITE_JWT_SECRET_KEY);

        res.cookie("token", jwt, {
            httpOnly: true,
            secure: true,
            sameSite: "Strict", // Prevents CSRF
            maxAge: 24 * 60 * 60 * 1000 * 180, // 180 days
        });
        res.redirect("/home");
    } else {
        res.redirect("/entry.html");
    }
});

app.get("/validate-token", async (req, res) => {
    console.log("calling validate token");
    const { token } = req.cookies;
    try {
        await jwtVerify(token, SIGNED_WEDDING_SITE_JWT_SECRET_KEY, { issuer: ISSUER, audience: AUDIENCE });
        console.log("token is good");
        res.sendStatus(200);
    } catch (err) {
        console.error("Error in parsing token!", err);
        res.sendStatus(401);
    }
});

app.post("/user", (req, res) => {
    const { name } = req.body;
    console.log("name:", name);
});

app.listen(3000, () => console.log("Server running on port 3000"));

