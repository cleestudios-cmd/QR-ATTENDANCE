# Build Plan — Cline (DeepSeek) Prompts, VS Code

Goal: prove the **core loop** works first (QR → scan → log to DB) with dummy data,
before layering real features (import, PDF batch, monitor, export, auth).

Test after EVERY numbered step before moving to the next. Do not chain steps.

---

## STAGE A — Bare-bones working prototype (core loop only)

### A1. Project init
```
Create a new Vite + React project in this folder. Set up Tailwind CSS.
Install @supabase/supabase-js, qrcode, html5-qrcode, react-router-dom.
Create a basic folder structure: /src/admin, /src/scanner, /src/lib.
Do not build any features yet, just the scaffold.
```
**Test:** `npm run dev` runs, blank page loads, no errors.

### A2. Supabase connection
```
Create /src/lib/supabaseClient.js that initializes the Supabase client
using import.meta.env values for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
Create a .env.example file showing these two variables.
```
**Test:** Add real values to your own `.env`, console.log a test query
(e.g. `supabase.from('classes').select('*')`) in App.jsx, confirm no connection error.

> Before this step: manually run the schema SQL (classes, students, sessions,
> attendance_logs tables) in Supabase Studio SQL editor. Add 1 test class and
> 2 test students directly in Supabase Studio table view — no import UI yet.

### A3. QR generator for ONE student (no batch, no PDF yet)
```
Create a page at /src/admin/QrTest.jsx that fetches one student row from
Supabase by a hardcoded student id, then renders that student's qr_token
as a QR code on screen using the qrcode library.
```
**Test:** QR renders on screen. Scan it with your phone's default camera app —
confirm the decoded text matches the qr_token (UUID) from the DB.

### A4. Session creation (manual trigger, no UI polish)
```
Create /src/admin/SessionTest.jsx with a single button "Start Test Session".
On click, insert a new row into the sessions table for the hardcoded class id,
generate a random session_token (use crypto.randomUUID()), set is_active true,
and display the resulting scanner URL as plain text:
/scan/{session_token}
```
**Test:** Click button, confirm new row appears in `sessions` table in Supabase
Studio with correct token and is_active = true.

### A5. Scanner landing + token validation
```
Create route /scan/:sessionToken in /src/scanner/SessionLanding.jsx.
On load, query the sessions table for a row matching that token where
is_active = true. If found, show "Session valid" and the session id.
If not found, show "Session invalid or ended".
```
**Test:** Visit the URL from A4 — see "Session valid". Change one character
in the token in the URL — see "Session invalid".

### A6. Camera scan + decode (no DB write yet)
```
In /src/scanner/ScannerScreen.jsx, add html5-qrcode camera scanning.
On successful decode, just display the raw decoded text on screen
(no database action yet).
```
**Test:** Open on phone browser, scan the QR from A3, confirm the decoded
UUID text matches the student's qr_token exactly.

### A7. Wire scan → attendance log (the core loop closes here)
```
In ScannerScreen.jsx, after decoding a QR:
1. Look up the student by qr_token, confirm they belong to this session's class.
2. Insert a row into attendance_logs with session_id, student_id, time_in
   defaulting to now() server-side.
3. If insert fails due to unique constraint (session_id, student_id),
   show "Already logged" instead of an error.
4. On success, show the student's name and confirm time.
```
**Test:** Scan the test student's QR once → see name + success.
Scan the SAME QR again in the same session → see "Already logged", not a crash.
Check `attendance_logs` table in Supabase Studio — confirm exactly 1 row.

**🎯 Stage A complete = core loop proven.** Class → QR → session →
scan → log → duplicate-blocked. Everything else builds on top of this.

---

## STAGE B — Real features (build after Stage A works end-to-end)

### B1. Class CRUD UI (replace hardcoded class id)
```
Build /src/admin/ClassesOverview.jsx: list existing classes from Supabase,
form to create a new class (name only), insert on submit, refresh list.
```
**Test:** Create 2 classes via UI, confirm both show up and persist on refresh.

### B2. Excel import with validation preview
```
Add an "Import Students" section to the class detail page. Accept an .xlsx
file, parse with the xlsx library, extract a full_name column.
Show a preview table of parsed rows BEFORE inserting, flagging:
- missing full_name values
- duplicate names within the file
Only insert into students table after admin clicks "Confirm Import".
```
**Test:** Import a sample sheet with one duplicate and one blank name —
confirm both get flagged in preview and are not silently inserted.

### B3. Batch QR → multi-page PDF
```
Add a "Generate QR PDF" button on the class detail page. For all students
in this class, generate a QR per student (using their qr_token) and
compile into a single multi-page PDF, one student per page, name printed
below the QR. Trigger download.
```
**Test:** Download PDF, confirm page count matches student count, scan
2-3 random QRs from the printed/PDF version to confirm they still decode correctly.

### B4. Session start/end UI (replace SessionTest.jsx)
```
Replace the manual test button with a proper Sessions tab: "Start Session"
button (disables if one is already active for this class), shows the live
scanner link/QR code to display on the scanning device, "End Session" button
that sets is_active false and ended_at to now().
```
**Test:** Start session, confirm old session (if any) auto-deactivates.
End session, confirm scanner link immediately shows "Session invalid" (re-test A5 logic).

### B5. Offline queue on scanner
```
In ScannerScreen.jsx, if the attendance_logs insert fails due to network error
(not a duplicate-constraint error), store the scan locally (localStorage) as
pending. On reconnect (window 'online' event), retry all pending scans in order.
Show a "queued, syncing..." state in the UI for pending scans.
```
**Test:** Turn on airplane mode, scan a QR, confirm "queued" message.
Turn airplane mode off, confirm it auto-syncs and appears in attendance_logs.

### B6. Live Monitor (Realtime)
```
Add a Live Monitor tab on the class detail page. Subscribe to Supabase
Realtime on attendance_logs filtered by the current active session_id.
Show a running list (name + time) as new scans come in, plus a counter
"X of Y students present".
```
**Test:** Open admin monitor on one device, scan from another device,
confirm the list updates live without refreshing.

### B7. Export with absent students included
```
Build an Export panel: select a class + session, query the full student
roster LEFT JOINed with attendance_logs for that session, generate an
.xlsx with columns Class Name, Student Name, Date, Time In, Status
(Present/Absent based on whether time_in is null), trigger download.
```
**Test:** Export a session where only half the class scanned — confirm
absent students appear with blank Time In and Status = Absent.

### B8. Admin auth
```
Add Supabase Auth (email/password) login screen. Wrap all /admin routes
in a protected route that redirects to login if no active session.
Scanner routes (/scan/:token) remain public/unauthenticated.
```
**Test:** Log out, try visiting an /admin URL directly — confirm redirect
to login. Confirm /scan/:token still works without login.

### B9. Deploy
```
N/A — Cline prompt not needed. Push to GitHub, connect repo to Vercel,
add env vars (Supabase URL/key) in Vercel project settings, deploy.
```
**Test:** Visit live Vercel URL, repeat A3–A7 core loop test on the deployed version.

---

## Notes for working with DeepSeek via Cline
- Keep prompts scoped to ONE file/feature at a time (as above) — DeepSeek
  follows narrow scope better than broad multi-file asks.
- After each step, open the actual file and skim before testing — catch
  obvious DeepSeek mistakes (wrong import paths, unused state) early.
- If a step fails, don't patch on top blindly — ask Cline to explain its
  change first, or revert and re-prompt with more explicit constraints.
