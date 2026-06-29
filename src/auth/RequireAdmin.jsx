import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function RequireAdmin({ children }) {
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        // No DEV override - require real admin account in Supabase

        const { data: userData } = await supabase.auth.getUser()
        const user = userData?.user
        if (!user) {
          navigate('/login', { replace: true })
          return
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle()

        if (error || !profile || !profile.is_admin) {
          navigate('/qr-test', { replace: true })
          return
        }

        if (mounted) setLoading(false)
      } catch (err) {
        navigate('/qr-test', { replace: true })
      }
    })()

    return () => {
      mounted = false
    }
  }, [navigate])

  if (loading) return null
  return children
}
