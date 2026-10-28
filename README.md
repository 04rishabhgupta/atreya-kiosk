# atreya.ai data-collection kiosk

A full-screen portrait web app that collects three face photos plus a short health form and consent from each participant, for training the atreya.ai metabolic-health model. It is built for low-spec kiosks (2 GB RAM, weak CPU/GPU, slow Wi-Fi). There are no accounts: anyone at the kiosk can use it, and the kiosk forgets everything after each participant.

- **Stack:** Next.js 16 (App Router) with TypeScript and Tailwind 4. Storage is a **Google Apps Script web app** bound to the response Sheet, which writes the row and saves images to Drive. No Google Cloud project, service account or private key is needed.
- **Runtime dependencies (4):** `next`, `react`, `react-dom`, `@mediapipe/tasks-vision` (face detector, loaded only on the camera steps). Dev-only: `typescript`, `@types/react`, `@types/node`, `tailwindcss`, `@tailwindcss/postcss`.
- **Browser:** Chromium 111 or newer, the Next 16 baseline. That covers any Android 7+ device with an updated Chrome or WebView.

```
kiosk browser --multipart--> Next.js /api/submit --JSON + base64 + secret--> Apps Script web app --> Drive folder + Sheet row
              (validation, rate limit, honeypot)                         (lock, dedupe, RAW append)
```

---

## 1. Google setup (Apps Script, about 10 minutes)

Use a **dedicated team Google account** (for example `atreya-data@…`) to own the Sheet, the Drive folder and the script. Files are stored in that account's Drive and count against its storage.

1. **Prepare the Sheet and folder.**
   - Open the response Google Sheet. The script writes to a tab called `Form_Responses`. If the tab is missing it is created with the header row. If headers exist, the script only appends missing headers at the end and never reorders or overwrites existing ones.
   - In the same account's Drive, create a folder, for example "atreya-submissions". Copy its ID, which is the last part of the folder URL.
2. **Add the script.** In the Sheet, open **Extensions → Apps Script**.
   - Replace `Code.gs` with [`apps-script/Code.gs`](apps-script/Code.gs).
   - Go to Project Settings, tick **Show "appsscript.json" manifest file in editor**, and replace that file with [`apps-script/appsscript.json`](apps-script/appsscript.json). This enables the Sheets advanced service, which allows RAW appends that never evaluate formulas. No Cloud console step is needed.
3. **Set the script properties.** Under Project Settings → Script properties, add:
   - `SECRET`: a long random value, for example from `openssl rand -hex 32`.
   - `DRIVE_FOLDER_ID`: the folder ID from step 1.
4. **Deploy.**
   - Go to **Deploy → New deployment → Web app**, with **Execute as: Me** and **Who has access: Anyone**.
   - Authorise the requested permissions (Sheets and Drive).
   - Copy the **Web app URL**, which ends in `/exec`.
   - "Anyone" is required because the Next.js server calls the script without a Google login. The `SECRET` is what stops anyone else from writing to it. The URL and secret live only on the server.
5. **Check it.** Opening the `/exec` URL in a browser should show `{"ok":true,"service":"atreya-kiosk"}`.
6. **Updating the script later:** use **Deploy → Manage deployments → Edit → Version: New version**. This keeps the same URL. A *new deployment* would change the URL.
7. **Lock down access.** Share the Sheet and the folder with **named team accounts only**. Turn off "anyone with the link" sharing, and review the members list every quarter. Uploaded files inherit the folder's sharing and are never made public. The web app's "Anyone" setting does not expose the Sheet or the files.

### Environment variables

Copy `.env.example` to `.env.local` and fill it in:

| Variable | Notes |
|---|---|
| `APPS_SCRIPT_URL` | The Web app `/exec` URL |
| `APPS_SCRIPT_SECRET` | Must match the `SECRET` script property exactly |

All of these are read **only on the server**. Nothing about the backend reaches the browser.

### Apps Script limits to know

