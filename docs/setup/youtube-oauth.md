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

## 4. Open Cloud Shell and get the sign-in script
1. Click the **>_** (Activate Cloud Shell) icon at the top right of the Console.
2. In Cloud Shell: **⋮ → Upload** → choose the `client_secret_XXXX.json` you downloaded.
3. Run:
   ```bash
   git clone https://github.com/Mohammed-Ilyas-AI/Hidaya-One.git && cd Hidaya-One && git checkout ccr-d1d7aea4-2cxbd2
   node scripts/youtube-auth.mjs ~/client_secret_*.json
   ```

## 5. Sign in as the channel owner
1. Open the link the script prints, choose the **account that owns the YouTube channel**, pick the
   **Hidayah channel** if asked (brand accounts appear as a separate choice), and click **Allow**.
2. The browser lands on `http://127.0.0.1:8765/?code=…` and says *"This site can't be reached"* — expected.
3. Copy that whole address and paste it into the **Cloud Shell terminal** (not into the chat).
4. The script prints `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`.

## 6. Give the values to the Hidayah environment — never through chat
In Claude Code on the web: the environment menu in the session title bar → **Edit** →
**Environment variables** → add the three lines exactly as printed:
```
YOUTUBE_CLIENT_ID=...
YOUTUBE_CLIENT_SECRET=...
YOUTUBE_REFRESH_TOKEN=...
```
Then start a new session (variables load at start). Tell me "YouTube connected" and I will:
allow `oauth2.googleapis.com` and `www.googleapis.com` on the network (you approve), run a
read-only check (channel name only), then upload the first Short as **private** for your review.

**Security notes.** These three values let a program upload to your channel; anyone with access to this
environment's settings can read environment variables. Revoke any time at https://myaccount.google.com/permissions
(remove "Hidayah Publisher") or by deleting the client in step 3. For production on Cloud Run, store them in
Secret Manager instead (the publisher reads the same variable names).

## What the publisher will and won't do
- Uploads **private only** (explicit `privacyStatus: "private"`); scheduled Shorts use `publishAt` and stay private until that time.
- Never uploads the same Short twice (ledger `registry/published.json` + a hidden tag checked on the channel).
- Default quota is 100 uploads/day — far above our 3/day.
