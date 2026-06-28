import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import * as XLSX from 'xlsx'

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

    const { data: session } = await supabase.from('sessions').select('*').eq('id', selectedSession).single()

    const { data: roster } = await supabase
      .from('students')
      .select(`
        full_name,
        attendance_logs!left(time_in)
      `)
      .eq('class_id', classId)
      .eq('attendance_logs.session_id', selectedSession)

    if (!roster) return setLoading(false)

    const exportData = roster.map(s => ({
      'Class Name': className,
      'Student Name': s.full_name,
      'Date': new Date(session.started_at).toLocaleDateString(),
      'Time In': s.attendance_logs?.[0]?.time_in
        ? new Date(s.attendance_logs[0].time_in).toLocaleTimeString()
        : '',
      'Status': s.attendance_logs?.[0]?.time_in ? 'Present' : 'Absent'
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance')
    XLSX.writeFile(wb, `attendance-${selectedSession.slice(0, 8)}.xlsx`)

    setLoading(false)
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
