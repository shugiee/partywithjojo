import express from "express";
import cookieParser from "cookie-parser";
import Database from "better-sqlite3";
import * as fs from "fs";
import * as dotenv from "dotenv";
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
    .all(name.trim()) as Row[];
  return row;
};

const toggleWeddingAttendanceForUser = (
  name: string,
  isEnabled: boolean,
  email: string | null,
) => {
  const value = isEnabled ? 1 : 0;
  db.prepare(
    "UPDATE guests SET is_coming_to_wedding = ?, email = ? WHERE name LIKE ?",
  ).run(value, email, name);
};

const toggleWelcomePartyAttendanceForUser = (
  name: string,
  isEnabled: boolean,
  email: string | null,
) => {
  const value = isEnabled ? 1 : 0;
  db.prepare(
    "UPDATE guests SET is_coming_to_welcome_party = ?, email = ? WHERE name LIKE ?",
  ).run(value, email, name);
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
    console.error("Error", error.message);
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

const radioButtons = (
  guestName: string,
  eventName: string,
  isEnabled: boolean | null,
) => {
  console.log("joanthan isEnabled", isEnabled);
  return `
        <div class="radioButtons-container">
            <fieldset>
            <div class="radio-button">
                <input required type="radio" name="${guestName}---${eventName}" value="yes" ${isEnabled === true ? "checked" : ""}>Yes</input>
            </div>
            <div class="radio-button">
                <input type="radio" name="${guestName}---${eventName}" value="no" ${isEnabled === false ? "checked" : ""}>No</input>
            </div>
            </fieldset>
        </div>
        `;
};

const emailInput = () => {
  return `
  <div class="rsvp-footer">
  <label class="rsvp-label">
            <div class="rsvp-label-text">
              Please enter one email for your party to get additional updates closer to the wedding day
            </div>
        <div class="rsvp-input-and-submit-button">
                  <input
                    type="email"
                    name="email"
                    id="email"
                    class="rsvp-input"
                    required
                    placeholder="jojo@party.com"
                  ></input>
            <button type="submit" class="rsvp-submit-button-inverse" hx-post="rsvp_submit" >Submit RSVP</button>
            </div>
            </label>
            </div>
            `;
};

const welcomePartyCheckbox = (row: Row) => {
  const { is_coming_to_welcome_party } = row;
  const isComingToWelcomeParty =
    parseInt(is_coming_to_welcome_party) === 1
      ? true
      : parseInt(is_coming_to_welcome_party) === 0
        ? false
        : null;
  return radioButtons(row.name, "welcomeParty", isComingToWelcomeParty);
};

const maybeWelcomePartyRow = (row: Row) => {
  const { is_welcome_party_invitee } = row;
  if (is_welcome_party_invitee === "1") {
    return `
            <td class="row-maybe-welcome-party row-radioButtons">
                ${welcomePartyCheckbox(row)}
            </td>
            `;
  }
  return "";
};

const weddingPartyHtml = (row: Row) => {
  const { is_coming_to_wedding } = row;
  const isComingToWedding =
    parseInt(is_coming_to_wedding) === 1
      ? true
      : parseInt(is_coming_to_wedding) === 0
        ? false
        : null;
  return radioButtons(row.name, "wedding", isComingToWedding);
};

const rowHtml = (row: Row) => {
  return `
        <tr class="row">
            <td class="row-name">
                ${row.name}
            </td>
            ${maybeWelcomePartyRow(row)}
            <td class="row-wedding-radioButtons row-radioButtons">
                ${weddingPartyHtml(row)}
            </td>
        </tr>
        `;
};

const rsvpHtml = (rows: Row[]) => {
  const isAnyoneInvitedToWelcomeParty = rows.some(
    (row) => row.is_welcome_party_invitee === "1",
  );
  if (rows.length === 0) {
    return `<div class="pink">
    <h4>
            We couldn't find anyone with that name! Please try again or let us know if you're having trouble.
                    </h4>
        </div>
        `;
  }
  return `
        <div class="rsvp-table-container">
            <form class="rsvp-form" hx-target="#rsvp_success_message_container">
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
            ${emailInput()}
            </form>
            <div id="rsvp_success_message_container"><div>
        </div>
    `;
};

app.post("/user", (req, res) => {
  const { name } = req.body;
  const members = getAllMembersInPartyWith(name);
  res.send(rsvpHtml(members));
});

app.post("/rsvp_submit", (req, res) => {
  const callbacks: ((email: string | null) => void)[] = [];
  let maybeEmail = null;

  for (const [key, value] of Object.entries(req.body)) {
    if (key === "email" && value) {
      maybeEmail = value.toString();
    }
    const [name, event] = key.split("---");
    if (event === "welcomeParty") {
      const isComingToWelcomeParty =
        event === "welcomeParty" && value === "yes";
      callbacks.push((email: string | null) =>
        toggleWelcomePartyAttendanceForUser(
          name,
          isComingToWelcomeParty,
          email,
        ),
      );
    } else if (event === "wedding") {
      const isComingToWedding = event === "wedding" && value === "yes";
      callbacks.push((email: string | null) =>
        toggleWeddingAttendanceForUser(name, isComingToWedding, email),
      );
    }
  }
  for (const callback of callbacks) {
    callback(maybeEmail);
  }
  res.setHeader("HX-Redirect", "/success");
  res.send();
});

app.get("/rsvps", (req, res) => {
  const rsvps = getAllRsvps();
  res.send(rsvps);
});

app.listen(3000, () => console.log("Server running on port 3000"));
