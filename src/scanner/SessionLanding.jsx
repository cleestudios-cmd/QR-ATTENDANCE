import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ScannerScreen from './ScannerScreen'
import { supabase } from '../lib/supabaseClient'

export default function SessionLanding() {
  const { sessionToken } = useParams()
  const [loading, setLoading] = useState(true)
  const [activeSession, setActiveSession] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!sessionToken) {
      // defer to avoid synchronous setState in effect
      setTimeout(() => {
        setError('Missing session token in URL')
        setLoading(false)
      }, 0)
      return
    }

    let mounted = true
    // defer to avoid setState sync in effect
    setTimeout(() => setLoading(true), 0)
    supabase
      .from('sessions')
      .select('id, session_token, class_id, is_active')
      .eq('session_token', sessionToken)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!mounted) return
        if (error || !data) {
          setError('Session invalid or not found')
          setLoading(false)
          return
        }
        if (!data.is_active) {
          setError('Session is not active')
          setLoading(false)
          return
        }
        setActiveSession(data)
        setLoading(false)
      })

    return () => { mounted = false }
  }, [sessionToken])

  if (loading) return <div className="p-4">Loading session...</div>
  if (error) return <div className="p-4 text-red-600">{error}</div>

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Scan Attendance</h1>
      <ScannerScreen
        onScan={(text) => console.log('Scanned:', text)}
        classId={activeSession.class_id}
        activeSession={activeSession}
      />
    </div>
  )
}
