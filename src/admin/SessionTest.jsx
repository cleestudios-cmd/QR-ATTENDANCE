import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function SessionTest() {
  const [sessionUrl, setSessionUrl] = useState('')

  async function startSession() {
    const { data: classData } = await supabase.from('classes').select('id').limit(1).maybeSingle()
    if (!classData) return alert('No class found')

    // Deactivate any previously active sessions for this class
    await supabase.from('sessions').update({ is_active: false })
      .eq('class_id', classData.id)
      .eq('is_active', true)

    const sessionToken = crypto.randomUUID()
    const { data, error } = await supabase.from('sessions').insert({
      class_id: classData.id,
      session_token: sessionToken,
      is_active: true
    }).select().single()

    if (error) return alert('Error: ' + error.message)
    setSessionUrl(`${window.location.origin}/scan/${data.session_token}`)
  }

  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <h1 className="text-xl font-bold">Session Test</h1>
      <button
        onClick={startSession}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Start Test Session
      </button>
      {sessionUrl && (
        <div className="mt-4 p-4 bg-gray-100 rounded break-all max-w-lg text-center">
          <a href={sessionUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-sm text-blue-700 underline">{sessionUrl}</a>
          <div className="mt-2">
            <a href={sessionUrl} target="_blank" rel="noopener noreferrer" className="inline-block bg-green-600 text-white px-3 py-1 rounded">Open Scanner</a>
          </div>
        </div>
      )}
    </div>
  )
}