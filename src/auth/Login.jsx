import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const handleSignIn = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setLoading(false)
    if (signInError) {
      setError(signInError.message)
      return
    }
    navigate('/admin/classes')
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('DEV_FORCE_ADMIN')
    navigate('/')
  }

  const enableDevAdmin = () => {
    if (import.meta.env.DEV) {
      localStorage.setItem('DEV_FORCE_ADMIN', '1')
      navigate('/admin/classes')
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl mb-4">Admin Login</h1>
      <form onSubmit={handleSignIn} className="space-y-3">
        <input
          className="w-full p-2 border rounded"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full p-2 border rounded"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 bg-blue-600 text-white rounded" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          <button type="button" className="px-3 py-2 border rounded" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
        {error && <div className="text-red-600">{error}</div>}
      </form>

      {import.meta.env.DEV && (
        <div className="mt-6">
          <div className="text-sm text-gray-600 mb-2">Dev tools</div>
          <button className="px-3 py-2 bg-green-600 text-white rounded" onClick={enableDevAdmin}>
            Create Dev Admin Session
          </button>
        </div>
      )}
    </div>
  )
}
