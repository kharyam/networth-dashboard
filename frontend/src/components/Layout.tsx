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
  X
} from 'lucide-react'

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
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Top header spanning full width */}
      <div className="fixed top-0 left-0 right-0 z-30 h-16 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between h-full px-4 sm:px-6">
          {/* Left side - Logo and mobile menu */}
          <div className="flex items-center">
            <button
              className="lg:hidden mr-4"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6 text-gray-400" />
            </button>
            
            {/* Logo visible on mobile */}
            <div className="flex items-center lg:hidden">
              <DollarSign className="w-8 h-8 text-primary-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">NetWorth</span>
            </div>
          </div>
          
          {/* Right side - User info and actions */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-4">
              <div className="text-right">
                <p className="text-xs text-gray-500">
                  Last updated: {new Date().toLocaleString()}
                </p>
              </div>
              
              <button className="btn-primary text-sm px-3 py-1.5">
                Refresh Data
              </button>
            </div>
            
            {/* User profile */}
            <div className="flex items-center space-x-3 border-l border-gray-200 pl-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-primary-600 text-sm font-medium">U</span>
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">User</p>
                  <p className="text-xs text-gray-500">Personal Dashboard</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 pt-16 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Logo in sidebar for desktop */}
        <div className="hidden lg:flex items-center justify-between h-16 px-6 border-b border-gray-200 -mt-16 bg-white">
          <div className="flex items-center">
            <DollarSign className="w-8 h-8 text-primary-600" />
            <span className="ml-2 text-xl font-bold text-gray-900">NetWorth</span>
          </div>
        </div>

        {/* Close button for mobile */}
        <div className="lg:hidden flex justify-end p-4 -mt-4">
          <button
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-6 h-6 text-gray-400" />
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
                      ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon
                    className={`mr-3 flex-shrink-0 h-5 w-5 ${
                      isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-500'
                    }`}
                  />
                  {item.name}
                </Link>
              )
            })}
          </div>
        </nav>

      </div>

      {/* Main content */}
      <div className="lg:pl-64 pt-16">
        {/* Page content - now perfectly aligned with sidebar */}
        <main className="flex-1">
          <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout