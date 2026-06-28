# QR-Attendance — Learning Guide

This guide is written for a beginner who wants to understand every major part of this full-stack web system, how pieces connect, and the core functions you'll need to study to build something like this from scratch. It's organized as "batches" — each batch is a self-contained study module, with key definitions, hands-on steps, linked examples from this repository, and short exercises.

Use this as your learning notebook: read a batch, follow the exercises, open the referenced files in the repo, and implement the small changes suggested.

---

**Batch 1 — System Overview & Concepts**

- **Goal:** Understand the big picture: what a full-stack web app is, and where each technology belongs.

- **What's in this project (high level):**
  - Frontend: React app built with Vite, pages/components under `src/`.
  - Backend-as-a-service: Supabase (Postgres database + realtime + auth + client library).
  - Scanner integration: `html5-qrcode` library used in `src/scanner/ScannerScreen.jsx`.
  - Exports: `xlsx` (SheetJS) dynamic import handled in `src/admin/ExportPanel.jsx`.
  - Local fallback: LocalStorage queue (persisting scans while offline) in `ScannerScreen.jsx`.

- **Key definitions:**
  - Frontend: the code that runs in the browser (HTML/CSS/JS). React is a library to build user interfaces declaratively.
  - Backend: the server and database that store and serve data. Here you use Supabase (a hosted Postgres DB with APIs).
  - HTTP / API: client (frontend) calls API endpoints (or uses client SDK) to read/write data.
  - SPA (Single Page App): React front-end that runs client-side routing (this app uses React Router).

- **How they connect:**
  - React components call `supabase` client (in `src/lib/supabaseClient.js`) to read/write the `students`, `sessions`, and `attendance_logs` tables.
  - When a QR is scanned in the browser `html5-qrcode` decodes it and the app either logs attendance via Supabase or persists to a local queue for later flushing.

- **Exercise:** open `src/App.jsx`, `src/scanner/ScannerScreen.jsx`, and `src/lib/supabaseClient.js` in your editor and read how they reference each other.

---

**Batch 2 — Tools & Stack**

- **Vite:** lightweight frontend build tool and dev server. Runs your React app, bundles for production, and supports fast HMR.
  - Commands you use: `npm run dev` (start dev server), `npm run build` (create production build), `npm run preview` (preview build).

- **React:** JavaScript library for building UI. Key concepts:
  - Components: functions that return JSX.
  - Props: inputs to components.
  - State (`useState`), Effects (`useEffect`), and Refs (`useRef`).
  - Component tree and unidirectional data flow.

- **Supabase:** a hosted backend providing Postgres DB, real-time subscriptions, and JS client.
  - You configure the `supabase` client with project keys (see `src/lib/supabaseClient.js`).
  - Use `supabase.from('table').select()` for queries and `.insert()` to write.
  - Realtime subscriptions: `supabase.channel(...).on('postgres_changes', ...)` for INSERT events.

- **Postgres / SQL:** relational database. Learn:
  - Tables, rows, columns
  - Primary keys, foreign keys
  - Basic queries: `SELECT`, `INSERT`, `UPDATE`, `DELETE`
  - Indexes and simple constraints (e.g., unique constraint used to prevent duplicate attendance logs)

- **Other libs:**
  - `html5-qrcode` — reads camera frames and decodes QR codes in browser.
  - `xlsx` — generate Excel files in the browser.
  - `jspdf` and `qrcode` — used to generate QR pdf.
  - `tailwind` (if present) — utility-first CSS framework used for layout.

- **Exercise:** run `npm run dev`, open the app, and inspect browser console and network panel while performing basic actions (view classes, open admin pages).

---

**Batch 3 — Project Structure & Key Files**

Open these files and study them in this order:

1. `src/lib/supabaseClient.js` — where the Supabase client is created and exported.
   - Why: central place for DB/auth config.
2. `src/App.jsx` and `src/main.jsx` — entry points and router config.
3. `src/admin/*` — admin pages (ClassDetail, ExportPanel, LiveMonitor, ClassesOverview).
4. `src/scanner/ScannerScreen.jsx` and `src/scanner/SessionLanding.jsx` — scanning UI and session landing page.
5. `src/index.css` (or global styles) — how styles are applied.

For each file note:
- What components it exports.
- What external services it calls (Supabase, html5-qrcode, xlsx).
- What props it expects.

- **Exercise:** Add a comment at the top of each file you open describing its purpose (one or two lines). This will help you memorize each file's role.

---

**Batch 4 — React Fundamentals (focused on this repo)**

Key concepts and where they appear here:

- `useState`: local component state. Example: `const [started, setStarted] = useState(false)` in `ScannerScreen.jsx`.
- `useEffect`: runs side-effects such as starting the camera, fetching data, or subscribing to realtime updates. Many lint rules warn about dependencies — that's normal.
- `useRef`: holds mutable objects that persist across renders — used for DOM references and library instances (e.g., `html5QrCodeRef`).
- Props drilling: components pass data/actions to children.

Tips for beginners:
- Keep effects focused and idempotent: if code subscribes, return a cleanup function that unsubscribes.
- Avoid heavy synchronous setState inside effects; defer or wrap in conditional checks.
- Use `useCallback` for handlers passed into effects or dependencies.

- **Exercise:** In `src/scanner/ScannerScreen.jsx`, find the effect that starts `Html5Qrcode`. Read it and explain in your own words when the camera starts and how the app handles scan results.

---

**Batch 5 — Database Schema & Data Flow**

Typical tables in this app:
- `classes` — class metadata (id, name, created_at)
- `students` — students with fields: `id`, `full_name`, `class_id`, `qr_token`, `gender` (optional)
- `sessions` — scanning sessions: `id`, `class_id`, `session_token`, `is_active`, `started_at`, `ended_at`
- `attendance_logs` — each scan insertion: `id`, `session_id`, `student_id`, `time_in`

Flow when scanning:
1. `html5-qrcode` decodes QR -> `qrSuccess(decodedText)` handler.
2. Handler looks up `students` by `qr_token` (`supabase.from('students').select(...).eq('qr_token', decodedText)`).
3. If found and class matches, write to `attendance_logs` using `supabase.insert()`.
4. On network errors: the payload is added to a local queue (`localStorage`) to be retried later.
5. When the browser is back online, the app flushes the queue and attempts to insert logs.

- **Exercise:** Inspect `flushQueue` and `enqueueScan` in `ScannerScreen.jsx`. Add console logs to trace queue load/save and retry attempts, then test by turning your network off and scanning a QR on a test device.

---

**Batch 6 — Scanner Implementation Details**

Open `src/scanner/ScannerScreen.jsx` and study these areas:
- Html5Qrcode lifecycle: create instance, `start()` with constraints, `stop()` in cleanup.
- Debounce logic: `lastScanRef` is used to avoid duplicate quick scans.
- Torch support: detect via track capabilities and toggle via `applyConstraints` if supported.
- Overlay UI: scanning box drawn with CSS over the video.
- Queueing: localStorage key `qr-queue-<classId>` stores pending scans.

Important patterns:
- Always clean up camera resources in `useEffect` cleanup: call `stop()` and `clear()`.
- Test on real devices for camera and torch behavior — desktop browsers may not support all features.

- **Exercise:** Add a temporary ``console.debug('QR decoded', decodedText)`` inside the scan handler and test on a phone.

---

**Batch 7 — Exports & File Generation**

Key file: `src/admin/ExportPanel.jsx`
- Uses dynamic import for `xlsx` at runtime to avoid bundling issues with Vite.
- Builds an array-of-arrays (AoA) structure and converts to a worksheet using `XLSX.utils.aoa_to_sheet`.
- Attempts `XLSX.writeFile`, falls back to `XLSX.write` + blob, and finally falls back to building CSV manually.

Notes:
- Generating files in browser often requires `Blob` + `URL.createObjectURL` + simulated anchor click.
- Use dynamic imports `await import('xlsx')` to keep bundle smaller and avoid build-time resolution errors.

- **Exercise:** Run an export for a small session; open browser devtools console and inspect the AoA printed by the debug logs. Try forcing the CSV fallback by simulating a missing XLSX library.

---

**Batch 8 — Realtime & Subscriptions**

Where: `src/admin/LiveMonitor.jsx`
- Supabase provides realtime DB change notifications. The app subscribes to `attendance_logs` INSERTs and appends them to the UI.
- Pattern: subscribe on mount for active session, unsubscribe on cleanup.

Caveats:
- Ensure channel names are unique and removed on cleanup.
- Realtime payloads may not include joined `students` data; sometimes the row returns only student_id — but the app requests `students(full_name, gender)` in the select to include nested data.

- **Exercise:** Simulate another client inserting directly into the DB (Supabase SQL editor) and observe the live monitor update.

---

**Batch 9 — Security & Deployment**

- Don't expose your Supabase service_role key to the client. The client uses anon/public keys for allowed operations. Protect server-side secrets.
- On production deploy, set environment variables for Supabase URL and key.
- Common hosts: Vercel, Netlify, or static hosting serving the built assets and using Supabase as backend.

