import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function LiveMonitor({ classId, activeSession }) {
  const [logs, setLogs] = useState([])
  const [totalStudents, setTotalStudents] = useState(0)

  useEffect(() => {
    if (!activeSession) return
    let mounted = true

    async function init() {
        try {
          const { count } = await supabase.from('students').select('id', { count: 'exact', head: true }).eq('class_id', classId)
          if (mounted) setTotalStudents(count || 0)
        } catch {
          // ignore
        }

      try {
        const { data } = await supabase.from('attendance_logs').select('id, student_id, time_in, students(full_name, gender)').eq('session_id', activeSession.id)
        if (mounted && data) setLogs(data)
      } catch {
        // ignore
      }

      const channel = supabase.channel(`logs-${activeSession.id}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'attendance_logs', filter: `session_id=eq.${activeSession.id}` },
          (payload) => {
            setLogs(prev => [...prev, payload.new])
          }
        )
        .subscribe()
      return () => { if (channel) supabase.removeChannel(channel) }
    }

    init()
    return () => { mounted = false }
  }, [activeSession, classId])

  if (!activeSession) return null

  return (
    <div className="border rounded p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-lg">Live Monitor</h2>
        <div className="text-right">
            <div className="text-2xl font-bold">{logs.length}</div>
            <div className="text-sm text-gray-600">of {totalStudents} present</div>
            <div className="text-xs text-gray-500 mt-1">
              {(() => {
                const m = logs.filter(l => String(l.students?.gender || '').toLowerCase() === 'male').length
                const f = logs.filter(l => String(l.students?.gender || '').toLowerCase() === 'female').length
                return `M: ${m} • F: ${f}`
              })()}
            </div>
          </div>
      </div>

      <div className="max-h-64 overflow-y-auto border rounded">
        <ul className="divide-y">
          {logs.map((log, i) => (
            <li key={log.id || i} className="p-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="font-medium">{log.students?.full_name || 'Unknown'}</div>
                <div className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">{(log.students?.gender || 'U').slice(0,1)}</div>
              </div>
              <div className="text-sm text-gray-600">{new Date(log.time_in).toLocaleTimeString()}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}