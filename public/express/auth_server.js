"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs = __importStar(require("fs"));
const dotenv = __importStar(require("dotenv"));
const crypto_1 = __importDefault(require("crypto"));
const jose_node_esm_runtime_1 = require("jose-node-esm-runtime"); // Use the ESM version for Node.js
const secretsPath = "/etc/partywithjojo/secrets.env";
if (fs.existsSync(secretsPath)) {
    dotenv.config({ path: secretsPath });
}
else {
    console.error(`Secrets file not found: ${secretsPath}`);
}
const { WEDDING_SITE_PASSWORD, WEDDING_SITE_JWT_SECRET_KEY, SPOTIFY_CLIENT_SECRET, SPOTIFY_CLIENT_ID, SPOTIFY_REFRESH_TOKEN } = process.env;
const SIGNED_WEDDING_SITE_JWT_SECRET_KEY = new TextEncoder().encode(WEDDING_SITE_JWT_SECRET_KEY);
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true })); // Enable form parsing
app.use((0, cookie_parser_1.default)());
const db = new better_sqlite3_1.default("/home/jay/partywithjojo/wedding.db", { verbose: console.log });
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
const ISSUER = "";
const AUDIENCE = "";
const getSpotifyToken = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const spotifyResponse = yield fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                "Authorization": "Basic " + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64"),
                "content-type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: SPOTIFY_REFRESH_TOKEN !== null && SPOTIFY_REFRESH_TOKEN !== void 0 ? SPOTIFY_REFRESH_TOKEN : "",
            })
        });
        const data = JSON.parse(yield spotifyResponse.text());
        if (!spotifyResponse.ok) {
            throw new Error(`Response status: ${spotifyResponse.status}`);
        }
        return data;
    }
    catch (error) {
        console.error("Jonathan error", error.message);
        return null;
    }
});
app.post("/login", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { password } = req.body;
    if (password === WEDDING_SITE_PASSWORD) {
        const spotifyToken = yield getSpotifyToken();
        const jwt = yield new jose_node_esm_runtime_1.SignJWT({})
            .setProtectedHeader({ alg: "HS256" })
            .setIssuer("partywithjojo:host")
            .setAudience("partywithjojo:guest")
            .setIssuedAt(Date.now())
            .sign(SIGNED_WEDDING_SITE_JWT_SECRET_KEY);
        res.cookie("token", jwt, {
            httpOnly: true,
            secure: true,
            sameSite: "strict", // Prevents CSRF
            maxAge: 24 * 60 * 60 * 1000 * 180, // 180 days
        });
        // We don't want httpOnly, since we'll need to access this in JS. Tokens only last one hour.
        res.cookie("spotify", spotifyToken.access_token, { secure: true, sameSite: "strict", maxAge: 3600000 });
        res.redirect("/home");
    }
    else {
        res.redirect("/entry.html");
    }
}));
app.get("/validate-token", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { token } = req.cookies;
    console.log("calling validate token", token);
    try {
        yield (0, jose_node_esm_runtime_1.jwtVerify)(token, SIGNED_WEDDING_SITE_JWT_SECRET_KEY, { issuer: ISSUER, audience: AUDIENCE });
        // Rejuvenate the spotify token
        const spotifyToken = yield getSpotifyToken();
        // We don't want httpOnly, since we'll need to access this in JS. Tokens only last one hour.
        res.setHeader('X-Set-Cookie', `spotify=${spotifyToken.access_token}; Path=/; Secure; SameSite=Strict; Max-Age=3600000;`);
        console.log("token is good");
        res.sendStatus(200);
    }
    catch (err) {
        console.error("Error in parsing token!", err);
        res.sendStatus(401);
    }
}));
const checkbox = (guestName, httpTarget, isEnabled) => {
    const id = crypto_1.default.randomUUID();
    return `
        <div class="checkbox-container">
            <form hx-post="/${httpTarget}" hx-trigger="change" hx-target="#success-message-${id}-container">
                <input type="hidden" name="${httpTarget}" value="${guestName}" />
                <input type="hidden" name="${httpTarget}" value="${id}" />
                <input id="${id}" type="checkbox" name="${httpTarget}" value="yes" ${isEnabled ? "checked" : ""} />
            </form>
            <span id="success-message-${id}-container" />
        </div>
        `;
};
const welcomePartyCheckbox = (row) => {
    const { is_coming_to_welcome_party } = row;
    const isComingToWelcomeParty = parseInt(is_coming_to_welcome_party) === 1;
    return checkbox(row.name, "toggle_welcome_party_attendance", isComingToWelcomeParty);
};
const maybeWelcomePartyRow = (row) => {
    const { is_welcome_party_invitee } = row;
    if (is_welcome_party_invitee === "1") {
        return `
            <td class="row-maybe-welcome-party row-checkbox">
                ${welcomePartyCheckbox(row)}
            </td>
            `;
    }
    return "";
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
            ${maybeWelcomePartyRow(row)}
            <td class="row-wedding-checkbox row-checkbox">
                ${weddingPartyHtml(row)}
            </td>
        </tr>
        `;
};
const rsvpHtml = (rows) => {
    const isAnyoneInvitedToWelcomeParty = rows.some(row => row.is_welcome_party_invitee === "1");
    return `
        <table class="rsvp-table">
            <colgroup>
                <col span="1" class="col">
                ${isAnyoneInvitedToWelcomeParty ? '<col span="1" class="col">' : ""}
                <col span="1" class="col">
            </colgroup>

            <tbody>
            <th>Name</th>
            ${isAnyoneInvitedToWelcomeParty ? '<th>Will attend Friday?</th>' : ""}
            <th>Will attend Saturday?</th>
            ${rows.map(row => rowHtml(row)).join("")}
            </tbody>
        </table>
    `;
};
app.post("/user", (req, res) => {
    const { name } = req.body;
    const members = getAllMembersInPartyWith(name);
    res.send(rsvpHtml(members));
});
const toggleSuccessHtml = (id) => {
    return `
        <span id="success-message-${id}" class="success-message">Saved!</span>
        <script>
            setTimeout(() => {
                document.getElementById("success-message-${id}").classList.add("fade-out");
            }, 5000);
        </script>
        `;
};
// TODO update param passed to have a better name
app.post("/toggle_wedding_attendance", (req, res) => {
    const { toggle_wedding_attendance } = req.body;
    const isEnabled = toggle_wedding_attendance.includes("yes");
    const [name, id] = toggle_wedding_attendance;
    toggleWeddingAttendanceForUser(name, isEnabled);
    res.send(toggleSuccessHtml(id));
});
app.post("/toggle_welcome_party_attendance", (req, res) => {
    const { toggle_welcome_party_attendance } = req.body;
    const isEnabled = toggle_welcome_party_attendance.includes("yes");
    const [name, id] = toggle_welcome_party_attendance;
    toggleWelcomePartyAttendanceForUser(name, isEnabled);
    res.send(toggleSuccessHtml(id));
});
app.get("/rsvps", (req, res) => {
    const rsvps = getAllRsvps();
    res.send(rsvps);
});
app.listen(3000, () => console.log("Server running on port 3000"));
