import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../lib/supabaseClient'

export default function ScannerScreen({ onScan, classId = null, activeSession = null }) {
  // State
  const [started, setStarted] = useState(false)
  const [status, setStatus] = useState({ kind: 'idle', message: 'Ready to scan' })
  const [lastStudent, setLastStudent] = useState(null)
  const [containerId] = useState(() => `qr-reader-${Math.random().toString(36).slice(2)}`)
  const containerRef = useRef(null)
  const html5QrCodeRef = useRef(null)
  const lastScanRef = useRef(0)

  // Queue state
  const queueKey = `qr-queue-${classId || 'default'}`
  const [queuedCount, setQueuedCount] = useState(0)
  const [queuedItems, setQueuedItems] = useState([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(queueKey)
      const q = raw ? JSON.parse(raw) : []
      // avoid synchronous setState inside effect body
      setTimeout(() => {
        setQueuedItems(q)
        setQueuedCount(q.length)
      }, 0)
    } catch {
      setTimeout(() => {
        setQueuedItems([])
        setQueuedCount(0)
      }, 0)
    }
  }, [queueKey])

  // UI helpers
  const [qrBoxSize, setQrBoxSize] = useState(250)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  // Queue persistence helpers
  const loadQueue = useCallback(() => {
    try {
      const raw = localStorage.getItem(queueKey)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }, [queueKey])

  const saveQueue = useCallback((q) => {
    try { localStorage.setItem(queueKey, JSON.stringify(q)) } catch { /* ignore localStorage errors */ }
  }, [queueKey])

  const enqueueScan = useCallback((payload) => {
    const q = loadQueue()
    q.push({ id: crypto.randomUUID(), payload, ts: Date.now() })
    saveQueue(q)
    setStatus({ kind: 'queued', message: `Scan queued (${q.length})` })
    setQueuedCount(q.length)
    setQueuedItems(q)
  }, [loadQueue, saveQueue])

  const flushQueue = useCallback(async () => {
    const q = loadQueue()
    if (!q.length) return
    setStatus({ kind: 'working', message: `Flushing ${q.length} queued scans...` })
    const remaining = []
    for (const item of q) {
      const { decodedText } = item.payload
      // attempt lookup + insert similar to live flow
      const { data: student, error: studentErr } = await supabase
        .from('students')
        .select('id, full_name, class_id')
        .eq('qr_token', decodedText)
        .maybeSingle()

      if (studentErr || !student || student.class_id !== classId) {
        // keep item for later retry
        remaining.push(item)
        continue
      }

      const { error: insertErr } = await supabase
        .from('attendance_logs')
        .insert({ session_id: activeSession.id, student_id: student.id })

      if (insertErr) {
        // keep if network-like or unknown error; drop on duplicate
        const msg = (insertErr && insertErr.message) || ''
        if (msg.toLowerCase().includes('duplicate') || (insertErr.code === '23505')) {
          // duplicate — don't requeue
          continue
        }
        remaining.push(item)
      }
    }
    saveQueue(remaining)
    setQueuedCount(remaining.length)
    setQueuedItems(remaining)
    setStatus({ kind: remaining.length ? 'queued' : 'success', message: remaining.length ? `Queued remaining: ${remaining.length}` : 'All queued scans sent' })
  }, [activeSession, classId, loadQueue, saveQueue])

  const clearQueue = () => {
    saveQueue([])
    setQueuedItems([])
    setQueuedCount(0)
    setStatus({ kind: 'idle', message: 'Queue cleared' })
  }

  const retryItem = async (itemId) => {
    const q = loadQueue()
    const item = q.find(i => i.id === itemId)
    if (!item) return
    const { decodedText } = item.payload
    // attempt lookup + insert
    const { data: student, error: studentErr } = await supabase
      .from('students')
      .select('id, full_name, class_id')
      .eq('qr_token', decodedText)
      .maybeSingle()

    if (studentErr || !student || student.class_id !== classId) {
      setStatus({ kind: 'error', message: 'Retry failed: lookup' })
      return
    }

    const { error: insertErr } = await supabase
      .from('attendance_logs')
      .insert({ session_id: activeSession.id, student_id: student.id })

    if (insertErr) {
      const msg = (insertErr && insertErr.message) || ''
      if (msg.toLowerCase().includes('duplicate') || (insertErr.code === '23505')) {
        // remove from queue
        const remaining = q.filter(i => i.id !== itemId)
        saveQueue(remaining)
        setQueuedItems(remaining)
        setQueuedCount(remaining.length)
        setStatus({ kind: 'duplicate', message: `${student.full_name} already logged` })
        return
      }
      setStatus({ kind: 'error', message: `Retry insert failed: ${insertErr.message || insertErr}` })
      return
    }

    // success: remove item
    const remaining = q.filter(i => i.id !== itemId)
    saveQueue(remaining)
    setQueuedItems(remaining)
    setQueuedCount(remaining.length)
    setStatus({ kind: 'success', message: `${student.full_name} recorded (retried)` })
  }

  // Responsive QR box sizing
  useEffect(() => {
    const compute = () => {
      const el = containerRef.current || (containerId ? document.getElementById(containerId) : null)
      if (!el) return
      const w = el.clientWidth || window.innerWidth
      const size = Math.max(180, Math.min(420, Math.floor(w * 0.75)))
      setQrBoxSize(size)
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [started, containerId])

  // Torch support detection
  const checkTorchSupport = useCallback(() => {
    try {
      const video = (containerRef.current && containerRef.current.querySelector('video')) || (containerId ? document.querySelector(`#${containerId} video`) : null)
      const stream = video?.srcObject
      const track = stream?.getVideoTracks && stream.getVideoTracks()[0]
      if (!track) return setTorchAvailable(false)
      const caps = track.getCapabilities ? track.getCapabilities() : {}
      if (caps && caps.torch) setTorchAvailable(true)
      else setTorchAvailable(false)
    } catch {
      setTorchAvailable(false)
    }
  }, [containerId])

  useEffect(() => {
    if (!started) {
      setTimeout(() => {
        setTorchAvailable(false)
        setTorchOn(false)
      }, 0)
      return
    }
    const id = setTimeout(() => checkTorchSupport(), 700)
    return () => clearTimeout(id)
  }, [started, checkTorchSupport])

  const toggleTorch = async () => {
    try {
      const video = (containerRef.current && containerRef.current.querySelector('video')) || (containerId ? document.querySelector(`#${containerId} video`) : null)
      const stream = video?.srcObject
      const track = stream?.getVideoTracks && stream.getVideoTracks()[0]
      if (!track) return setStatus({ kind: 'error', message: 'Torch not available' })
      const caps = track.getCapabilities ? track.getCapabilities() : {}
      if (!caps.torch) return setStatus({ kind: 'error', message: 'Torch not supported' })
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] })
      setTorchOn(t => !t)
      setStatus({ kind: 'success', message: `Torch ${!torchOn ? 'enabled' : 'disabled'}` })
    } catch (e) {
      setStatus({ kind: 'error', message: `Torch error: ${e?.message || e}` })
    }
  }

  // Main scanner start/stop and decode logic
  useEffect(() => {
    if (!started) return

    // ensure containerId exists
    if (!containerId) return
    const elementId = containerId
    const html5QrCode = new Html5Qrcode(elementId)
    html5QrCodeRef.current = html5QrCode

    const qrSuccess = async (decodedText) => {
      // debounce rapid scans
      if (Date.now() - lastScanRef.current < 1200) return
      lastScanRef.current = Date.now()

      setStatus({ kind: 'scanned', message: `Scanned: ${decodedText}` })
      if (onScan) onScan(decodedText)

      // If no session/class provided, just surface scan
      if (!activeSession || !classId) return

      setStatus({ kind: 'working', message: 'Looking up student...' })

      const { data: student, error: studentErr } = await supabase
        .from('students')
        .select('id, full_name, class_id')
        .eq('qr_token', decodedText)
        .maybeSingle()

      if (studentErr) {
        setStatus({ kind: 'error', message: 'Lookup error' })
        return
      }

      if (!student) {
        setStatus({ kind: 'error', message: 'No student found for this QR' })
        return
      }

      if (student.class_id !== classId) {
        setStatus({ kind: 'error', message: 'QR not for this class' })
        return
      }

      setStatus({ kind: 'working', message: `Recording ${student.full_name}...` })

      try {
        const { error: insertErr } = await supabase
          .from('attendance_logs')
          .insert({ session_id: activeSession.id, student_id: student.id })

        if (insertErr) {
          const msg = (insertErr && insertErr.message) || ''
          if (msg.toLowerCase().includes('duplicate') || (insertErr.code === '23505')) {
            setStatus({ kind: 'duplicate', message: `${student.full_name} already logged` })
            setLastStudent(student)
            return
          }
          // network/other error — enqueue for retry
          enqueueScan({ decodedText, studentId: student.id })
          setLastStudent(student)
          return
        }

        setLastStudent(student)
        setStatus({ kind: 'success', message: `${student.full_name} recorded` })
      } catch {
        // unexpected error — enqueue
        enqueueScan({ decodedText, studentId: student.id })
        setLastStudent(student)
      }
    }

    const qrError = () => {
      // non-fatal decode errors; ignore or surface briefly
    }

    html5QrCode.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: qrBoxSize, height: qrBoxSize }, aspectRatio: 1.0 },
      qrSuccess,
      qrError
    ).catch(e => {
      setTimeout(() => setStatus({ kind: 'error', message: `Camera error: ${e?.message || e}` }), 0)
    })

    return () => {
      html5QrCode.stop().then(() => html5QrCode.clear()).catch(() => {})
    }
  }, [started, activeSession, classId, onScan, qrBoxSize, containerId, enqueueScan])

  // Flush queue when we become online
  useEffect(() => {
    const handleOnline = () => { flushQueue() }
    window.addEventListener('online', handleOnline)
    // Attempt an initial flush if online (defer to avoid setState in effect)
    if (navigator.onLine) setTimeout(() => flushQueue(), 0)
    return () => { window.removeEventListener('online', handleOnline) }
  }, [activeSession, classId, flushQueue])

  const handleRetryNow = () => { flushQueue() }

  


  // Auto-start on mount
  useEffect(() => {
    // defer status/state changes to avoid synchronous setState in effect
    const id = setTimeout(() => {
      setStatus({ kind: 'starting', message: 'Requesting camera access...' })
      setStarted(true)
    }, 120)
    return () => clearTimeout(id)
  }, [])

  return (
    <div className="max-w-xl mx-auto p-4">
      <div className="rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <div>
            <h3 className="text-lg font-semibold">Scanner</h3>
            <div className="text-sm opacity-90">Scan QR to record attendance</div>
          </div>
          <div className="text-right">
            <div className="text-sm">{lastStudent ? lastStudent.full_name : ''}</div>
            <div className="text-xs opacity-80">{lastStudent ? 'Last scanned' : ''}</div>
          </div>
        </div>

        <div className="p-4 bg-gray-50">
          <div className="relative">
                  <div id={containerId || undefined} ref={containerRef} style={{ minHeight: 320 }} className={`rounded-lg overflow-hidden`} />

            {/* Overlay box to indicate scanning area */}
            <style>{`
              @keyframes pulseOutline { 0% { box-shadow: 0 0 0 0 rgba(99,102,241,0.6);} 70% { box-shadow: 0 0 0 12px rgba(99,102,241,0);} 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0);} }
            `}</style>
              {started && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div style={{ width: qrBoxSize, height: qrBoxSize }} className="relative">
                    <div className="absolute inset-0 rounded-lg border-4 border-indigo-400" style={{ boxSizing: 'border-box', animation: 'pulseOutline 1500ms infinite' }} />
                    <div className="absolute inset-3 border-dashed border-2 border-white rounded-md opacity-60" />
                  </div>
                </div>
              )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-2">
              {torchAvailable ? (
                <button onClick={toggleTorch} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg shadow-md ${torchOn ? 'bg-yellow-400 text-black' : 'bg-gray-800 text-white'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M11 1a1 1 0 00-2 0v1H7a1 1 0 00-.8.4L4.2 6A1 1 0 004 7v3a4 4 0 008 0V7a1 1 0 00-.2-.6L13 2.4A1 1 0 0012 2h-1V1z" /></svg>
                  {torchOn ? 'Torch On' : 'Torch'}
                </button>
              ) : null}
            </div>

            <div className="text-sm text-gray-600">&nbsp;</div>
          </div>

          <div className="mt-4">
            <div className="inline-flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${status.kind === 'success' ? 'bg-green-100 text-green-800' : status.kind === 'error' ? 'bg-red-100 text-red-800' : status.kind === 'queued' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{status.message}</span>
              {queuedCount > 0 && (
                <button onClick={handleRetryNow} className="ml-2 bg-green-600 text-white px-3 py-1 rounded-lg text-sm">Retry queued ({queuedCount})</button>
              )}
            </div>
          </div>

          {queuedItems.length > 0 && (
            <div className="mt-4 bg-white border rounded-lg p-3 shadow-sm">
              <div className="font-semibold mb-2">Queued scans</div>
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {queuedItems.map(item => (
                  <li key={item.id} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{item.payload.decodedText}</div>
                      <div className="text-xs text-gray-500">{new Date(item.ts).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => retryItem(item.id)} className="bg-blue-600 text-white px-3 py-1 rounded">Retry</button>
                      <button onClick={() => { const remaining = loadQueue().filter(i => i.id !== item.id); saveQueue(remaining); setQueuedItems(remaining); setQueuedCount(remaining.length); }} className="bg-red-500 text-white px-3 py-1 rounded">Remove</button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                <button onClick={clearQueue} className="bg-gray-600 text-white px-3 py-1 rounded">Clear queue</button>
              </div>
            </div>
          )}

          {!activeSession && (
            <div className="mt-4 text-yellow-600">No active session provided — scan events will only be emitted via <code>onScan</code>.</div>
          )}
        </div>
      </div>
    </div>
  )
}
