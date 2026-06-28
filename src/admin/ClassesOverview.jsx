import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function ClassesOverview() {
  const [classes, setClasses] = useState([])
  const [name, setName] = useState('')

  async function loadClasses() {
    const { data } = await supabase.from('classes').select('*').order('created_at', { ascending: false })
    if (data) setClasses(data)
  }

  useEffect(() => {
    let mounted = true
    async function fetchClasses() {
      const { data } = await supabase.from('classes').select('*').order('created_at', { ascending: false })
      if (!mounted) return
      if (data) setClasses(data)
    }
    fetchClasses()
    return () => { mounted = false }
  }, [])

  async function createClass(e) {
    e.preventDefault()
    if (!name.trim()) return
    await supabase.from('classes').insert({ name: name.trim() })
    setName('')
    loadClasses()
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Classes</h1>

      <form onSubmit={createClass} className="flex gap-2 mb-6">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Class name"
          className="flex-1 border rounded px-3 py-2"
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Create
        </button>
      </form>

      <ul className="space-y-2">
        {classes.map(c => (
          <li key={c.id} className="border rounded p-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Link to={`/admin/classes/${c.id}`} className="font-medium text-blue-600 hover:underline">{c.name}</Link>
              <span className="text-sm text-gray-500">{new Date(c.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  if (!confirm(`Delete class "${c.name}" and its sessions/students? This cannot be undone.`)) return
                  try {
                    // fetch session ids to remove attendance logs
                    const { data: sessions } = await supabase.from('sessions').select('id').eq('class_id', c.id)
                    const sessionIds = (sessions || []).map(s => s.id)
                    if (sessionIds.length) {
                      await supabase.from('attendance_logs').delete().in('session_id', sessionIds)
                      await supabase.from('sessions').delete().in('id', sessionIds)
                    }
                    await supabase.from('students').delete().eq('class_id', c.id)
                    await supabase.from('classes').delete().eq('id', c.id)
                    loadClasses()
                  } catch (err) {
                    alert('Delete failed: ' + (err?.message || err))
                  }
                }}
                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
              >
                Delete
              </button>
              <Link to={`/admin/classes/${c.id}`} className="text-sm text-gray-500 underline">Open</Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