- **Speed:** each submission takes about 3–8 s inside the script, mostly Drive file creation. Submissions are serialised by a script lock, so throughput is roughly 8–15 per minute across all kiosks. That is plenty for kiosks seeing one participant every ~3 minutes.
- **Daily runtime quota:** about 90 minutes a day on a consumer Gmail account, which is roughly 700+ submissions, and 6 hours a day on Google Workspace. When the quota is hit, the kiosk shows "service busy" and keeps the photos so Retry works later.
- **Payload:** base64 images (~1.7 MB per submission) are well within Apps Script's limits.

## 2. Run locally

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev                  # http://localhost:3000
```

The camera only works in a secure context. `localhost` counts as one. To test from a tablet on your LAN, use `npx next dev --experimental-https` and accept the self-signed certificate on the tablet.

`GET /api/health` returns `{ ok, configured }`. `configured` means both `APPS_SCRIPT_*` variables are set. Test the script itself through its `/exec` URL (§1, step 5).

Other scripts:

```bash
npm run typecheck   # strict tsc
npm run build       # production build
npm run size        # gzipped first-load JS report (run after build)
```

## 3. Deploy

**Vercel (simplest):**
1. Import the repo.
2. Add the environment variables for Production.
3. Set the function region to **Mumbai (`bom1`)** to keep latency low for Indian kiosks. Apps Script itself runs in Google's US data centres.
4. `app/api/submit` sets `maxDuration = 60`. Check that your plan allows that.

The request body cap is 4 MB, which stays under Vercel's 4.5 MB limit. Three photos come to roughly 0.5–1.2 MB.

**Face detector assets.** `npm run dev` and `npm run build` first run `scripts/copy-mediapipe.mjs`, which copies the MediaPipe WebAssembly runtime from `node_modules` into `public/mediapipe/wasm-<version>/` (git-ignored). The 230 KB BlazeFace model is committed at `public/mediapipe/`. Both are served from the app's own origin with a one-year immutable cache, so each kiosk downloads the ~13.5 MB runtime (~4 MB gzipped) once. The CSP includes `'wasm-unsafe-eval'` so the runtime can compile; it does not allow JavaScript `eval`. The MediaPipe library also tries to send anonymous usage telemetry to `odml.pa.googleapis.com`; the `connect-src 'self'` policy blocks it (one console error per page load, after which the library stops trying), so no data leaves the kiosk. When upgrading `@mediapipe/tasks-vision`, update `MEDIAPIPE_VERSION` in `lib/config.ts` to match (the copy script fails the build if they differ).

**Any Node host:** run `npm ci && npm run build && npm start` behind an HTTPS reverse proxy such as Caddy or nginx. HTTPS is mandatory because of the camera and the HSTS header.

Security headers are set in `next.config.ts`:

- `Permissions-Policy: camera=(self)` (microphone and others denied)
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `nosniff`
- HSTS
- A strict self-only CSP

> Note: the rate limiter and the idempotency cache are in memory, **per server instance**. That is fine for cheap abuse guards. Durable idempotency comes from the Apps Script side (see §7).

## 4. Kiosk setup

**Android tablet (recommended for old hardware)**
- Install Chrome (or Fully Kiosk Browser) and open `https://YOUR-DOMAIN/`.
- **Pre-grant the camera:** open the site once, tap Allow, then check Chrome → Site settings → Camera to confirm the site is listed as allowed.
- Pin the screen (Settings → Security → App pinning), or use Fully Kiosk's kiosk mode with "Launch on boot".
- Face checks use the bundled MediaPipe detector; no Chrome flags are needed. If the detector cannot start on a device, Capture stays disabled and the participant is asked to call staff (there is deliberately no bypass).
- Settings: screen timeout set to never (or keep-awake in Fully Kiosk), auto-rotate off, portrait.

**Linux / Raspberry Pi / ChromeOS-style box (Chromium)**

```bash
chromium \
  --kiosk "https://YOUR-DOMAIN/" \
  --noerrdialogs --disable-infobars --no-first-run \
  --disable-session-crashed-bubble --disable-features=TranslateUI \
  --overscroll-history-navigation=0 --disable-pinch \
  --autoplay-policy=no-user-gesture-required \
```

