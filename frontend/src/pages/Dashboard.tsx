import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Briefcase, Building, PieChart } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell } from 'recharts'
import { netWorthApi } from '@/services/api'
import type { NetWorthSummary } from '@/types'

// Mock data for charts
const mockTrendData = [
  { month: 'Jan', value: 245000 },
  { month: 'Feb', value: 248000 },
  { month: 'Mar', value: 252000 },
  { month: 'Apr', value: 247000 },
  { month: 'May', value: 251000 },
  { month: 'Jun', value: 255000 },
]

const mockAllocationData = [
  { name: 'Stocks', value: 45, color: '#3b82f6' },
  { name: 'Real Estate', value: 30, color: '#10b981' },
  { name: 'Cash', value: 15, color: '#f59e0b' },
  { name: 'Other', value: 10, color: '#8b5cf6' },
]

function MetricCard({ 
  title, 
  value, 
  change, 
  changeType, 
  icon: Icon, 
  prefix = '$' 
}: {
  title: string
  value: number | string
  change?: number
  changeType?: 'positive' | 'negative'
  icon: any
  prefix?: string
}) {
  return (
    <div className="metric-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">
            {prefix}{typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {change && (
            <div className={`flex items-center mt-1 ${
              changeType === 'positive' ? 'text-success-600' : 'text-danger-600'
            }`}>
              {changeType === 'positive' ? (
                <TrendingUp className="w-4 h-4 mr-1" />
              ) : (
                <TrendingDown className="w-4 h-4 mr-1" />
              )}
              <span className="text-sm font-medium">
                {Math.abs(change)}% from last month
              </span>
            </div>
          )}
        </div>
        <div className="p-3 bg-primary-50 rounded-lg">
          <Icon className="w-6 h-6 text-primary-600" />
        </div>
      </div>
    </div>
  )
}

function Dashboard() {
  const [netWorth, setNetWorth] = useState<NetWorthSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchNetWorth = async () => {
      try {
        const data = await netWorthApi.getSummary()
        setNetWorth(data)
      } catch (error) {
        console.error('Failed to fetch net worth:', error)
        // Use mock data for now
        setNetWorth({
          net_worth: 250000,
          total_assets: 300000,
          total_liabilities: 50000,
          vested_equity_value: 75000,
          unvested_equity_value: 25000,
          stock_holdings_value: 100000,
          real_estate_equity: 150000,
          last_updated: new Date().toISOString(),
        })
      } finally {
        setLoading(false)
      }
    }

    fetchNetWorth()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Your complete financial overview
        </p>
      </div>

      {/* Net Worth Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Net Worth"
          value={netWorth?.net_worth || 0}
          change={2.4}
          changeType="positive"
          icon={DollarSign}
        />
        <MetricCard
          title="Total Assets"
          value={netWorth?.total_assets || 0}
          change={1.8}
          changeType="positive"
          icon={TrendingUp}
        />
        <MetricCard
          title="Vested Equity"
          value={netWorth?.vested_equity_value || 0}
          change={5.2}
          changeType="positive"
          icon={Briefcase}
        />
        <MetricCard
          title="Real Estate Equity"
          value={netWorth?.real_estate_equity || 0}
          change={0.8}
          changeType="positive"
          icon={Building}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Net Worth Trend */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Net Worth Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis 
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                />
                <Tooltip 
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Net Worth']}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Asset Allocation */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Asset Allocation</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <RechartsPieChart
                  data={mockAllocationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {mockAllocationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </RechartsPieChart>
                <Tooltip formatter={(value: number) => [`${value}%`, 'Allocation']} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {mockAllocationData.map((item) => (
              <div key={item.name} className="flex items-center">
                <div 
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-gray-600">
                  {item.name} ({item.value}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="btn-primary flex items-center justify-center">
            <DollarSign className="w-4 h-4 mr-2" />
            Add Stock Holding
          </button>
          <button className="btn-secondary flex items-center justify-center">
            <Briefcase className="w-4 h-4 mr-2" />
            Update Equity
          </button>
          <button className="btn-secondary flex items-center justify-center">
            <Building className="w-4 h-4 mr-2" />
            Update Property
          </button>
          <button className="btn-secondary flex items-center justify-center">
            <PieChart className="w-4 h-4 mr-2" />
            View Analytics
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-success-500 rounded-full mr-3"></div>
              <span className="text-sm text-gray-900">Updated AAPL stock holding</span>
            </div>
            <span className="text-xs text-gray-500">2 hours ago</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-primary-500 rounded-full mr-3"></div>
              <span className="text-sm text-gray-900">Added new equity grant</span>
            </div>
            <span className="text-xs text-gray-500">1 day ago</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-warning-500 rounded-full mr-3"></div>
              <span className="text-sm text-gray-900">Property value updated</span>
            </div>
            <span className="text-xs text-gray-500">3 days ago</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard