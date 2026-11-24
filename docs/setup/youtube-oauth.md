# YouTube Data API + OAuth "Desktop app" client — founder setup (≈10 minutes)

Do this signed in to Google Cloud Console with the account that owns project **even-boulder-…-d5**
(or a new project if you prefer). The YouTube **channel owner** must do step 5.

## 1. Enable the YouTube Data API v3
1. Open https://console.cloud.google.com/apis/library/youtube.googleapis.com
2. Check the project selector (top bar) shows your Hidayah project.
3. Click **Enable**.
   *(Optional, for analytics later: also enable https://console.cloud.google.com/apis/library/youtubeanalytics.googleapis.com)*

## 2. Configure the OAuth consent screen (Google Auth Platform)
1. Open https://console.cloud.google.com/auth/overview → **Get started** (if shown).
2. **App name:** `Hidayah Publisher` · **User support email:** your email → Next.
3. **Audience:** **External** → Next. **Contact email:** your email → Next → agree → **Create**.
4. Left menu **Data Access** → **Add or remove scopes** → tick
   `.../auth/youtube.upload` and `.../auth/youtube.readonly` → **Update** → **Save**.
5. Left menu **Audience** → under *Test users* add the Google account that owns the YouTube channel.
6. Still on **Audience**: click **Publish app** → Confirm. (Status becomes *In production*.)
   This matters: in *Testing* status Google expires the sign-in after **7 days** and uploads would stop.
   You will see an "unverified app" warning when signing in — that is normal for your own private tool;
   click **Advanced → Go to Hidayah Publisher (unsafe)**. Verification is only needed for 100+ users.

## 3. Create the OAuth client ID — type **Desktop app**
1. Open https://console.cloud.google.com/auth/clients → **Create client**.
2. **Application type:** **Desktop app** · **Name:** `hidayah-desktop` → **Create**.
3. In the dialog click **Download JSON** (file name like `client_secret_XXXX.json`). Keep it private.

## 4. Sign in — on YOUR computer (Windows PowerShell), not Cloud Shell
The sign-in uses a loopback callback: Google sends your browser to `http://127.0.0.1:<port>`, which is **the computer
running the browser**. So the script must run on that same computer. (Running it in Cloud Shell, SSH or a cloud
container is why the earlier attempt showed `ERR_CONNECTION_REFUSED` — and the old script had no listener at all.)

Needs Node.js 18+ (`node --version`; install from https://nodejs.org if missing) and the repo:
```powershell
git clone https://github.com/Mohammed-Ilyas-AI/Hidaya-One.git
cd Hidaya-One
git checkout ccr-d1d7aea4-2cxbd2
node scripts/youtube-auth.mjs --client "$HOME\Downloads\client_secret_949220497714-0rf236asgeec867se3ov23k67gi5buqd.apps.googleusercontent.com.json"
# then close PowerShell, open a new one, cd Hidaya-One, and prove the token survives a restart:
node scripts/youtube-auth.mjs --verify
```
The script:
1. starts a listener on `127.0.0.1` with a free port and confirms it is listening,
2. opens your browser — sign in as the **YouTube channel owner**, pick the Hidayah channel, **Allow**
   ("Google hasn't verified this app" → **Advanced → Go to …** is expected for your own tool),
3. the tab says **"Hidaya One is signed in ✔"**,
4. checks access **read-only** (prints your channel name), and saves the refresh token to
   `%USERPROFILE%\.hidayah\youtube-token.json` (an existing file is never overwritten; a dated copy is made instead).
No code, token or secret is printed. Nothing is uploaded. If Windows Firewall asks about Node.js, **Allow on private networks**
is not required — the listener only accepts 127.0.0.1 — you can click Cancel.

## 5. Publishing stays off (DRAFT_ONLY)
The publisher refuses to upload unless `HIDAYAH_PUBLISH_MODE=PRIVATE_UPLOAD` is set. Even then it uploads **private** only.

## 6. Using the token from the cloud pipeline (later, when you decide)
Open `%USERPROFILE%\.hidayah\youtube-token.json` in Notepad and copy `refresh_token`; take `client_id` and
`client_secret` from your client JSON. Add them in the environment's settings (session title bar → environment → Edit →
Environment variables) as `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN` — never in chat.

**Security notes.** These three values let a program upload to your channel; anyone with access to this
environment's settings can read environment variables. Revoke any time at https://myaccount.google.com/permissions
(remove "Hidayah Publisher") or by deleting the client in step 3. For production on Cloud Run, store them in
Secret Manager instead (the publisher reads the same variable names).

## What the publisher will and won't do
- Uploads **private only** (explicit `privacyStatus: "private"`); scheduled Shorts use `publishAt` and stay private until that time.
- Never uploads the same Short twice (ledger `registry/published.json` + a hidden tag checked on the channel).
- Default quota is 100 uploads/day — far above our 3/day.
