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

  useEffect(() => { loadClasses() }, [])

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
            <Link to={`/admin/classes/${c.id}`} className="font-medium text-blue-600 hover:underline">{c.name}</Link>
            <span className="text-sm text-gray-500">{new Date(c.created_at).toLocaleDateString()}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
