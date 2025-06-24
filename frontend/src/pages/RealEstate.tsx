import { useTheme } from '@/contexts/ThemeContext'

function RealEstate() {
  const { isDarkMode } = useTheme()

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Real Estate</h1>
        <p className={`mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Manage your property holdings and track equity
        </p>
      </div>
      
      <div className={`card ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-4`}>Property Portfolio</h3>
        <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          This page will contain real estate tracking and valuation in the next phase.
        </p>
      </div>
    </div>
  )
}

export default RealEstate