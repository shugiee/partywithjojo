const express = require("express");
const cookieParser = require("cookie-parser");
const fs = require('fs');
const dotenv = require('dotenv');

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

