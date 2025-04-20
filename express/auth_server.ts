import express from "express";
import cookieParser from "cookie-parser";
import Database from "better-sqlite3";
import * as fs from "fs";
import * as dotenv from "dotenv";
import crypto from "crypto";
import { SignJWT, jwtVerify } from "jose-node-esm-runtime"; // Use the ESM version for Node.js

const secretsPath = "/etc/partywithjojo/secrets.env";
if (fs.existsSync(secretsPath)) {
  dotenv.config({ path: secretsPath });
} else {
  console.error(`Secrets file not found: ${secretsPath}`);
}

const {
  WEDDING_SITE_PASSWORD,
  WEDDING_SITE_JWT_SECRET_KEY,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_REFRESH_TOKEN,
} = process.env;
const SIGNED_WEDDING_SITE_JWT_SECRET_KEY = new TextEncoder().encode(
  WEDDING_SITE_JWT_SECRET_KEY,
);

interface Row {
  id: string;
  name: string;
  party_ir: string;
  is_welcome_party_invitee: string;
  is_coming_to_welcome_party: string;
  is_coming_to_wedding: string;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Enable form parsing
app.use(cookieParser());

const db = new Database("/home/jay/partywithjojo/wedding.db", {
  verbose: console.log,
});
db.pragma("journal_mode = WAL");

const getAllRsvps = () => {
  return db.prepare("SELECT * FROM guests;").all();
};

const getAllMembersInPartyWith = (name: string): Row[] => {
  const row = db
    .prepare(
      "SELECT * FROM guests WHERE party_id IN (SELECT party_id FROM guests WHERE name LIKE ?);",
    )
    .all(name) as Row[];
  return row;
};

const toggleWeddingAttendanceForUser = (name: string, isEnabled: boolean) => {
  const value = isEnabled ? 1 : 0;
  db.prepare(
    "UPDATE guests SET is_coming_to_wedding = ? WHERE name LIKE ?",
  ).run(value, name);
};

const toggleWelcomePartyAttendanceForUser = (
  name: string,
  isEnabled: boolean,
) => {
  const value = isEnabled ? 1 : 0;
  db.prepare(
    "UPDATE guests SET is_coming_to_welcome_party = ? WHERE name LIKE ?",
  ).run(value, name);
};

const ISSUER = "";
const AUDIENCE = "";

const getSpotifyToken = async () => {
  try {
    const spotifyResponse = await fetch(
      "https://accounts.spotify.com/api/token",
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(
              `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`,
            ).toString("base64"),
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: SPOTIFY_REFRESH_TOKEN ?? "",
        }),
      },
    );
    const data = JSON.parse(await spotifyResponse.text());

    if (!spotifyResponse.ok) {
      throw new Error(`Response status: ${spotifyResponse.status}`);
    }

    return data;
  } catch (error: any) {
    console.error("Jonathan error", error.message);
    return null;
  }
};

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
      sameSite: "strict", // Prevents CSRF
      maxAge: 24 * 60 * 60 * 1000 * 180, // 180 days
    });

    // We don't want httpOnly, since we'll need to access this in JS. Tokens only last one hour.
    res.cookie("spotify", spotifyToken.access_token, {
      secure: true,
      sameSite: "strict",
      maxAge: 3_600_000,
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
    await jwtVerify(token, SIGNED_WEDDING_SITE_JWT_SECRET_KEY, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    // Rejuvenate the spotify token
    const spotifyToken = await getSpotifyToken();
    // We don't want httpOnly, since we'll need to access this in JS. Tokens only last one hour.
    res.setHeader(
      "X-Set-Cookie",
      `spotify=${spotifyToken.access_token}; Path=/; Secure; SameSite=Strict; Max-Age=3600000;`,
    );
    console.log("token is good");
    res.sendStatus(200);
  } catch (err) {
    console.error("Error in parsing token!", err);
    res.sendStatus(401);
  }
});

const checkbox = (
  guestName: string,
  httpTarget: string,
  isEnabled: boolean,
) => {
  const id = crypto.randomUUID();
  return `
        <div class="checkbox-container">
            <form class="rsvp-form" hx-post="/${httpTarget}" hx-trigger="change" hx-target="#success-message-${id}-container">
                <input type="hidden" name="${httpTarget}" value="${guestName}" />
                <input type="hidden" name="${httpTarget}" value="${id}" />
                <input id="${id}" type="checkbox" name="${httpTarget}" value="yes" ${isEnabled ? "checked" : ""} />
                <span id="success-message-${id}-container" />
            </form>
        </div>
        `;
};

const welcomePartyCheckbox = (row: Row) => {
  const { is_coming_to_welcome_party } = row;
  const isComingToWelcomeParty = parseInt(is_coming_to_welcome_party) === 1;
  return checkbox(
    row.name,
    "toggle_welcome_party_attendance",
    isComingToWelcomeParty,
  );
};

const maybeWelcomePartyRow = (row: Row) => {
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

const weddingPartyHtml = (row: Row) => {
  const { is_coming_to_wedding } = row;
  const isComingToWedding = parseInt(is_coming_to_wedding) === 1;
  return checkbox(row.name, "toggle_wedding_attendance", isComingToWedding);
};

const rowHtml = (row: Row) => {
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

const rsvpHtml = (rows: Row[]) => {
  const isAnyoneInvitedToWelcomeParty = rows.some(
    (row) => row.is_welcome_party_invitee === "1",
  );
  return `
        <div class="rsvp-table-container">
            <table class="rsvp-table">
                <colgroup>
                    <col span="1" class="col">
                    ${isAnyoneInvitedToWelcomeParty ? '<col span="1" class="col">' : ""}
                    <col span="1" class="col">
                </colgroup>

                <tbody>
                <th></th>
                ${isAnyoneInvitedToWelcomeParty ? "<th class='bright'>Friday<span class='pink bright'> | </span>Welcome Dinner</th>" : ""}
                <th class='bright'>Saturday<span class='pink bright'> | </span>Wedding</th>
                ${rows.map((row) => rowHtml(row)).join("")}
                </tbody>
            </table>
            <p class="note">Changes save automatically!</p>
        </div>
    `;
};

app.post("/user", (req, res) => {
  const { name } = req.body;
  const members = getAllMembersInPartyWith(name);
  res.send(rsvpHtml(members));
});

const toggleSuccessHtml = (id: string) => {
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