- **Camera pre-grant without a prompt:** add a managed policy, for example in `/etc/chromium/policies/managed/kiosk.json`:

  ```json
  { "VideoCaptureAllowedUrls": ["https://YOUR-DOMAIN"], "AudioCaptureAllowed": false }
  ```

  Do **not** use `--use-fake-ui-for-media-stream` in production. It auto-grants the camera to every site.
- **Auto-start on boot:** create a systemd user unit, or `~/.config/autostart/kiosk.desktop` with `Exec=` set to the command above. Also disable screen blanking with `xset s off -dpms` or your compositor's equivalent.
- **Windows:** create a shortcut to `chrome.exe --kiosk https://...`, using the same flags and policy (set through the registry or GPO).

## 5. Bundle-size report

Measured with `npm run size` on this build (Next 16.4.2, Turbopack, gzip -9):

| What | Gzipped |
|---|---|
| Next.js + React 19 runtime (framework chunks) | ~130 KB |
| App code (all 6 static screens, both languages, validation) | ~22 KB |
| **First-load JS for `/`** | **~152 KB** |
| Lazy camera chunk (loaded on the camera step, prefetched on the Dos screen) | 5.2 KB |
| Legacy `noModule` polyfills (never downloaded by modern Chromium) | 38.5 KB (not counted) |

**The 120 KB target is not met. The framework floor alone is about 130 KB.** An empty Next 16 / React 19 page already ships more than 120 KB, so the app's own ~22 KB cannot close the gap. The options:

- **Accept ~152 KB (current choice).** Everything is cached after the first visit. On repeat loads the kiosk only fetches HTML.
- **Next 14 with React 18:** about 87 KB framework, so roughly 110 KB total. This needs `CameraView` changed to use `forwardRef`. Next 14 is past end-of-life, so it is not recommended for a health-data app.
- **Trim the app chunk further:** lazy-load the Hindi strings, saving about 4 KB.

Under 4× CPU throttling with 2 s latency and ~50 KB/s, the cold first load took about 17 s, and the whole flow stayed usable afterwards.

## 6. Data-withdrawal runbook

When a participant emails with a **Reference ID** (for example `ATR-2026-7KQ2MZ`):

1. **Find the row.** Open the Sheet → `Form_Responses` and use Ctrl+F for the Reference ID (column O). Note the **Drive Folder Link** (column Q) and the **Submission ID** (column P).
2. **Delete the images.** Open the folder link. It is named `ATR-2026-7KQ2MZ_YYYYMMDD` and holds `front.jpg`, `left.jpg`, `right.jpg` and, if video is enabled, `face_video.webm` (submissions made before consent version 1.1 may also hold `consent_signature.png`). Delete the folder, then **empty the owner account's Drive trash**. Trash auto-purges after 30 days. Delete it manually so removal is immediate.
3. **Delete the row.** Right-click the row number → Delete row. Do not just clear the cells.
4. **Remove downstream copies.** If the data was already exported into a training set, remove it from that dataset and record which model versions included it.
5. **Log and confirm.** Record the Reference ID, the date and who actioned it in a withdrawal log. That log holds no personal data beyond the ID. Reply to the participant to confirm. Aim to finish within 30 days.

If the participant has lost their Reference ID, search by name and timestamp, and verify their identity before deleting anything.

## 7. How a submission works

1. The client sends `POST /api/submit` as `multipart/form-data`. The body holds `data` (JSON), `front`, `left` and `right` (JPEG), `video` (if enabled) and the `website` honeypot field. A `signature` PNG is no longer sent (consent 1.1); one from an older client is still validated and stored.
2. The server runs its guards in this order:
   - Per-IP rate limit (10 per minute)
   - Content-type check
   - Streaming body-size cap (4 MB)
   - Honeypot check (if filled, it returns a fake success and stores nothing)
   - Strict MIME check plus magic-byte check on each file
   - Per-file size limits
   - Full re-validation of every field (`lib/validate.ts`, shared with the client)
