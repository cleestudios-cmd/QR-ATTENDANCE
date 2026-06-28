import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function LiveMonitor({ classId, activeSession }) {
  const [logs, setLogs] = useState([])
  const [totalStudents, setTotalStudents] = useState(0)

  useEffect(() => {
    if (!activeSession) return

    // Load initial student count
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('class_id', classId)
      .then(({ count }) => setTotalStudents(count || 0))

    // Load existing logs
    supabase.from('attendance_logs').select('student_id, time_in, students(full_name)')
      .eq('session_id', activeSession.id)
      .then(({ data }) => {
        if (data) setLogs(data)
      })

    // Subscribe to new logs
    const channel = supabase.channel(`logs-${activeSession.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance_logs', filter: `session_id=eq.${activeSession.id}` },
        (payload) => {
          setLogs(prev => [...prev, payload.new])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeSession])

  if (!activeSession) return null

  return (
    <div className="border rounded p-4 mb-6">
      <h2 className="font-semibold mb-2">Live Monitor</h2>
      <p className="text-sm text-gray-600 mb-2">{logs.length} of {totalStudents} students present</p>
      <div className="max-h-60 overflow-y-auto border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="text-left p-2">Student</th>
              <th className="text-left p-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => (
              <tr key={log.id || i} className="border-t">
                <td className="p-2">{log.students?.full_name || 'Unknown'}</td>
                <td className="p-2">{new Date(log.time_in).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}