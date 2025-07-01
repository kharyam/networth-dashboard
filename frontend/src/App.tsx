import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@/contexts/ThemeContext'
import Layout from '@/components/Layout'
import ErrorBoundary from '@/components/ErrorBoundary'

// Lazy load all page components for code splitting
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Accounts = lazy(() => import('@/pages/Accounts'))
const Stocks = lazy(() => import('@/pages/Stocks'))
const Equity = lazy(() => import('@/pages/Equity'))
const RealEstate = lazy(() => import('@/pages/RealEstate'))
const CashHoldings = lazy(() => import('@/pages/CashHoldings'))
const CryptoHoldings = lazy(() => import('@/pages/CryptoHoldings'))
const OtherAssets = lazy(() => import('@/pages/OtherAssets'))
const AssetCategories = lazy(() => import('@/pages/AssetCategories'))
const ManualEntries = lazy(() => import('@/pages/ManualEntries'))
const Credentials = lazy(() => import('@/pages/Credentials'))
const API = lazy(() => import('@/pages/API'))
const Settings = lazy(() => import('@/pages/Settings'))

// Loading component for Suspense fallback
const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
  </div>
)

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Layout>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/stocks" element={<Stocks />} />
              <Route path="/equity" element={<Equity />} />
              <Route path="/real-estate" element={<RealEstate />} />
              <Route path="/cash-holdings" element={<CashHoldings />} />
              <Route path="/crypto-holdings" element={<CryptoHoldings />} />
              <Route path="/other-assets" element={<OtherAssets />} />
              <Route path="/asset-categories" element={<AssetCategories />} />
              <Route path="/manual-entries" element={<ManualEntries />} />
              <Route path="/credentials" element={<Credentials />} />
              <Route path="/api" element={<API />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Suspense>
        </Layout>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App