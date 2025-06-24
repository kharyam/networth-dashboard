import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  DollarSign, 
  PieChart, 
  TrendingUp, 
  Building, 
  Briefcase,
  Edit3,
  Settings,
  Menu,
  X,
  Sun,
  Moon
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'

interface LayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: PieChart },
  { name: 'Accounts', href: '/accounts', icon: Briefcase },
  { name: 'Stocks', href: '/stocks', icon: TrendingUp },
  { name: 'Equity Comp', href: '/equity', icon: DollarSign },
  { name: 'Real Estate', href: '/real-estate', icon: Building },
  { name: 'Manual Entry', href: '/manual-entry', icon: Edit3 },
  { name: 'Settings', href: '/settings', icon: Settings },
]

function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { isDarkMode, toggleTheme } = useTheme()
  const location = useLocation()

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Top header spanning full width */}
      <div className={`fixed top-0 left-0 right-0 z-30 h-16 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b shadow-sm`}>
        <div className="flex items-center justify-between h-full px-4 sm:px-6">
          {/* Left side - Logo and mobile menu */}
          <div className="flex items-center">
            <button
              className="lg:hidden mr-4"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className={`w-6 h-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
            </button>
            
            {/* Logo visible on mobile */}
            <div className="flex items-center lg:hidden">
              <DollarSign className="w-8 h-8 text-primary-600" />
              <span className={`ml-2 text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>NetWorth</span>
            </div>
          </div>
          
          {/* Right side - User info and actions */}
          <div className="flex items-center space-x-4">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-colors duration-200 ${
                isDarkMode 
                  ? 'bg-gray-700 hover:bg-gray-600 text-yellow-400' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
              }`}
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <div className="hidden sm:flex items-center space-x-4">
              <div className="text-right">
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Last updated: {new Date().toLocaleString()}
                </p>
              </div>
              
              <button className="btn-primary text-sm px-3 py-1.5">
                Refresh Data
              </button>
            </div>
            
            {/* User profile */}
            <div className={`flex items-center space-x-3 border-l ${isDarkMode ? 'border-gray-600' : 'border-gray-200'} pl-4`}>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-primary-600 text-sm font-medium">U</span>
                </div>
                <div className="hidden sm:block">
                  <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>User</p>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Personal Dashboard</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main layout container with flexbox */}
      <div className="flex pt-16">
        {/* Sidebar */}
        <aside className={`w-64 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg transform transition-transform duration-300 ease-in-out lg:transform-none lg:shadow-none lg:border-r ${isDarkMode ? 'lg:border-gray-700' : 'lg:border-gray-200'} ${
          sidebarOpen ? 'translate-x-0 fixed inset-y-0 left-0 z-50 pt-16' : '-translate-x-full lg:translate-x-0'
        }`}>
          {/* Logo in sidebar for desktop */}
          <div className={`hidden lg:flex items-center justify-between h-16 px-6 border-b ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} -mt-16`}>
            <div className="flex items-center">
              <DollarSign className="w-8 h-8 text-primary-600" />
              <span className={`ml-2 text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>NetWorth</span>
            </div>
          </div>

          {/* Close button for mobile */}
          <div className="lg:hidden flex justify-end p-4 -mt-4">
            <button
              onClick={() => setSidebarOpen(false)}
            >
              <X className={`w-6 h-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'}`} />
            </button>
          </div>

          <nav className="px-3 mt-6">
            <div className="space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                      isActive
                        ? isDarkMode 
                          ? 'bg-primary-900 text-primary-300 border-r-2 border-primary-500'
                          : 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                        : isDarkMode
                          ? 'text-gray-300 hover:bg-gray-700 hover:text-white'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <item.icon
                      className={`mr-3 flex-shrink-0 h-5 w-5 ${
                        isActive 
                          ? isDarkMode ? 'text-primary-400' : 'text-primary-600'
                          : isDarkMode 
                            ? 'text-gray-400 group-hover:text-gray-300' 
                            : 'text-gray-400 group-hover:text-gray-500'
                      }`}
                    />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </nav>
        </aside>

        {/* Main content */}
        <main className={`flex-1 lg:min-h-screen ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          <div className="px-4 sm:px-6 lg:px-8 mt-6 pb-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout