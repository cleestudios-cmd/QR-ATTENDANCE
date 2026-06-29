# Project Overview — QR-Attendance (School Edition)

Purpose
- A clear, school-focused presentation of the QR-Attendance system tailored for teachers, administrators, and IT staff. This document highlights school workflows, recommended data fields, privacy considerations, deployment tips for classroom use, and an easy teacher onboarding checklist.

What this system does (school summary)
- QR-Attendance is a lightweight single-page web application (SPA) that uses students' QR tokens to record attendance via the device camera in a browser. It's optimized for teachers to start a session, share a short scanner link with devices, and capture attendance quickly without native apps.

School-focused Key Features
- Fast, in-class scanning using phone/tablet cameras (no separate app required).
- Session tokens — teachers create a session for each class period and share a single URL to students.
- Offline resilience: scans persist locally when network fails and auto-retry when back online.
- Live dashboard for teachers to see attendance in real-time.
- Simple exports (Excel/CSV) for SIS import or record-keeping.
- Import students from a spreadsheet and generate printable QR cards for distribution.

Who uses it in a school
- Teacher: starts sessions, monitors live attendance, exports records.
- Proctor / TA: helps students scan, resolves issues, manages queued scans.
- Administrator / Registrar: imports student lists, reviews exported attendance data.
- IT: deploys app, manages Supabase instance and keys, ensures secure hosting.

Recommended Production Data Model (school additions)
- `students` table (examples of useful school columns):
  - `id` (UUID) — primary key
  - `full_name` — student's name
  - `qr_token` — unique QR identifier (string)
  - `student_number` or `roll_no` — school identifier
  - `class_id` — foreign key to `classes`
  - `grade`, `section` — optional
  - `gender` — optional (if used by school)
  - `guardian_contact` — optional (phone or email)
  - `photo_url` — optional photo for verification

- `classes` table:
  - `id`, `name`, `teacher_id`, `period`, `room`

- `sessions` table:
  - `id`, `class_id`, `session_token`, `is_active`, `started_at`, `ended_at`, `teacher_notes`

- `attendance_logs` table:
  - `id`, `session_id`, `student_id`, `time_in`, `status` (present/late/absent), `recorded_by` (optional)

Classroom Workflow (teacher-facing)
1. Teacher logs in to the admin panel and navigates to their class.
2. Teacher clicks **Start Session** — the app generates a `session_token` and marks the session active.
3. Teacher shares the scanner URL (e.g., post to LMS, display on projector, or send by chat/QR on screen).
4. Students open the URL on their phone and scan their personal QR card; the system records `time_in`.
5. Teacher watches `Live Monitor` to confirm attendance. For offline devices or network issues, scanned items are queued locally and automatically retried.
6. At the end of class the teacher clicks **End Session** and exports the attendance to upload into the school's Student Information System (SIS).

Teacher Quick Checklist (daily)
- Ensure class roster is up to date and QR tokens assigned to students.
- Start session at class start and verify the Live Monitor shows scans.
- For any failed scans, use Retry queued items panel.
- End session at class finish and Export attendance with the date and class name in the filename.

Deployment & Hosting Recommendations for Schools
- Host the frontend on a secure static host (Vercel/Netlify) with HTTPS enabled — required for camera access on mobile browsers.
- Use a dedicated Supabase project for the school with separate environment for testing.
- Use the **anon** public key in client and keep the `service_role` key private (server-only) if you add server-side imports or privileged tasks.
- Configure daily backups of the Postgres database and enable audit logs if possible.

Privacy, Security & Policies (important for schools)
- Student data is sensitive. Consider these policies:
  - Avoid storing more personal data than necessary (e.g., avoid storing guardian contacts unless required).
  - Ensure the Supabase project is private and restricted; rotate keys if compromised.
  - If required by local law (GDPR, FERPA, etc.), add a consent capture step and a data retention policy.
  - Use RLS (Row Level Security) and server-side verification if you implement teacher authentication.

Printing QR Cards & Distribution
- Use `Generate QR PDF` in `ClassDetail` to produce print-ready QR cards for each student. Suggestions:
  - Include student name and school ID on card.
  - Laminate cards for durability.
  - If students don't have devices, teacher or proctor can scan student cards centrally.

Operational Tips for Classrooms
- Device selection: modern smartphones perform best; if using tablets or laptops, test camera autofocus and scanning area.
- Lighting: ensure room lighting is sufficient; avoid backlight behind the QR code.
- Network plan: enable teacher device on stable Wi‑Fi; offline queue will help but realtime updates require connectivity.

Integration with SIS (school systems)
- Exports are CSV/XLSX. Map exported columns to your SIS import template (student ID, date, status).
- Consider automating: a small server-side script (using Supabase service role key) can fetch session attendance and push to SIS API nightly.

Accessibility & Inclusive Use
- Large QR codes and printed cards help students with accessibility needs.
- Consider fallback manual attendance entry screen for students unable to scan.

Training Plan (for teachers + admins)
1. Quick demo (10 min): start session, scan 3 sample cards, end session, export.
2. Hands-on practice (20 min): teachers try scanning, practice clearing queues, and exporting.
3. Troubleshooting (10 min): common camera/permission issues and how to resolve.

Onboarding Checklist (school specific)
- [ ] Provision Supabase project and give admin access to IT
- [ ] Upload student roster with QR tokens (or generate tokens and print cards)
- [ ] Deploy frontend to secure HTTPS host and set env variables
- [ ] Run a test class session and verify imports/exports work with your SIS

Troubleshooting Quick Tips (school focus)
- If teacher cannot access camera: verify browser permissions and that the site is loaded over HTTPS.
- If students can't open link on school network: confirm firewall allows outbound requests to Supabase domains.
- If many queued items appear (network outage): instruct teacher to keep device on and reconnect to Wi‑Fi; queued items will flush automatically.

Next Steps and Options for Schools
- Add teacher authentication (email + password or SSO) so sessions are tied to a teacher account.
- Add a reconciliation page for attendance admins to correct records before importing to SIS.
- Add scheduling integration to auto-create sessions for timetable slots.

Contact / How I can help
- I can annotate important files with inline comments to help administrators or local devs understand code paths.
- I can prepare a small `playbook` PDF with step-by-step teacher instructions you can distribute to staff.

---

End of School-Focused Project Overview
