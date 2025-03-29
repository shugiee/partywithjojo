"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var cookie_parser_1 = require("cookie-parser");
var better_sqlite3_1 = require("better-sqlite3");
var fs = require("fs");
var dotenv = require("dotenv");
var crypto_1 = require("crypto");
var jose_node_esm_runtime_1 = require("jose-node-esm-runtime"); // Use the ESM version for Node.js
var secretsPath = "/etc/partywithjojo/secrets.env";
if (fs.existsSync(secretsPath)) {
    dotenv.config({ path: secretsPath });
}
else {
    console.error("Secrets file not found: ".concat(secretsPath));
}
var _a = process.env, WEDDING_SITE_PASSWORD = _a.WEDDING_SITE_PASSWORD, WEDDING_SITE_JWT_SECRET_KEY = _a.WEDDING_SITE_JWT_SECRET_KEY, SPOTIFY_CLIENT_SECRET = _a.SPOTIFY_CLIENT_SECRET, SPOTIFY_CLIENT_ID = _a.SPOTIFY_CLIENT_ID, SPOTIFY_REFRESH_TOKEN = _a.SPOTIFY_REFRESH_TOKEN;
var SIGNED_WEDDING_SITE_JWT_SECRET_KEY = new TextEncoder().encode(WEDDING_SITE_JWT_SECRET_KEY);
var app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true })); // Enable form parsing
app.use((0, cookie_parser_1.default)());
var db = new better_sqlite3_1.default("/home/jay/partywithjojo/wedding.db", { verbose: console.log });
db.pragma('journal_mode = WAL');
var getAllRsvps = function () {
    return db.prepare('SELECT * FROM guests;').all();
};
var getAllMembersInPartyWith = function (name) {
    var row = db.prepare('SELECT * FROM guests WHERE party_id IN (SELECT party_id FROM guests WHERE name LIKE ?);').all(name);
    return row;
};
var toggleWeddingAttendanceForUser = function (name, isEnabled) {
    var value = isEnabled ? 1 : 0;
    db.prepare("UPDATE guests SET is_coming_to_wedding = ? WHERE name LIKE ?").run(value, name);
};
var toggleWelcomePartyAttendanceForUser = function (name, isEnabled) {
    var value = isEnabled ? 1 : 0;
    db.prepare("UPDATE guests SET is_coming_to_welcome_party = ? WHERE name LIKE ?").run(value, name);
};
var ISSUER = "";
var AUDIENCE = "";
var getSpotifyToken = function () { return __awaiter(void 0, void 0, void 0, function () {
    var spotifyResponse, data, _a, _b, error_1;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 3, , 4]);
                return [4 /*yield*/, fetch("https://accounts.spotify.com/api/token", {
                        method: "POST",
                        headers: {
                            "Authorization": "Basic " + Buffer.from("".concat(SPOTIFY_CLIENT_ID, ":").concat(SPOTIFY_CLIENT_SECRET)).toString("base64"),
                            "content-type": "application/x-www-form-urlencoded"
                        },
                        body: new URLSearchParams({
                            grant_type: "refresh_token",
                            refresh_token: SPOTIFY_REFRESH_TOKEN !== null && SPOTIFY_REFRESH_TOKEN !== void 0 ? SPOTIFY_REFRESH_TOKEN : "",
                        })
                    })];
            case 1:
                spotifyResponse = _c.sent();
                _b = (_a = JSON).parse;
                return [4 /*yield*/, spotifyResponse.text()];
            case 2:
                data = _b.apply(_a, [_c.sent()]);
                if (!spotifyResponse.ok) {
                    throw new Error("Response status: ".concat(spotifyResponse.status));
                }
                return [2 /*return*/, data];
            case 3:
                error_1 = _c.sent();
                console.error("Jonathan error", error_1.message);
                return [2 /*return*/, null];
            case 4: return [2 /*return*/];
        }
    });
}); };
app.post("/login", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var password, spotifyToken, jwt;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                password = req.body.password;
                if (!(password === WEDDING_SITE_PASSWORD)) return [3 /*break*/, 3];
                return [4 /*yield*/, getSpotifyToken()];
            case 1:
                spotifyToken = _a.sent();
                return [4 /*yield*/, new jose_node_esm_runtime_1.SignJWT({})
                        .setProtectedHeader({ alg: "HS256" })
                        .setIssuer("partywithjojo:host")
                        .setAudience("partywithjojo:guest")
                        .setIssuedAt(Date.now())
                        .sign(SIGNED_WEDDING_SITE_JWT_SECRET_KEY)];
            case 2:
                jwt = _a.sent();
                res.cookie("token", jwt, {
                    httpOnly: true,
                    secure: true,
                    sameSite: "strict", // Prevents CSRF
                    maxAge: 24 * 60 * 60 * 1000 * 180, // 180 days
                });
                // We don't want httpOnly, since we'll need to access this in JS. Tokens only last one hour.
                res.cookie("spotify", spotifyToken.access_token, { secure: true, sameSite: "strict", maxAge: 3600000 });
                res.redirect("/home");
                return [3 /*break*/, 4];
            case 3:
                res.redirect("/entry.html");
                _a.label = 4;
            case 4: return [2 /*return*/];
        }
    });
}); });
app.get("/validate-token", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var token, spotifyToken, err_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                token = req.cookies.token;
                console.log("calling validate token", token);
                _a.label = 1;
            case 1:
                _a.trys.push([1, 4, , 5]);
                return [4 /*yield*/, (0, jose_node_esm_runtime_1.jwtVerify)(token, SIGNED_WEDDING_SITE_JWT_SECRET_KEY, { issuer: ISSUER, audience: AUDIENCE })];
            case 2:
                _a.sent();
                return [4 /*yield*/, getSpotifyToken()];
            case 3:
                spotifyToken = _a.sent();
                // We don't want httpOnly, since we'll need to access this in JS. Tokens only last one hour.
                res.setHeader('X-Set-Cookie', "spotify=".concat(spotifyToken.access_token, "; Path=/; Secure; SameSite=Strict; Max-Age=3600000;"));
                console.log("token is good");
                res.sendStatus(200);
                return [3 /*break*/, 5];
            case 4:
                err_1 = _a.sent();
                console.error("Error in parsing token!", err_1);
                res.sendStatus(401);
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); });
var checkbox = function (guestName, httpTarget, isEnabled) {
    var id = crypto_1.default.randomUUID();
    return "\n        <div class=\"checkbox-container\">\n            <form hx-post=\"/".concat(httpTarget, "\" hx-trigger=\"change\" hx-target=\"#success-message-").concat(id, "-container\">\n                <input type=\"hidden\" name=\"").concat(httpTarget, "\" value=\"").concat(guestName, "\" />\n                <input type=\"hidden\" name=\"").concat(httpTarget, "\" value=\"").concat(id, "\" />\n                <input id=\"").concat(id, "\" type=\"checkbox\" name=\"").concat(httpTarget, "\" value=\"yes\" ").concat(isEnabled ? "checked" : "", " />\n            </form>\n            <span id=\"success-message-").concat(id, "-container\" />\n        </div>\n        ");
};
var welcomePartyCheckbox = function (row) {
    var is_coming_to_welcome_party = row.is_coming_to_welcome_party;
    var isComingToWelcomeParty = parseInt(is_coming_to_welcome_party) === 1;
    return checkbox(row.name, "toggle_welcome_party_attendance", isComingToWelcomeParty);
};
var maybeWelcomePartyRow = function (row) {
    var is_welcome_party_invitee = row.is_welcome_party_invitee;
    if (is_welcome_party_invitee === "1") {
        return "\n            <td class=\"row-maybe-welcome-party row-checkbox\">\n                ".concat(welcomePartyCheckbox(row), "\n            </td>\n            ");
    }
    return "";
};
var weddingPartyHtml = function (row) {
    var is_coming_to_wedding = row.is_coming_to_wedding;
    var isComingToWedding = parseInt(is_coming_to_wedding) === 1;
    return checkbox(row.name, "toggle_wedding_attendance", isComingToWedding);
};
var rowHtml = function (row) {
    return "\n        <tr class=\"row\">\n            <td class=\"row-name\">\n                ".concat(row.name, "\n            </td>\n            ").concat(maybeWelcomePartyRow(row), "\n            <td class=\"row-wedding-checkbox row-checkbox\">\n                ").concat(weddingPartyHtml(row), "\n            </td>\n        </tr>\n        ");
};
var rsvpHtml = function (rows) {
    var isAnyoneInvitedToWelcomeParty = rows.some(function (row) { return row.is_welcome_party_invitee === "1"; });
    return "\n        <table class=\"rsvp-table\">\n            <colgroup>\n                <col span=\"1\" class=\"col\">\n                ".concat(isAnyoneInvitedToWelcomeParty ? '<col span="1" class="col">' : "", "\n                <col span=\"1\" class=\"col\">\n            </colgroup>\n\n            <tbody>\n            <th>Name</th>\n            ").concat(isAnyoneInvitedToWelcomeParty ? '<th>Will attend Friday?</th>' : "", "\n            <th>Will attend Saturday?</th>\n            ").concat(rows.map(function (row) { return rowHtml(row); }).join(""), "\n            </tbody>\n        </table>\n    ");
};
app.post("/user", function (req, res) {
    var name = req.body.name;
    var members = getAllMembersInPartyWith(name);
    res.send(rsvpHtml(members));
});
var toggleSuccessHtml = function (id) {
    return "\n        <span id=\"success-message-".concat(id, "\" class=\"success-message\">Saved!</span>\n        <script>\n            setTimeout(() => {\n                document.getElementById(\"success-message-").concat(id, "\").classList.add(\"fade-out\");\n            }, 5000);\n        </script>\n        ");
};
// TODO update param passed to have a better name
app.post("/toggle_wedding_attendance", function (req, res) {
    var toggle_wedding_attendance = req.body.toggle_wedding_attendance;
    var isEnabled = toggle_wedding_attendance.includes("yes");
    var name = toggle_wedding_attendance[0], id = toggle_wedding_attendance[1];
    toggleWeddingAttendanceForUser(name, isEnabled);
    res.send(toggleSuccessHtml(id));
});
app.post("/toggle_welcome_party_attendance", function (req, res) {
    var toggle_welcome_party_attendance = req.body.toggle_welcome_party_attendance;
    var isEnabled = toggle_welcome_party_attendance.includes("yes");
    var name = toggle_welcome_party_attendance[0], id = toggle_welcome_party_attendance[1];
    toggleWelcomePartyAttendanceForUser(name, isEnabled);
    res.send(toggleSuccessHtml(id));
});
app.get("/rsvps", function (req, res) {
    var rsvps = getAllRsvps();
    res.send(rsvps);
});
app.listen(3000, function () { return console.log("Server running on port 3000"); });
