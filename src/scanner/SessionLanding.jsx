import ScannerScreen from './ScannerScreen'

export default function SessionLanding() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Scan Attendance</h1>
      <ScannerScreen onScan={(text) => console.log('Scanned:', text)} />
    </div>
  )
}
