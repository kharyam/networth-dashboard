import { useTheme } from '@/contexts/ThemeContext'

function Stocks() {
  const { isDarkMode } = useTheme()

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Stock Holdings</h1>
        <p className={`mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          View and manage your stock portfolio across all platforms
        </p>
      </div>
      
      <div className={`card ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'} mb-4`}>Stock Consolidation</h3>
        <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          This page will contain consolidated stock holdings and portfolio analytics in the next phase.
        </p>
      </div>
    </div>
  )
}

export default Stocks