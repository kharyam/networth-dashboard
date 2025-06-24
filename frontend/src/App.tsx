import { Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@/contexts/ThemeContext'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Accounts from '@/pages/Accounts'
import Stocks from '@/pages/Stocks'
import Equity from '@/pages/Equity'
import RealEstate from '@/pages/RealEstate'
import ManualEntry from '@/pages/ManualEntry'
import MyEntries from '@/pages/MyEntries'
import Credentials from '@/pages/Credentials'
import Settings from '@/pages/Settings'

function App() {
  return (
    <ThemeProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/stocks" element={<Stocks />} />
          <Route path="/equity" element={<Equity />} />
          <Route path="/real-estate" element={<RealEstate />} />
          <Route path="/manual-entry" element={<ManualEntry />} />
          <Route path="/my-entries" element={<MyEntries />} />
          <Route path="/credentials" element={<Credentials />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </ThemeProvider>
  )
}

export default App