#!/usr/bin/env node
// One-time YouTube sign-in for the Hidayah publisher. Run it YOURSELF in Google Cloud Shell (or on your computer):
//   node scripts/youtube-auth.mjs ~/client_secret.json
// It opens a Google consent link for the channel owner, then prints the refresh token so you can save it
// as a secret. Nothing is sent anywhere except Google. Never paste the token into a chat.
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

const file = process.argv[2];
if (!file) { console.error("usage: node scripts/youtube-auth.mjs <client_secret.json from Google Cloud Console>"); process.exit(1); }
const c = JSON.parse(readFileSync(file, "utf8")).installed;
if (!c) { console.error("This must be the JSON of an OAuth client of type 'Desktop app'."); process.exit(1); }
const redirect = "http://127.0.0.1:8765";
const scopes = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"];
const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
  client_id: c.client_id, redirect_uri: redirect, response_type: "code", scope: scopes.join(" "), access_type: "offline", prompt: "consent",
});
console.log("\n1. Open this link in your browser and sign in as the YouTube CHANNEL OWNER:\n\n" + url + "\n");
console.log("2. Allow access. The browser will then show 'This site can't be reached' at 127.0.0.1 — that is expected.");
console.log("3. Copy the WHOLE address from the browser's address bar and paste it below (into this terminal, not a chat).\n");
const rl = createInterface({ input: process.stdin, output: process.stdout });
const pasted = (await rl.question("Paste the 127.0.0.1 address here: ")).trim(); rl.close();
const code = new URL(pasted).searchParams.get("code");
if (!code) { console.error("No ?code= in that address — try again."); process.exit(1); }
const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ code, client_id: c.client_id, client_secret: c.client_secret, redirect_uri: redirect, grant_type: "authorization_code" }) });
const j = await r.json();
if (!j.refresh_token) { console.error("Google did not return a refresh token:", j); process.exit(1); }
console.log("\n✔ Success. Save these three values as secrets (see docs/setup/youtube-oauth.md, step 6):\n");
console.log("YOUTUBE_CLIENT_ID     =", c.client_id);
console.log("YOUTUBE_CLIENT_SECRET =", c.client_secret);
console.log("YOUTUBE_REFRESH_TOKEN =", j.refresh_token);
console.log("\nKeep them private. Anyone with all three can upload to your channel.");
