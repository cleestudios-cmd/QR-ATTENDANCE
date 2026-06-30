import { useEffect, useState } from 'react'

export default function DarkModeToggle() {
  const [dark, setDark] = useState(() => {
    try {
      const v = localStorage.getItem('qr-dark-mode')
      return v === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark-mode')
      localStorage.setItem('qr-dark-mode', '1')
    } else {
      root.classList.remove('dark-mode')
      localStorage.setItem('qr-dark-mode', '0')
    }
  }, [dark])

  return (
    <button
      aria-label="Toggle dark mode"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setDark(d => !d)}
      className={`fixed left-4 bottom-4 z-50 p-3 rounded-full shadow-lg transition-opacity duration-300 bg-white text-gray-800 dark-mode-toggle`}
    >
      {dark ? '🌙' : '☀️'}
    </button>
  )
}
