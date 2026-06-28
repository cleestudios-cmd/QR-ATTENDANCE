# QR Attendance System — Full System Spec

## 1. System Overview

Web-based attendance system with two interfaces sharing one backend:
- **Admin Dashboard** — class/student management, session control, monitoring, export
- **Scanner Interface** — camera-based QR scanning, locked to an active session

**Stack**
- Frontend: React + Vite
- Backend/DB/Auth: Supabase (Postgres)
- Hosting: Vercel (frontend) + Supabase (managed backend)
- QR generate: `qrcode`
- QR scan: `html5-qrcode`
- PDF (QR cards): `pdf-lib` or `jsPDF`
- Excel export: `xlsx` (SheetJS)
- Excel import (roster): `xlsx` or `papaparse` (if CSV)

---

## 2. User Roles & Permissions

| Role | Access |
|---|---|
| **Admin** | Full dashboard: create/edit classes, import students, generate QR, start/end sessions, monitor, export |
| **Scanner Device** | No login. Opens a session-scoped link, can only scan + log attendance for that active session. No access to dashboard/data. |

No student-side login/account — students only hold a printed/saved QR.

---

## 3. Full Page / Screen Map

### Admin Dashboard
1. **Login** — Supabase Auth (email/password)
2. **Classes Overview** — list of classes, create new class button, per-class quick stats (total students, last session date)
3. **Class Detail Page**
   - Tab: Students — list, import (Excel upload + validation preview), individual add/edit/delete
   - Tab: QR Codes — generate/download all QR PDFs (batch, multi-page)
   - Tab: Sessions — history of past sessions (date, time started/ended, attendance count)
   - Tab: Live Monitor — real-time feed during an active session (see §6.3)
4. **Start Session Modal** — confirms class, generates session token + scanner link/QR
5. **Export Page/Modal** — pick session(s) or date range → download .xlsx

### Scanner Interface (separate route, no admin UI visible)
1. **Session Landing** (`/scan/:sessionToken`) — validates token; if invalid/expired, shows "Session ended/invalid"
2. **Scanner Screen** — camera view, last-scan feedback (✅ name + time / ❌ duplicate / ❌ invalid QR), running count of logged students

---

## 4. Database Schema (Supabase/Postgres)

```sql
-- Admins (handled by Supabase Auth, no custom table needed unless multi-admin roles)

create table classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete cascade,
  full_name text not null,
  qr_token uuid not null default gen_random_uuid() unique, -- static, encoded in QR
  created_at timestamptz default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete cascade,
  session_token text not null unique, -- random string, used in scanner URL
  started_at timestamptz default now(),
  ended_at timestamptz, -- null = still active
  is_active boolean default true
);

create table attendance_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,
  time_in timestamptz default now(), -- server timestamp, not client
  unique (session_id, student_id) -- prevents duplicate scan within same session
);
```

**Key constraints doing the heavy lifting:**
- `qr_token` unique → no fake/duplicate QR collision
- `(session_id, student_id)` unique → DB-level duplicate scan protection (backs up app-level cooldown)
- `session_token` unique + `is_active` flag → only one valid scanner link per session, dies on "End Session"

---

## 5. Core Flows (step-by-step)

### 5.1 Class Setup
1. Admin → Classes → "Create Class" → enters name → insert into `classes`
2. Admin → Class Detail → Students tab → upload Excel
3. **Validation preview** before commit: check required column (full_name) present, flag duplicate names, show row count → admin confirms → bulk insert into `students` (each gets auto `qr_token`)
4. Admin → QR Codes tab → "Generate All" → generates QR image per student encoding `qr_token` → compiles into one multi-page PDF (1 student per page, name printed under QR) → download

### 5.2 Session Start (the fraud-prevention layer)
1. Admin → Class Detail → Sessions tab → "Start Session"
2. Backend: set any previous active session for this class to `is_active = false`, create new row in `sessions` with fresh `session_token`
3. System generates scanner link: `yourapp.com/scan/{session_token}`
4. Admin opens that link **on the physical scanning device** (tablet/phone at the door) — not projected to the whole class
5. Scanner page validates token server-side on load; if `is_active = false` or token not found → "Session invalid"

### 5.3 Scanning
1. Scanner device camera reads QR → decodes `qr_token`
2. Lookup: does `qr_token` exist in `students` table AND belong to this session's `class_id`?
   - No → ❌ "Invalid QR / wrong class"
3. Attempt insert into `attendance_logs` (`session_id`, `student_id`, server `time_in`)
   - Unique constraint violation → ❌ "Already logged" (duplicate)
   - Success → ✅ show student name + time_in, increment counter
4. App-level: disable camera input for ~2-3 sec after each successful scan (prevents rapid double-fire before DB confirms)
5. **Offline case:** if no network response, queue scan locally (student_id + local timestamp flagged "pending"), retry on reconnect, sync once online — UI shows "queued, syncing..." instead of false success

### 5.4 Live Monitor (Admin side, during active session)
- Real-time list (Supabase Realtime subscription on `attendance_logs`) showing who just got logged, running present count vs total roster

### 5.5 Session End
1. Admin clicks "End Session" → `is_active = false`, `ended_at = now()`
2. Scanner link immediately stops working (any further scan attempts on that token rejected)

### 5.6 Export
1. Admin → Export → pick class + session(s) or date range
2. Query: full student roster **LEFT JOIN** attendance_logs for selected session(s) — ensures absent students appear too (time_in = blank/"Absent")
3. Generate `.xlsx`: columns = Class Name, Student Name, Date, Time In, Status (Present/Absent)
4. Download

---

## 6. Security Model Summary

| Risk | Mitigation |
|---|---|
| Fake/guessed QR | Random UUID token, not student ID/name |
| Shared/screenshotted QR used by non-owner | Physical control — scanner device guarded by admin/proctor at entry point, not public-facing |
| Replayed old session link | `session_token` invalidated on End Session / new Start Session |
| Double-scan / race condition | App-level cooldown + DB unique constraint (belt and suspenders) |
| Manipulated client-side timestamp | All `time_in` values from Postgres `now()`, never client clock |
| Bad import data | Validation/preview step before bulk insert |

---

## 7. Suggested Folder Structure

```
/src
  /admin
    ClassesOverview.jsx
    ClassDetail.jsx
    StudentsImport.jsx
    QrGenerator.jsx
    SessionControl.jsx
    LiveMonitor.jsx
    ExportPanel.jsx
  /scanner
    SessionLanding.jsx
    ScannerScreen.jsx
  /lib
    supabaseClient.js
    qrUtils.js
    exportUtils.js
  /routes (react-router setup)
```

---

## 8. Build Order (phased, matches your build → test → wire → persist pattern)

1. Supabase project + schema (run SQL above) — test with manual inserts via Supabase Studio
2. Admin: Class CRUD (no auth yet) — test create/list/delete
3. Admin: Excel import + validation preview — test with sample roster files
4. QR generation (single student) — test scan with phone before batch
5. QR batch → multi-page PDF — test download/print
6. Sessions: start/end logic + token generation — test link validity manually
7. Scanner page: camera + decode (no DB write yet) — test decode accuracy
8. Wire scanner → `attendance_logs` insert + duplicate/cooldown handling — test double-scan scenario
9. Offline queue handling — test airplane mode scan
10. Live Monitor (Realtime subscription) — test with 2 devices simultaneously
11. Export with absent-student logic — test against partial attendance
12. Supabase Auth on admin routes — lock down dashboard
13. Polish UI/UX, deploy to Vercel

---

*Next step: drafting test cases per module before implementation, based on this spec.*