Deployment checklist:
- Build: `npm run build` (produces `dist` folder)
- Environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (check your `src/lib/supabaseClient.js` to see how keys are read)
- Test camera usage over HTTPS (browsers require secure context for camera)

- **Exercise:** Build the app and serve the `dist` folder locally using `npx serve dist` and open via `https://localhost` (or deploy to Vercel and test there).

---

**Batch 10 — Debugging & Testing**

- Tools to use: browser DevTools (Console, Network, Application/LocalStorage, and Media stream inspector), `supabase` dashboard SQL editor, and logs.
- Patterns:
  - Add `console.debug` around network calls to show payloads and errors.
  - Watch `localStorage` keys (Application tab) for queued scans.
  - Inspect network requests to Supabase: check request payload and response codes.

- **Exercise:** Introduce a deliberate error in `ScannerScreen` (e.g., throw inside `qrSuccess`) and verify that the queueing behavior captures the scan.

---

**Batch 11 — Step-by-step: Build a Minimal Version From Scratch**

This is a condensed path to replicate the core features — scanner + DB logging + queue + export.

1. Initialize project

```bash
mkdir my-attendance
cd my-attendance
npm init -y
npm install react react-dom vite
npm install @supabase/supabase-js html5-qrcode xlsx jspdf qrcode
```

2. Create Vite + React app skeleton (or use `npm create vite@latest`), create `src/main.jsx` and `src/App.jsx`.
3. Add `src/lib/supabaseClient.js` with:

```js
import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
```

4. Implement `ScannerScreen.jsx` minimal flow:
  - Initialize `Html5Qrcode` with container id
  - Start camera on button click or on mount
  - Implement `qrSuccess` handler to `select('id').eq('qr_token', decoded)` then `insert` into `attendance_logs`.
  - Handle errors by saving to `localStorage` queue.

5. Implement queue flush: read `localStorage`, iterate and attempt insert, remove successful items.

6. Add an `ExportPanel` with `import('xlsx')` and build AoA -> `XLSX.utils.aoa_to_sheet` -> `XLSX.writeFile` fallback to CSV.

7. Test locally, iterate.

---

**Batch 12 — What to Learn Next (roadmap & resources)**

- JavaScript fundamentals (ES6+): async/await, promises, modules, arrow functions
- React fundamentals: components, hooks, effects, refs, forms
- Browser APIs: fetch, localStorage, MediaDevices (getUserMedia), Blob/URL
- SQL / Postgres basics: SELECT/INSERT/UPDATE/DELETE, schema design
- Supabase docs: realtime, auth, storage, policies
- Vite and bundling: dev server, production build, environment variables

Recommended resources:
- MDN Web Docs (JS + Web APIs)
- React official docs — start with "Main Concepts"
- Supabase docs — Get started and Realtime
- Postgres basics — free interactive SQL tutorials

---

**Batch 13 — Mapping to This Repo (quick reference)**

- `src/scanner/ScannerScreen.jsx` — scanner lifecycle, queue, torch toggle, overlay, decode handler
- `src/scanner/SessionLanding.jsx` — session landing page that renders `ScannerScreen` for session token
- `src/admin/ClassDetail.jsx` — class management, import students, start/end sessions, QR PDF
- `src/admin/ExportPanel.jsx` — export attendance -> xlsx/csv fallback
- `src/admin/LiveMonitor.jsx` — realtime subscription to logs
- `src/lib/supabaseClient.js` — Supabase client
- `index.html`, `vite.config.js` — Vite entry and config

---

**Batch 14 — Short Exercises to Build Confidence**

1. Add a debug button to `ClassDetail` that fetches and logs the `students` table.
2. Modify `ScannerScreen` to show the raw decoded token in a visible debug panel.
3. Simulate offline: turn off network, scan a QR, check `localStorage` queue, bring network back, verify flush.
4. Add a small unit: export only names of absent students and download as CSV.

---

**Appendix: Useful Commands**

- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Run linter: `npm run lint`
- Build production: `npm run build`

---

If you want, I can also:
- Add inline comments to key files (`src/scanner/ScannerScreen.jsx`, `src/admin/ExportPanel.jsx`) explaining each function line-by-line.
- Create a small `playground` branch with simplified versions of the scanner and export code so you can tinker safely.

File created: [CONTEXT/qr-attendance-learning-guide.md](CONTEXT/qr-attendance-learning-guide.md)
