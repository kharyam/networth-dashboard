import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Calendar, Award, AlertCircle } from 'lucide-react'
import { equityApi } from '@/services/api'
import type { EquityGrant } from '@/types'
import MarketStatus from '@/components/MarketStatus'
import PriceRefreshControls from '@/components/PriceRefreshControls'

interface EquityGrantWithValue extends EquityGrant {
  current_price?: number
  vested_value: number
  unvested_value: number
  total_value: number
}

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
    <div className="metric-card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
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
                {Math.abs(change)}% from last refresh
              </span>
            </div>
          )}
        </div>
        <div className="p-3 bg-primary-50 dark:bg-primary-900 rounded-lg">
          <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>
      </div>
    </div>
  )
}

function EquityGrantCard({ grant }: { grant: EquityGrantWithValue }) {
  const vestedPercentage = grant.total_shares > 0 ? (grant.vested_shares / grant.total_shares) * 100 : 0
  const hasPrice = grant.current_price && grant.current_price > 0
  
  return (
    <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {grant.company_symbol || 'Unknown'} - {grant.grant_type.toUpperCase()}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Grant ID: {grant.grant_id || `#${grant.id}`}
          </p>
          {grant.grant_date && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Granted: {new Date(grant.grant_date).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="text-right">
          {hasPrice ? (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400">Current Price</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                ${grant.current_price?.toFixed(2)}
              </p>
            </>
          ) : (
            <div className="flex items-center text-yellow-600 dark:text-yellow-400">
              <AlertCircle className="w-4 h-4 mr-1" />
              <span className="text-sm">No Price</span>
            </div>
          )}
        </div>
      </div>

      {/* Vesting Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Vesting Progress</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {vestedPercentage.toFixed(1)}% vested
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className="bg-green-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${vestedPercentage}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
          <span>{grant.vested_shares.toLocaleString()} vested</span>
          <span>{grant.unvested_shares.toLocaleString()} unvested</span>
        </div>
      </div>

      {/* Values Grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Vested Value</p>
          <p className="text-lg font-semibold text-green-600 dark:text-green-400">
            ${grant.vested_value.toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Unvested Value</p>
          <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">
            ${grant.unvested_value.toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Value</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            ${grant.total_value.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Strike Price for Options */}
      {grant.grant_type === 'stock_options' && grant.strike_price && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500 dark:text-gray-400">Strike Price:</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              ${grant.strike_price.toFixed(2)}
            </span>
          </div>
          {hasPrice && grant.current_price! > grant.strike_price && (
            <div className="flex justify-between items-center mt-1">
              <span className="text-sm text-gray-500 dark:text-gray-400">In-the-Money:</span>
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                ${(grant.current_price! - grant.strike_price).toFixed(2)} per share
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Equity() {
  const [grants, setGrants] = useState<EquityGrantWithValue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEquityGrants = async () => {
    try {
      const data = await equityApi.getAll()
      
      // Calculate values for each grant using existing current_price from database
      const grantsWithValues = data.map((grant) => {
        const current_price = grant.current_price || 0
        
        // Calculate values based on grant type
        let vested_value = 0
        let unvested_value = 0
        
        if (current_price > 0) {
          if (grant.grant_type === 'stock_options' && grant.strike_price) {
            // For options, value is (current_price - strike_price) * shares
            const optionValue = Math.max(0, current_price - grant.strike_price)
            vested_value = grant.vested_shares * optionValue
            unvested_value = grant.unvested_shares * optionValue
          } else {
            // For RSUs/RSAs, value is current_price * shares
            vested_value = grant.vested_shares * current_price
            unvested_value = grant.unvested_shares * current_price
          }
        }
        
        return {
          ...grant,
          current_price,
          vested_value,
          unvested_value,
          total_value: vested_value + unvested_value
        }
      })
      
      setGrants(grantsWithValues)
      setError(null)
    } catch (error) {
      console.error('Failed to fetch equity grants:', error)
      setError('Failed to load equity grants')
    }
  }

  const handleRefreshComplete = async () => {
    await fetchEquityGrants() // Refresh grants with new prices
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await fetchEquityGrants()
      setLoading(false)
    }
    
    loadData()
  }, [])

  // Calculate totals
  const totalVestedValue = grants.reduce((sum, grant) => sum + grant.vested_value, 0)
  const totalUnvestedValue = grants.reduce((sum, grant) => sum + grant.unvested_value, 0)
  const totalEquityValue = totalVestedValue + totalUnvestedValue
  const totalVestedShares = grants.reduce((sum, grant) => sum + grant.vested_shares, 0)
  const totalUnvestedShares = grants.reduce((sum, grant) => sum + grant.unvested_shares, 0)

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Equity Compensation</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Track your RSUs, stock options, and vesting schedules
          </p>
          <div className="mt-3">
            <MarketStatus showDetails={true} />
          </div>
        </div>
        
        {/* Price Status and Refresh */}
        <PriceRefreshControls onRefreshComplete={handleRefreshComplete} />
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Equity Value"
          value={totalEquityValue}
          icon={DollarSign}
        />
        <MetricCard
          title="Vested Value"
          value={totalVestedValue}
          icon={Award}
          change={2.4}
          changeType="positive"
        />
        <MetricCard
          title="Unvested Value"
          value={totalUnvestedValue}
          icon={Calendar}
        />
        <MetricCard
          title="Total Shares"
          value={`${(totalVestedShares + totalUnvestedShares).toLocaleString()}`}
          icon={TrendingUp}
          prefix=""
        />
      </div>

      {/* Equity Grants */}
      {grants.length > 0 ? (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Your Equity Grants</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {grants.map((grant) => (
              <EquityGrantCard key={grant.id} grant={grant} />
            ))}
          </div>
        </div>
      ) : (
        <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="text-center py-12">
            <Award className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No equity grants found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Add equity grants through Manual Entry to track your vesting schedule and current values.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default Equity