3. **The server builds the row** in `SHEET_COLUMNS` order, escapes any cell starting with `=`, `+`, `-` or `@` with an apostrophe, base64-encodes the files, and POSTs everything plus the secret to the Apps Script URL (`lib/appsScript.ts`).
4. **The script stores the submission** (`apps-script/Code.gs`), under a script lock so only one submission is handled at a time:
   1. It checks the secret.
   2. **Already saved?** If the Sheet already contains this Submission ID, it returns the existing Reference ID. This covers a retry after a lost response.
   3. **Folder.** It reuses the folder from an earlier partial attempt, which it remembers in Script Properties until the row is written. Otherwise it creates `ATR-YYYY-XXXXXX_YYYYMMDD`.
   4. **Files.** It creates only the files that are not already in the folder.
   5. **Row.** It appends the row with `Sheets.Spreadsheets.Values.append(..., RAW)`, so nothing is parsed as a formula, a date or a number.

   The Reference ID is derived from the kiosk's UUID `submissionKey`, so a retry always gets the same ID.
5. **Retries.** The server retries up to 4 times within ~50 s, with backoff. It retries on network errors, "busy" replies (lock or quota) and non-JSON replies such as Google quota pages. A wrong secret or a wrong URL fails fast and is not retried.
6. **Errors the client sees:**
   - `400 invalid` + field name: nothing was stored, so the client lets the participant edit and generates a fresh key.
   - `413 too_large`
   - `429 rate_limited`
   - `503 busy`: the client keeps the same key and shows Retry only.
   - `500/502 server`: the client keeps the same key and shows Retry only.

   In every case the participant's photos stay in memory.

**Logs** contain only event names, Reference IDs and error codes, on both the Next.js and the Apps Script side. They never contain names, health values or image bytes.

### Sheet columns

`Timestamp | Patient Name | Age | Gender | Height (cm) | Weight (kgs) | Diabetic Category | HbA1c | FBS (mg/dL)* | RBS | Currently taking any Medicine? | Facial Image - Front | Facial Image - Left | Facial Image - Right` are the existing columns A–N.

These are appended after them: `Reference ID | Submission ID | Drive Folder Link | Consent Version | Consent Timestamp | Signature Link` (columns O–T, 20 columns in total), plus `Face Video` in U when `ENABLE_VIDEO` is on. `Signature Link` is kept so no column shifts; it is empty from consent version 1.1 onwards.

\* Column I is configurable through `COLUMN_I` in `lib/config.ts`. Set it to `null` to hide the field. The cell is then left empty, so no column ever shifts.

## 8. Configuration (`lib/config.ts`)

All tunables live in this one file:

- Consent version, contact email and retention period
- Idle and reset timers
- Camera constraints and JPEG settings
- Check thresholds (brightness, sharpness, motion, face size and centring)
- The shot list and its head-turn directions
- `ENABLE_VIDEO` and the video bitrate cap
- Dropdown options
- Numeric ranges and request limits

All UI copy is in `lib/strings.ts`. The Hindi table is type-checked against the English one, so a missing key fails the build.

**Before go-live:**
- Set `CONTACT_EMAIL` to a monitored inbox. The placeholder `privacy@your-domain.example` is shown to participants as the withdrawal route.
- Have the consent text reviewed by your legal or DPO contact.
- If you change the text, bump `CONSENT_VERSION`.

## 9. QA checklist

**Flow and kiosk behaviour**
- [ ] `/api/health` shows `configured: true` on the deployed URL.
- [ ] Full flow on the actual kiosk hardware, in portrait, at 800×1280 and at 1080×1920.
- [ ] The `/exec` URL returns `{"ok":true}`. A wrong `APPS_SCRIPT_SECRET` makes submissions fail with "server" and writes no row.
- [ ] One real submission. A new row appears with correct IST timestamp, numbers as numbers, and working Drive links. A folder `ATR-…_YYYYMMDD` holds 4 files, and none of them is shared publicly.
- [ ] Tap Submit, kill the Wi-Fi mid-upload, and you get an error with Retry and the edits locked. Restore the Wi-Fi and tap Retry: there is exactly **one** row and **one** folder.
- [ ] Turning airplane mode on during Review leaves the photos intact, and Retry works.
- [ ] Dos screen: Continue is disabled until "I have read this" is ticked.
- [ ] Details: required-field errors appear, and range errors appear (age 130, HbA1c 25). Numeric keypads appear, and names get no autocorrect or auto-capitalisation.
- [ ] Age under 18 switches the age checkbox to the parent/guardian wording.
- [ ] Consent: all statements and the full text are visible; "Agree and continue" is disabled until the single consent box is ticked. The row shows Consent Version `ATR-CONSENT-1.1-…` and a Consent Timestamp.
- [ ] Review: each Edit link goes to its step, and Continue returns straight to Review.
- [ ] Success: the Reference ID is shown, and the kiosk auto-resets after 15 s. Afterwards the camera light is off and Back does not reveal earlier data.
- [ ] 90 s with no touch brings up a 10 s countdown, then the kiosk resets. Tapping "I'm still here" cancels it.
- [ ] "Start over" asks for confirmation, then wipes everything.
- [ ] Hindi toggle: every screen is translated and nothing is clipped.
- [ ] Pinch-zoom, long-press context menu and text selection are all blocked outside inputs.

