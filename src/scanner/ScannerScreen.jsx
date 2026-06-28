import { useState } from 'react'

export default function ScannerScreen({ onScan }) {
  const [clicked, setClicked] = useState(false)

  return (
    <div className="p-4 border-4 border-blue-500 bg-gray-100" style={{ minHeight: '400px' }}>
      {!clicked ? (
        <button 
          onClick={() => setClicked(true)}
          className="bg-blue-600 text-white px-6 py-3 rounded"
        >
          Start Camera
        </button>
      ) : (
        <div className="text-green-600 text-xl">
          Camera would start here
        </div>
      )}
    </div>
  )
}