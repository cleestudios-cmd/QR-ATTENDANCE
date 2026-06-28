import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import QRCode from 'qrcode'

export default function QrTest() {
  const [student, setStudent] = useState(null)
  const [qrDataUrl, setQrDataUrl] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data, error } = await supabase.from('students').select('*').eq('full_name', 'Alice Johnson').single()
        if (!mounted) return
        if (error) return console.error(error)
        setStudent(data)
        const url = await QRCode.toDataURL(data.qr_token, { width: 300 })
        if (mounted) setQrDataUrl(url)
      } catch (e) {
        console.error(e)
      }
    })()
    return () => { mounted = false }
  }, [])

  if (!student) return <div className="p-4 text-center">Loading student...</div>

  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <h1 className="text-xl font-bold">{student.full_name}</h1>
      <img src={qrDataUrl} alt="QR Code" />
      <p className="text-sm text-gray-500 break-all max-w-sm text-center">
        Token: {student.qr_token}
      </p>
    </div>
  )
}