const express = require("express");
const cookieParser = require("cookie-parser");

const app = express();
app.use(express.json());
app.use(cookieParser());

const SECRET_PASSWORD = "1234"; // Change this to something better

app.post("/login", (req, res) => {
    const { password } = req.body;

    if (password === SECRET_PASSWORD) {
        res.cookie("rsvp_auth", "yes", {
            httpOnly: true,
            sameSite: "Strict", // Prevents CSRF
            maxAge: 24 * 60 * 60 * 1000, // 1 day
        });
        return res.status(200).send("OK");
    }

    res.status(401).send("Unauthorized");
});

app.get("/rsvp", (req, res) => {
    if (req.cookies.rsvp_auth === "yes") {
        res.send("Welcome to the RSVP page!");
    } else {
        res.status(403).send("Forbidden");
    }
});

app.listen(3000, () => console.log("Server running on port 3000"));

