import express from "express";
import cookieParser from "cookie-parser";
import * as fs from "fs";
import * as dotenv from "dotenv";
import * as jose from "jose";

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
console.log("key", WEDDING_SITE_JWT_SECRET_KEY);

app.post("/login", (req, res) => {
    const { password } = req.body;

    if (password === WEDDING_SITE_PASSWORD) {
        res.cookie("rsvp_auth", "confirmed", {
            httpOnly: true,
            sameSite: "Strict", // Prevents CSRF
            maxAge: 24 * 60 * 60 * 1000 * 180, // 180 days
        });
        return res.status(200).send("OK");
    }

    res.redirect("/register?event=registrationFailed");
});

app.listen(3000, () => console.log("Server running on port 3000"));

