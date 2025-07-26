import fs from "fs";
import { get } from "http";
import { config } from "dotenv";

import { google } from "googleapis";

const secretsPath = "/etc/partywithjojo/secrets.env";
if (fs.existsSync(secretsPath)) {
  config({ path: secretsPath });
} else {
  console.error(`Secrets file not found: ${secretsPath}`);
}
const { GOOGLE_SPREADSHEET_ID } = process.env;

const sheets = google.sheets("v4");
const auth = new google.auth.GoogleAuth({
  keyFile: "/etc/partywithjojo/google_sheets.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const getRsvps = async () => {
  get(
    {
      hostname: "localhost",
      port: 3000,
      path: "/rsvps",
      agent: false,
    },
    (res) => {
      const bodyChunks = [];
      res
        .on("data", function (chunk) {
          bodyChunks.push(chunk);
        })
        .on("end", function () {
          const rsvps = JSON.parse(Buffer.concat(bodyChunks));
          writeRSVPs(rsvps).catch((err) => console.error(err));
        });
    },
  );
};

/**
 * Writes to "RSVPs DO NOT EDIT"
 * Docs: https://developers.google.com/sheets/api/samples/writing
 */
async function writeRSVPs(rsvps) {
  const authClient = await auth.getClient();
  const res = sheets.spreadsheets.values.update({
    auth: authClient,
    spreadsheetId: GOOGLE_SPREADSHEET_ID,
    valueInputOption: "RAW",
    range: `RSVPs DO NOT EDIT!A3:E${3 + rsvps.length}`,
    requestBody: {
      majorDimension: "ROWS",
      range: `RSVPs DO NOT EDIT!A3:E${3 + rsvps.length}`,
      values: rsvps.map((rsvp) => {
        const welcomePartyInt = parseInt(rsvp.is_coming_to_welcome_party);
        const weddingInt = parseInt(rsvp.is_coming_to_wedding);
        const email = rsvp.email;
        const welcomePartyValue = isNaN(welcomePartyInt)
          ? "No response yet"
          : welcomePartyInt === 1
            ? "Yes"
            : "No";
        const weddingValue = isNaN(weddingInt)
          ? "No response yet"
          : weddingInt === 1
            ? "Yes"
            : "No";
	const maybeTimestamp = rsvp.last_updated;
        return [rsvp.name, welcomePartyValue, weddingValue, email, maybeTimestamp];
      }),
    },
  });
}

getRsvps();
