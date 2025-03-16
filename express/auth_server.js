import express from "express";
import cookieParser from "cookie-parser";
import Database from 'better-sqlite3';
import * as fs from "fs";
import * as dotenv from "dotenv";
import crypto from "crypto";
import { SignJWT, jwtVerify } from 'jose-node-esm-runtime';  // Use the ESM version for Node.js

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Enable form parsing
app.use(cookieParser());

const db = new Database("/home/jay/partywithjojo/wedding.db", { verbose: console.log });
db.pragma('journal_mode = WAL');

const getAllRsvps = () => {
    return db.prepare('SELECT * FROM guests;').all();
};

const getAllMembersInPartyWith = (name) => {
    const row = db.prepare('SELECT * FROM guests WHERE party_id IN (SELECT party_id FROM guests WHERE name LIKE ?);').all(name);
    return row;
};

const toggleWeddingAttendanceForUser = (name, isEnabled) => {
    const value = isEnabled ? 1 : 0;
    db.prepare("UPDATE guests SET is_coming_to_wedding = ? WHERE name LIKE ?").run(value, name);
};

const toggleWelcomePartyAttendanceForUser = (name, isEnabled) => {
    const value = isEnabled ? 1 : 0;
    db.prepare("UPDATE guests SET is_coming_to_welcome_party = ? WHERE name LIKE ?").run(value, name);
};

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
    const { token } = req.cookies;
    console.log("calling validate token", token);
    try {
        await jwtVerify(token, SIGNED_WEDDING_SITE_JWT_SECRET_KEY, { issuer: ISSUER, audience: AUDIENCE });
        console.log("token is good");
        res.sendStatus(200);
    } catch (err) {
        console.error("Error in parsing token!", err);
        res.sendStatus(401);
    }
});

const checkbox = (guestName, httpTarget, isEnabled) => {
    const id = crypto.randomUUID();
    return `
        <form hx-post="/${httpTarget}" hx-trigger="change" hx-target="#todo-remove-me">
            <input type="hidden" name="${httpTarget}" value="${guestName}" />
            <input id="${id}" type="checkbox" name="${httpTarget}" value="yes" ${isEnabled ? "checked" : ""} />
        </form>
        `;
};

const maybeWelcomePartyHtml = (row) => {
    const { is_coming_to_welcome_party } = row;
    const isComingToWelcomeParty = parseInt(is_coming_to_welcome_party) === 1;
    return checkbox(row.name, "toggle_welcome_party_attendance", isComingToWelcomeParty);
};

const weddingPartyHtml = (row) => {
    const { is_coming_to_wedding } = row;
    const isComingToWedding = parseInt(is_coming_to_wedding) === 1;
    return checkbox(row.name, "toggle_wedding_attendance", isComingToWedding);
};

const rowHtml = (row) => {
    return `
        <tr class="row">
                <td class="row-name">
                    ${row.name}
                </td>
                <td class="row-maybe-welcome-party row-checkbox">
                    ${maybeWelcomePartyHtml(row)}
                </td>
                <td class="row-wedding-checkbox row-checkbox">
                    ${weddingPartyHtml(row)}
                </td>
        </tr>
        `;
};

const rsvpHtml = (rows) => {
    return `
        <table class="rsvp-table">
            <colgroup>
                <col span="1" class="col">
                <col span="1" class="col">
                <col span="1" class="col">
            </colgroup>

            <tbody>
            <th>Name</th>
            <th>Will attend Friday?</th>
            <th>Will attend Saturday?</th>
            ${rows.map(row => rowHtml(row)).join("")}
            </tbody>
        <div id="todo-remove-me" />
        </table>
    `;
};

app.post("/user", (req, res) => {
    const { name } = req.body;
    console.log("in /user from POST name:", name);
    const members = getAllMembersInPartyWith(name);
    console.log("members", members);
    res.send(rsvpHtml(members));
});

// TODO update param passed to have a better name
app.post("/toggle_wedding_attendance", (req, res) => {
    console.log("in /toggle_wedding_attendance from POST body:", req.body);
    const { toggle_wedding_attendance } = req.body;
    const isEnabled = Array.isArray(toggle_wedding_attendance) && toggle_wedding_attendance.includes("yes");
    const name = Array.isArray(toggle_wedding_attendance) ? toggle_wedding_attendance[0] : toggle_wedding_attendance;
    toggleWeddingAttendanceForUser(name, isEnabled);
    res.sendStatus(200);
});


app.post("/toggle_welcome_party_attendance", (req, res) => {
    console.log("in /toggle_welcome_party_attendance from POST body:", req.body);
    const { toggle_welcome_party_attendance } = req.body;
    const isEnabled = Array.isArray(toggle_welcome_party_attendance) && toggle_welcome_party_attendance.includes("yes");
    const name = Array.isArray(toggle_welcome_party_attendance) ? toggle_welcome_party_attendance[0] : toggle_welcome_party_attendance;
    toggleWelcomePartyAttendanceForUser(name, isEnabled);
    res.sendStatus(200);
});

app.get("/rsvps", (req, res) => {
    console.log("getting all rsvps");
    const rsvps = getAllRsvps();
    res.send(rsvps);
});

app.listen(3000, () => console.log("Server running on port 3000"));