**Camera**
- [ ] Camera permission denied: the friendly error screen appears and Try again works once permission is allowed.
- [ ] No camera, or camera in use by another app: the matching message appears.
- [ ] Low light shows "Too dark". A lamp behind the participant shows "Too bright". Moving shows "Hold still".
- [ ] Capture is enabled as soon as a face is clearly visible with even light, at any comfortable distance and anywhere in the picture (the oval is a guide only). Nothing captures by itself (`AUTO_CAPTURE` is off): the participant taps Capture.
- [ ] A second person in the frame, too dark/too bright, glare, or one side of the face in shadow (front shot) each disable Capture with their own message. **Calibrate on site:** `sideShadowMax`, `overexposedMax` and the `*ScoreMin` values in `lib/config.ts` were tuned on test images, not real participants.
- [ ] Letting someone step into the frame during the 3-2-1 cancels the countdown.

What is detected and what is not: the detector checks that exactly one face is in the frame and that it is clearly visible (detection confidence); lighting is measured on that face (dark, bright, glare, side shadow). Distance, position in the oval and head turn are **not** enforced; the oval and turn arrows are guidance. **Glasses, masks, caps and hair over the face are not detected** (no lightweight model does this reliably, and a cap check would also flag turbans and headscarves); they are shown as Do/Don't instructions beside the camera. The detector finds faces up to roughly 2 m from the camera; much further away, it reports no face.
- [ ] Backgrounding the tab and returning: the camera resumes and the check loop restarts.
- [ ] Captured JPEGs are 1280 px or less on the long edge, roughly 400 KB or under, and **not** mirrored. Check the Drive file.

**Performance and security**
- [ ] Chrome DevTools: CPU 4× slowdown and network "Slow 3G". The flow is usable, the countdown is accurate and the progress bar moves.
- [ ] `prefers-reduced-motion` on (Android: Remove animations) turns the animations off.
- [ ] Response headers include the CSP, Permissions-Policy, X-Frame-Options and Referrer-Policy. The DevTools console shows no CSP violations.
- [ ] Sheet and Drive folder sharing is limited to named team accounts.

## 10. Project layout

```
app/
  layout.tsx, page.tsx, globals.css, icon.svg
  api/submit/route.ts      validation, abuse guards, row building, hand-off to Apps Script
  api/health/route.ts
components/
  Kiosk.tsx                flow shell: header, step indicator, language toggle, start-over, idle guard
  KioskProvider.tsx        useReducer + Context state (memory only), blob-URL lifecycle
  IdleGuard.tsx, lazy.ts
  screens/                 About, Dos, Capture (lazy), Details, Consent, Review, Success
  camera/                  CameraView (memoised), FaceOverlay, checks.ts (pixel checks, prompt rules, capture),
                           detector.ts (lazy, shared MediaPipe face detector)
  ui/                      Button, ScreenLayout, Dialog, controls, icons
lib/
  config.ts, strings.ts, validate.ts, appsScript.ts, rateLimit.ts, time.ts, submit.ts
apps-script/
  Code.gs, appsscript.json  paste into the Sheet's Extensions > Apps Script
scripts/bundle-size.mjs
```
