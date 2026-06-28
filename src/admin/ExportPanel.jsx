import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
// Load xlsx dynamically inside the export handler to avoid build-time resolution issues

export default function ExportPanel({ classId, className }) {
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('sessions').select('*').eq('class_id', classId).order('started_at', { ascending: false })
      .then(({ data }) => { if (data) setSessions(data) })
  }, [classId])

  async function handleExport() {
    if (!selectedSession) return alert('Select a session first')
    setLoading(true)
    try {
      // dynamically import xlsx (browser-friendly main package);
      // avoid importing non-existent internal paths like xlsx.dist which Vite may not resolve
      let XLSX = null
      try {
        const mod = await import('xlsx')
        XLSX = mod && (mod.default || mod)
      } catch (e) {
        console.debug('Dynamic import of xlsx failed', e)
        XLSX = null
      }
      const sessionId = selectedSession
      console.debug('Export: sessionId', sessionId, 'classId', classId)
      const { data: session, error: sessionErr } = await supabase.from('sessions').select('*').eq('id', sessionId).single()
      if (sessionErr) throw sessionErr

      // fetch students and session logs separately to build grouped export
      const { data: students = [], error: studentsErr } = await supabase.from('students').select('id, full_name, gender').eq('class_id', classId)
      if (studentsErr) throw studentsErr
      const { data: logs = [], error: logsErr } = await supabase.from('attendance_logs').select('student_id, time_in').eq('session_id', sessionId)
      if (logsErr) throw logsErr

      // Create map of logs keyed by student_id with time_in
      const logMap = new Map()
      ;(logs || []).forEach(l => {
        logMap.set(l.student_id, { time_in: l.time_in })
      })

      const presentIds = new Set((logs || []).map(l => l.student_id))
      const presentCount = presentIds.size
      const absentCount = Math.max(0, (students || []).length - presentCount)

      const males = []
      const females = []
      const others = []

      ;(students || []).forEach(s => {
        const entry = logMap.get(s.id) || {}
        const timeIn = entry.time_in ? new Date(entry.time_in).toLocaleTimeString() : ''
        const row = { name: s.full_name, timeIn }
        const g = String(s.gender || '').toLowerCase()
        if (g === 'male' || g === 'm') males.push(row)
        else if (g === 'female' || g === 'f') females.push(row)
        else others.push(row)
      })

      const sortByName = (a, b) => a.name.localeCompare(b.name)
      males.sort(sortByName)
      females.sort(sortByName)
      others.sort(sortByName)

      // Build sheet with header then side-by-side Male | Female columns
      const aoa = []
      aoa.push(['Class:', className || ''])
      aoa.push(['Date:', session?.started_at ? new Date(session.started_at).toLocaleDateString() : ''])
      aoa.push(['Total Present:', presentCount])
      aoa.push(['Total Absent:', absentCount])
      aoa.push(['Total Students:', (students || []).length])
      aoa.push([])

      // Column headers (Male | Female | Other if present) - only Name and Time In
      if (others.length === 0) {
        aoa.push(['Male', '', 'Female', ''])
        aoa.push(['Name', 'Time In', 'Name', 'Time In'])

        const maxRows = Math.max(males.length, females.length)
        for (let i = 0; i < maxRows; i++) {
          const m = males[i]
          const f = females[i]
          aoa.push([
            m ? m.name : '', m ? m.timeIn : '',
            f ? f.name : '', f ? f.timeIn : ''
          ])
        }
      } else {
        aoa.push(['Male', '', 'Female', '', 'Other', ''])
        aoa.push(['Name', 'Time In', 'Name', 'Time In', 'Name', 'Time In'])
        const maxRows = Math.max(males.length, females.length, others.length)
        for (let i = 0; i < maxRows; i++) {
          const m = males[i]
          const f = females[i]
          const o = others[i]
          aoa.push([
            m ? m.name : '', m ? m.timeIn : '',
            f ? f.name : '', f ? f.timeIn : '',
            o ? o.name : '', o ? o.timeIn : ''
          ])
        }
      }

      const filename = (() => {
        const dateStr = session?.started_at ? new Date(session.started_at).toISOString().slice(0,10) : new Date().toISOString().slice(0,10)
        const safe = (s) => String(s || '').replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '').toLowerCase()
        return `${safe(className || 'class')}-${dateStr}`
      })()
      // Prefer XLSX export when available, otherwise fallback to CSV
      try {
        console.debug('Export debug', { XLSX_type: typeof XLSX, XLSX_keys: Object.keys(XLSX || {}), aoa_length: aoa.length })
        const hasAoA = !!(XLSX && XLSX.utils && typeof XLSX.utils.aoa_to_sheet === 'function')
        console.debug('Export debug hasAoA', hasAoA, 'XLSX.utils_type', typeof (XLSX && XLSX.utils), 'aoa_sample', aoa.slice(0,5))
        if (hasAoA) {
          let ws
          try {
            ws = XLSX.utils.aoa_to_sheet(aoa)
          } catch (inner) {
            console.error('aoa_to_sheet threw', inner, { aoa })
            throw new Error('XLSX.utils.aoa_to_sheet threw: ' + (inner?.message || inner), { cause: inner })
          }
          const hasBookNew = !!(XLSX.utils && typeof XLSX.utils.book_new === 'function')
          const hasAppend = !!(XLSX.utils && typeof XLSX.utils.book_append_sheet === 'function')
          const hasWriteFile = !!(typeof XLSX.writeFile === 'function')
          const hasWrite = !!(typeof XLSX.write === 'function')
          console.debug('Export debug XLSX fns', { hasBookNew, hasAppend, hasWriteFile, hasWrite })
          if (!hasBookNew || !hasAppend) {
            console.warn('XLSX utilities missing book_new/book_append_sheet — falling back to CSV')
            // force fallback to CSV by throwing to outer catch which handles CSV as fallback
            throw new Error('XLSX utils incomplete')
          }
          const wb = XLSX.utils.book_new()
          XLSX.utils.book_append_sheet(wb, ws, 'Attendance')
          try {
            if (hasWriteFile) {
              XLSX.writeFile(wb, `${filename}.xlsx`)
            } else if (hasWrite) {
              const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
              const blob = new Blob([wbout], { type: 'application/octet-stream' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `${filename}.xlsx`
              document.body.appendChild(a)
              a.click()
              a.remove()
              URL.revokeObjectURL(url)
            } else {
              console.warn('No XLSX write functions available, falling back to CSV')
              throw new Error('No XLSX write functions')
            }
          } catch (err) {
            console.debug('XLSX write attempt failed', err)
            throw err
          }
        } else {
          console.debug('XLSX utils missing or incompatible, falling back to CSV')
          // Build CSV from aoa
          const escapeCell = (v) => {
            if (v === null || v === undefined) return ''
            const s = String(v)
            if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"'
            return s
          }
          const csv = aoa.map(row => (row || []).map(escapeCell).join(',')).join('\r\n')
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${filename}.csv`
          document.body.appendChild(a)
          a.click()
          a.remove()
          URL.revokeObjectURL(url)
        }
      } catch (err) {
        console.error('Export write fallback failed', err)
        // surface a richer error message to the user
        const errMsg = (err && (err.message || err.toString())) || 'Unknown error'
        alert('Export failed: ' + errMsg + '\nCheck console for details.')
        throw err
      }
    } catch (err) {
      console.error('Export failed', err)
      alert('Export failed: ' + (err?.message || err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border rounded p-4 mb-6">
      <h2 className="font-semibold mb-2">Export Attendance</h2>
      <div className="flex gap-2 items-end">
        <select
          value={selectedSession}
          onChange={e => setSelectedSession(e.target.value)}
          className="flex-1 border rounded px-3 py-2 text-sm"
        >
          <option value="">Select a session...</option>
          {sessions.map(s => (
            <option key={s.id} value={s.id}>
              {new Date(s.started_at).toLocaleDateString()} — {s.is_active ? 'Active' : 'Ended'}
            </option>
          ))}
        </select>
        <button
          onClick={handleExport}
          disabled={loading || !selectedSession}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 text-sm"
        >
          {loading ? 'Exporting...' : 'Export .xlsx'}
        </button>
      </div>
    </div>
  )
}
