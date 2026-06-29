import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import QrTest from './admin/QrTest'
import SessionTest from './admin/SessionTest'
import SessionLanding from './scanner/SessionLanding'
import ClassesOverview from './admin/ClassesOverview'
import ClassDetail from './admin/ClassDetail'
import DarkModeToggle from './DarkModeToggle'
import RequireAdmin from './auth/RequireAdmin'
import Login from './auth/Login'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/classes" replace />} />
        <Route path="/qr-test" element={<QrTest />} />
        <Route path="/session-test" element={<SessionTest />} />
        <Route path="/scan/:sessionToken" element={<SessionLanding />} />
        <Route
          path="/admin/classes"
          element={
            <RequireAdmin>
              <ClassesOverview />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/classes/:classId"
          element={
            <RequireAdmin>
              <ClassDetail />
            </RequireAdmin>
          }
        />
        <Route path="/login" element={<Login />} />
      </Routes>
      <DarkModeToggle />
    </BrowserRouter>
  )
}

export default App
