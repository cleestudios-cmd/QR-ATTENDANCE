# Stage A — Bugs Found

## Bug 1: SessionTest doesn't deactivate previous active sessions
**File:** `src/admin/SessionTest.jsx` (lines 12-16)  
**Issue:** Starting a new session leaves old active sessions for the same class still active. The spec says: *"set any previous active session for this class to `is_active = false`"*  
**Impact:** Multiple sessions for same class could be active simultaneously, making old scanner links still work.  
**Fix needed:** Add an update query before insert to deactivate previous active sessions.

## Bug 2: `.single()` throws error if multiple classes exist
**File:** `src/admin/SessionTest.jsx` (line 8)  
**Issue:** `supabase.from('classes').select('id').limit(1).single()` throws "multiple rows returned" if more than 1 class exists.  
**Impact:** Session creation crashes after adding a second class.  
**Fix:** Replace `.single()` with `.maybeSingle()`.

## Bug 3: Dead code — `scannerRef` initialized but never read
**File:** `src/scanner/ScannerScreen.jsx` (lines 5, 9)  
**Issue:** `useRef(null)` is created and assigned on line 9 (`scannerRef.current = scanner`) but never used elsewhere. The cleanup function uses the local `scanner` variable via closure instead.  
**Impact:** Unnecessary bloat, but no runtime bug.  
**Fix:** Remove `scannerRef` entirely.

## Bug 4: Success message uses client time, not server time
**File:** `src/scanner/SessionLanding.jsx` (line 49)  
**Issue:** `new Date().toLocaleTimeString()` uses the client's clock, which can be manipulated. The spec requires all timestamps from Postgres `now()`.  
**Impact:** Attendance times could be falsified if client clock is wrong.  
**Fix:** After successful insert, fetch the inserted row's `time_in` from the server and display that.

## Bug 5: `setTimeout` may fire after component unmount
**File:** `src/scanner/ScannerScreen.jsx` (line 17)  
**Issue:** If user navigates away during the 2-second cooldown, `scanner.resume()` fires on an already-stopped scanner instance.  
**Impact:** Console error, but no data corruption.  
**Fix:** Store timeout ID and clear it in the cleanup function (`clearTimeout`).