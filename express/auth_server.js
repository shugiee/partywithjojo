import express from "express";
import cookieParser from "cookie-parser";
import Database from 'better-sqlite3';
import * as fs from "fs";
import * as dotenv from "dotenv";
import crypto from "crypto";
import { SignJWT, jwtVerify } from 'jose-node-esm-runtime';  // Use the ESM version for Node.js

const secretsPath = "/etc/partywithjojo/secrets.env";
if (fs.existsSync(secretsPath)) {
  dotenv.config({ path: secretsPath });
} else {
  console.error(`Secrets file not found: ${secretsPath}`);
}

const { WEDDING_SITE_PASSWORD, WEDDING_SITE_JWT_SECRET_KEY, SPOTIFY_CLIENT_SECRET, SPOTIFY_CLIENT_ID, SPOTIFY_REFRESH_TOKEN } = process.env;
const SIGNED_WEDDING_SITE_JWT_SECRET_KEY = new TextEncoder().encode(WEDDING_SITE_JWT_SECRET_KEY); 

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

const ISSUER = "";
const AUDIENCE = "";

const getSpotifyToken = async () => {
    try {
        const spotifyResponse = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                "Authorization": "Basic " + Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64"),
                "content-type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: SPOTIFY_REFRESH_TOKEN,
            })
        });
        const data = JSON.parse(await spotifyResponse.text());

        if (!spotifyResponse.ok) {
            throw new Error(`Response status: ${spotifyResponse.status}`);
        }

        return data;
    } catch (error) {
        console.error("Jonathan error", error.message);
        return null;
    }
}


app.post("/login", async (req, res) => {
    const { password } = req.body;

    if (password === WEDDING_SITE_PASSWORD) {
        const spotifyToken = await getSpotifyToken();

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

        // We don't want httpOnly, since we'll need to access this in JS. Tokens only last one hour.
        res.cookie("spotify", spotifyToken.access_token, { secure: true, sameSite: "Strict", maxAge: 3_600_000 });
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

        // Rejuvenate the spotify token
        const spotifyToken = await getSpotifyToken();
        // We don't want httpOnly, since we'll need to access this in JS. Tokens only last one hour.
        res.setHeader('X-Set-Cookie', `spotify=${spotifyToken.access_token}; Path=/; Secure; SameSite=Strict; Max-Age=3600000;`);
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
    console.log(row);
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

// Authorization token that must have been created previously. See : https://developer.spotify.com/documentation/web-api/concepts/authorization
const token = 'BQDaEhRcCiBCFOyqCGMpZ3VOxj_aA0VYFWSDgRpcxm4hKrmLs-o_JcIbtJopyo_zrL0C7Ld1z-bMgiG-48M0ui6Csvg1G-QiDlFgJUdH2ow_kPekZhneGpMa2vTtuLKFcxKH794IaDAuyP7lBYDhKKXAq2KjsTvi84rRF9APhmkUoA5UB_EgmL0klDKkh-pwuISo-ouAbR9GSrGksGhVFl528yTgJjR_wk0vDDOB_8dGcI_CyB-WA3yOiVHhqxZv_bMzmKz5vBx2FqauMmJWHAVPskLcfUxxmAG84INs_-iZrt84TFUmJlUV';
async function fetchWebApi(endpoint, method, body) {
  const res = await fetch(`https://api.spotify.com/${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method,
    body:JSON.stringify(body)
  });
  return await res.json();
}

async function getTopTracks(){
  // Endpoint reference : https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks
  return (await fetchWebApi(
    'v1/me/top/tracks?time_range=long_term&limit=5', 'GET'
  )).items;
}

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

