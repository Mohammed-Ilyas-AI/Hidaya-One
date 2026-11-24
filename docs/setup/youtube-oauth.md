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

## 5. Publish modes (founder decision 2026-11-24: autonomous channel)
`HIDAYAH_PUBLISH_MODE` decides what the publisher does:
- `DRAFT_ONLY` (default when unset): never uploads.
- `PRIVATE_UPLOAD`: uploads private only; never schedules anything public.
- `AUTONOMOUS`: publishes with no per-video approval. `npm run produce -- --daily` fills today's slots
  (07:00, 13:00, 19:30 IST): each Short goes up private with `publishAt`, and YouTube makes it public at the slot.
  Only content whose release gate is `READY_TO_PUBLISH` (verification passed, no QC FAIL) is uploaded; a verse that
  fails is skipped and the next one takes the slot.

**Pause switch:** set `HIDAYAH_PAUSED=1`, or create the file `registry/PAUSE`. Every upload stops until you remove it.
Videos already scheduled stay scheduled on YouTube; change them in YouTube Studio if needed.

## 6. Using the token in production (Cloud Run)
Store the three values in **Secret Manager** (`YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`)
and mount them as environment variables on the Cloud Run job; only the job's service account may read them. Do not
paste them into chat, a repository, or a shared environment's settings. Revoke any time at
https://myaccount.google.com/permissions (remove "Hidayah Publisher") or by deleting the client in step 3.

## What the publisher will and won't do
- Privacy is always explicit, never the API default. AUTONOMOUS: scheduled Shorts are private until `publishAt`, then public; an unscheduled one is public at once. PRIVATE_UPLOAD: private only.
- Never uploads the same Short twice (ledger `registry/published.json` + a hidden tag checked on the channel).
- Default quota is 100 uploads/day — far above our 3/day.
