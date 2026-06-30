import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
  const [studentHasGenderCol, setStudentHasGenderCol] = useState(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data: cls } = await supabase.from('classes').select('name').eq('id', classId).single()
        if (mounted && cls) setClassName(cls.name)
      } catch {
        // ignore
      }

      try {
        const { data: studs } = await supabase.from('students').select('*').eq('class_id', classId).order('full_name')
        if (mounted && studs) setStudents(studs)
      } catch {
        // ignore
      }

      try {
        const { data: sess } = await supabase.from('sessions').select('*').eq('class_id', classId).order('started_at', { ascending: false })
        if (mounted && sess) {
          setSessions(sess)
          setActiveSession(sess.find(s => s.is_active) || null)
        }
      } catch {
        // ignore
      }

      // detect whether students.gender column exists (so import can include it)
      try {
        const { data, error } = await supabase.from('students').select('gender').limit(1)
        if (!mounted) return
        if (error) {
          console.debug('gender column check via students select -> error', error)
          setStudentHasGenderCol(false)
        } else {
          console.debug('gender column check via students select -> data', data)
          setStudentHasGenderCol(true)
        }
      } catch {
        if (mounted) {
          console.debug('gender column check unexpected error')
          setStudentHasGenderCol(false)
        }
      }
    })()
    return () => { mounted = false }
  }, [classId])

  const navigate = useNavigate()

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
      const genderColIdx = headerRow.findIndex(h => String(h).toLowerCase().includes('gender') || String(h).toLowerCase().includes('sex'))
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
        const genderVal = (genderColIdx !== -1) ? (rows[i][genderColIdx] || '') : ''
        const gender = genderVal ? String(genderVal).trim() : ''
        parsed.push({ full_name: name, gender })
      }

      setPreview({ rows: parsed, errors })
    }
    reader.readAsArrayBuffer(file)
  }

  async function confirmImport() {
    if (!preview || preview.rows.length === 0) return
    const includeGender = studentHasGenderCol === true
    const inserts = preview.rows.map(r => {
      const base = { class_id: classId, full_name: r.full_name }
      if (includeGender) base.gender = r.gender || null
      return base
    })

    const { error } = await supabase.from('students').insert(inserts)
    if (error) return alert('Import error: ' + error.message)
    if (!includeGender) alert('Import succeeded but the `gender` column does not exist in the database; gender values were not saved.')
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <button onClick={() => navigate('/admin/classes')} className="mr-3 bg-gray-200 px-3 py-1 rounded back-button">Back</button>
          <span className="text-2xl font-bold">{className || 'Class'}</span>
        </div>
        <div>
          <button
            onClick={async () => {
              if (!confirm(`Delete class "${className}" and all related students and sessions? This is irreversible.`)) return
              try {
                const { data: sessions } = await supabase.from('sessions').select('id').eq('class_id', classId)
                const sessionIds = (sessions || []).map(s => s.id)
                if (sessionIds.length) {
                  await supabase.from('attendance_logs').delete().in('session_id', sessionIds)
                  await supabase.from('sessions').delete().in('id', sessionIds)
                }
                await supabase.from('students').delete().eq('class_id', classId)
                await supabase.from('classes').delete().eq('id', classId)
                navigate('/admin/classes')
              } catch (err) {
                alert('Delete failed: ' + (err?.message || err))
              }
            }}
            className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
          >
            Delete Class
          </button>
        </div>
      </div>

      {/* Import Section */}
      <div className="border rounded p-4 mb-6">
        <h2 className="font-semibold mb-2">Import Students</h2>
        <div className="mb-3">
          <button
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mr-3"
          >
            Import File
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
        </div>

        {preview && (
          <div>
            {preview.errors.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mb-3 text-sm text-yellow-800">
                {preview.errors.map((err, i) => <div key={i}>{err}</div>)}
              </div>
            )}
            {studentHasGenderCol === false && preview.rows.some(r => r.gender) && (
              <div className="bg-red-50 border border-red-200 rounded p-2 mb-3 text-sm text-red-800">
                Warning: your database does not have a `gender` column on `students`. Gender values will not be saved. To store gender, add a `gender` column to the `students` table.
              </div>
            )}
            {preview.rows.length > 0 && (
              <>
                <p className="text-sm text-gray-600 mb-2">{preview.rows.length} students ready to import</p>
                <div className="max-h-40 overflow-y-auto border rounded mb-3">
                  <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left p-2">Name</th>
                          {preview.rows[0] && preview.rows[0].gender !== undefined && <th className="text-left p-2">Gender</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((r, i) => (
                          <tr key={i} className="border-t">
                            <td className="p-2">{r.full_name}</td>
                            {r.gender !== undefined && <td className="p-2">{r.gender}</td>}
                          </tr>
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
              Scanner URL: <a href={`${window.location.origin}/scan/${activeSession.session_token}`} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">{window.location.origin}/scan/{activeSession.session_token}</a>
            </p>
            <div className="mt-2">
              <a href={`${window.location.origin}/scan/${activeSession.session_token}`} target="_blank" rel="noopener noreferrer" className="inline-block bg-green-600 text-white px-3 py-1 text-sm rounded hover:bg-green-700 mr-2">Open Scanner</a>
              <button
                onClick={async () => {
                  try {
                    const url = `${window.location.origin}/scan/${activeSession.session_token}`
                    await navigator.clipboard.writeText(url)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  } catch (e) {
                    alert('Copy failed: ' + (e?.message || e))
                  }
                }}
                className="inline-block bg-gray-200 text-gray-800 px-3 py-1 text-sm rounded hover:bg-gray-300"
              >
                Copy Link
              </button>
              {copied && <span className="ml-2 text-sm text-green-700">Copied!</span>}
            </div>
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
      {(() => {
        const males = students.filter(s => String(s.gender || '').toLowerCase() === 'male').sort((a,b) => a.full_name.localeCompare(b.full_name))
        const females = students.filter(s => String(s.gender || '').toLowerCase() === 'female').sort((a,b) => a.full_name.localeCompare(b.full_name))
        const others = students.filter(s => !(['male','female'].includes(String(s.gender || '').toLowerCase()))).sort((a,b) => a.full_name.localeCompare(b.full_name))
        return (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">Male ({males.length})</div>
              <ul className="space-y-1">
                {males.map(s => <li key={s.id} className="border rounded p-2 text-sm">{s.full_name}</li>)}
              </ul>
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Female ({females.length})</div>
              <ul className="space-y-1">
                {females.map(s => <li key={s.id} className="border rounded p-2 text-sm">{s.full_name}</li>)}
              </ul>
            </div>
            {others.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Other/Unknown ({others.length})</div>
                <ul className="space-y-1">
                  {others.map(s => <li key={s.id} className="border rounded p-2 text-sm">{s.full_name}</li>)}
                </ul>
              </div>
            )}
          </div>
        )
      })()}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}