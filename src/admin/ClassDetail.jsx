import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import * as XLSX from 'xlsx'
import QRCode from 'qrcode'
import { jsPDF } from 'jspdf'
import LiveMonitor from './LiveMonitor'
import ExportPanel from './ExportPanel'

export default function ClassDetail() {
  const { classId } = useParams()
  const [className, setClassName] = useState('')
  const [students, setStudents] = useState([])
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [preview, setPreview] = useState(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    supabase.from('classes').select('name').eq('id', classId).single().then(({ data }) => {
      if (data) setClassName(data.name)
    })
    loadStudents()
    loadSessions()
  }, [classId])

  async function loadStudents() {
    const { data } = await supabase.from('students').select('*').eq('class_id', classId).order('full_name')
    if (data) setStudents(data)
  }

  async function loadSessions() {
    const { data } = await supabase.from('sessions').select('*').eq('class_id', classId).order('started_at', { ascending: false })
    if (data) {
      setSessions(data)
      setActiveSession(data.find(s => s.is_active) || null)
    }
  }

  function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      const workbook = XLSX.read(evt.target.result, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })

      const headerRow = rows[0]
      const nameColIdx = headerRow.findIndex(h => String(h).toLowerCase().includes('full_name') || String(h).toLowerCase().includes('name'))
      if (nameColIdx === -1) {
        setPreview({ rows: [], errors: ['No "full_name" column found in the file'] })
        return
      }

      const parsed = []
      const errors = []
      const seenNames = new Set()

      for (let i = 1; i < rows.length; i++) {
        const val = rows[i][nameColIdx]
        if (!val || !String(val).trim()) {
          errors.push(`Row ${i + 1}: missing full_name`)
          continue
        }
        const name = String(val).trim()
        if (seenNames.has(name.toLowerCase())) {
          errors.push(`Row ${i + 1}: duplicate name "${name}"`)
          continue
        }
        seenNames.add(name.toLowerCase())
        parsed.push({ full_name: name })
      }

      setPreview({ rows: parsed, errors })
    }
    reader.readAsArrayBuffer(file)
  }

  async function confirmImport() {
    if (!preview || preview.rows.length === 0) return
    const inserts = preview.rows.map(r => ({ class_id: classId, full_name: r.full_name }))
    const { error } = await supabase.from('students').insert(inserts)
    if (error) return alert('Import error: ' + error.message)
    setPreview(null)
    loadStudents()
  }

  async function generateQrPdf() {
    const doc = new jsPDF('p', 'mm', 'a4')
    const pageW = 210
    const pageH = 297

    for (let i = 0; i < students.length; i++) {
      if (i > 0) doc.addPage()
      const s = students[i]
      const qrDataUrl = await QRCode.toDataURL(s.qr_token, { width: 200 })

      // Center QR on page
      const qrSize = 80
      const qrX = (pageW - qrSize) / 2
      const qrY = (pageH - qrSize) / 2 - 15
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

      // Name below QR
      doc.setFontSize(14)
      doc.text(s.full_name, pageW / 2, qrY + qrSize + 15, { align: 'center' })
    }

    doc.save(`${className}-qrs.pdf`)
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{className || 'Class'}</h1>

      {/* Import Section */}
      <div className="border rounded p-4 mb-6">
        <h2 className="font-semibold mb-2">Import Students</h2>
        <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="mb-3" />

        {preview && (
          <div>
            {preview.errors.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mb-3 text-sm text-yellow-800">
                {preview.errors.map((err, i) => <div key={i}>{err}</div>)}
              </div>
            )}
            {preview.rows.length > 0 && (
              <>
                <p className="text-sm text-gray-600 mb-2">{preview.rows.length} students ready to import</p>
                <div className="max-h-40 overflow-y-auto border rounded mb-3">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr><th className="text-left p-2">Name</th></tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((r, i) => (
                        <tr key={i} className="border-t"><td className="p-2">{r.full_name}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={confirmImport} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                  Confirm Import
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* QR Code PDF Section */}
      <div className="border rounded p-4 mb-6">
        <h2 className="font-semibold mb-2">QR Codes</h2>
        <p className="text-sm text-gray-600 mb-2">{students.length} students</p>
        <button
          onClick={generateQrPdf}
          disabled={students.length === 0}
          className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
        >
          Generate QR PDF
        </button>
      </div>

      {/* Sessions Section */}
      <div className="border rounded p-4 mb-6">
        <h2 className="font-semibold mb-2">Sessions</h2>

        {activeSession ? (
          <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-sm text-green-800 font-medium">Session active</p>
            <p className="text-xs text-green-600 break-all mt-1">
              Scanner URL: {window.location.origin}/scan/{activeSession.session_token}
            </p>
            <button
              onClick={async () => {
                await supabase.from('sessions').update({ is_active: false, ended_at: new Date().toISOString() }).eq('id', activeSession.id)
                loadSessions()
              }}
              className="mt-2 bg-red-600 text-white px-3 py-1 text-sm rounded hover:bg-red-700"
            >
              End Session
            </button>
          </div>
        ) : (
          <button
            onClick={async () => {
              await supabase.from('sessions').update({ is_active: false }).eq('class_id', classId).eq('is_active', true)
              const token = crypto.randomUUID()
              await supabase.from('sessions').insert({ class_id: classId, session_token: token, is_active: true })
              loadSessions()
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mb-3"
          >
            Start Session
          </button>
        )}

        {sessions.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-600 mb-1">History</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {sessions.map(s => (
                <div key={s.id} className="flex justify-between items-center text-sm border rounded p-2">
                  <span>{new Date(s.started_at).toLocaleDateString()} {new Date(s.started_at).toLocaleTimeString()}</span>
                  <span className={s.is_active ? 'text-green-600 font-medium' : 'text-gray-500'}>
                    {s.is_active ? 'Active' : 'Ended'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ExportPanel classId={classId} className={className} />

      <LiveMonitor classId={classId} activeSession={activeSession} />

      {/* Student List */}
      <h2 className="font-semibold mb-2">Students ({students.length})</h2>
      <ul className="space-y-1">
        {students.map(s => (
          <li key={s.id} className="border rounded p-2 text-sm">{s.full_name}</li>
        ))}
      </ul>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}