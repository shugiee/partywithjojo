import fs from 'fs';
import { get } from "http";
import { config } from "dotenv";
import { authenticate } from '@google-cloud/local-auth';
import { google } from 'googleapis';

const { readFile, writeFile } = fs.promises;

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_PATH = '/etc/partywithjojo/token.json';
const CREDENTIALS_PATH = '/etc/partywithjojo/credentials.json';

const secretsPath = "/etc/partywithjojo/secrets.env";
if (fs.existsSync(secretsPath)) {
  config({ path: secretsPath });
} else {
  console.error(`Secrets file not found: ${secretsPath}`);
}
const { GOOGLE_SPREADSHEET_ID } = process.env;

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}



/**
 * Writes to "RSVPs DO NOT EDIT"
 * Docs: https://developers.google.com/sheets/api/samples/writing
 */
async function writeRSVPs(auth, rsvps) {
  const sheets = google.sheets({version: 'v4', auth});
  const res = await sheets.spreadsheets.values.update({
    spreadsheetId: GOOGLE_SPREADSHEET_ID,
    valueInputOption: "RAW",
    range: `RSVPs DO NOT EDIT!A3:E${3 + rsvps.length}`,
    requestBody: {
        majorDimension: "ROWS",
        range: `RSVPs DO NOT EDIT!A3:E${3 + rsvps.length}`,
        values: rsvps.map(rsvp => { 
            const welcomePartyInt = parseInt(rsvp.is_coming_to_welcome_party);
            const weddingInt = parseInt(rsvp.is_coming_to_wedding);
            const welcomePartyValue = isNaN(welcomePartyInt) ? "No response yet" : welcomePartyInt === 1 ? "Yes" : "No";
            const weddingValue = isNaN(weddingInt)? "No response yet" : weddingInt === 1 ? "Yes" : "No";
            return [
                rsvp.name,
                welcomePartyValue,
                weddingValue
            ]
        }
        )
    }
  });
    console.log("Response from google", res);
};

const getRsvps = (auth) => {
    get({
        hostname: 'localhost',
        port: 3000,
        path: '/rsvps',
        agent: false,  // Create a new agent just for this one request
    }, (res) => {
        // Buffer the body entirely for processing as a whole.
        const bodyChunks = [];
        res.on('data', function(chunk) {
            // You can process streamed parts here...
            bodyChunks.push(chunk);
        }).on('end', function() {
            const rsvps = JSON.parse(Buffer.concat(bodyChunks));
            writeRSVPs(auth, rsvps).catch(console.error);
        })
    }); 
};

authorize().then(getRsvps).catch(console.error);
