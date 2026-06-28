import { BrowserRouter, Routes, Route } from 'react-router-dom'
import QrTest from './admin/QrTest'
import SessionTest from './admin/SessionTest'
import SessionLanding from './scanner/SessionLanding'
import ClassesOverview from './admin/ClassesOverview'
import ClassDetail from './admin/ClassDetail'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div className="p-4 text-center text-lg">QR Attendance</div>} />
        <Route path="/qr-test" element={<QrTest />} />
        <Route path="/session-test" element={<SessionTest />} />
        <Route path="/scan/:sessionToken" element={<SessionLanding />} />
        <Route path="/admin/classes" element={<ClassesOverview />} />
        <Route path="/admin/classes/:classId" element={<ClassDetail />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
