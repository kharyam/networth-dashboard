import { useState, useEffect, useMemo } from 'react'
import { Edit2, Eye, Trash2, X } from 'lucide-react'
import { stocksApi, equityApi } from '../services/api'
import { StockHolding, StockConsolidation, EquityGrant } from '../types'
import MarketStatus from '../components/MarketStatus'
import PriceRefreshControls from '../components/PriceRefreshControls'
import EditEntryModal from '../components/EditEntryModal'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

function Stocks() {
  const [stockHoldings, setStockHoldings] = useState<StockHolding[]>([])
  const [consolidatedStocks, setConsolidatedStocks] = useState<StockConsolidation[]>([])
  const [equityGrants, setEquityGrants] = useState<EquityGrant[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'individual' | 'consolidated' | 'equity' | 'institutions'>('consolidated')
  const [error, setError] = useState<string | null>(null)
  
  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<StockHolding | EquityGrant | null>(null)
  const [selectedItemType, setSelectedItemType] = useState<'stock_holding' | 'morgan_stanley' | null>(null)

  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [stocks, consolidated, equity] = await Promise.all([
        stocksApi.getAll(),
        stocksApi.getConsolidated(),
        equityApi.getAll()
      ])
      
      setStockHoldings(stocks)
      setConsolidatedStocks(consolidated)
      setEquityGrants(equity)
    } catch (error) {
      console.error('Failed to load stock data:', error)
      setError('Failed to load stock data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshComplete = async () => {
    await loadAllData() // Reload all data after price refresh
  }

  const closeModals = () => {
    setEditModalOpen(false)
    setViewModalOpen(false)
    setDeleteModalOpen(false)
    setSelectedItem(null)
    setSelectedItemType(null)
  }

  const handleEdit = (item: StockHolding | EquityGrant, type: 'stock_holding' | 'morgan_stanley') => {
    setSelectedItem(item)
    setSelectedItemType(type)
    setEditModalOpen(true)
  }

  const handleView = (item: StockHolding | EquityGrant, type: 'stock_holding' | 'morgan_stanley') => {
    setSelectedItem(item)
    setSelectedItemType(type)
    setViewModalOpen(true)
  }

  const handleDelete = (item: StockHolding | EquityGrant, type: 'stock_holding' | 'morgan_stanley') => {
    setSelectedItem(item)
    setSelectedItemType(type)
    setDeleteModalOpen(true)
  }

  const handleUpdate = async (formData: Record<string, any>) => {
    if (!selectedItem || !selectedItemType) return

    try {
      if (selectedItemType === 'stock_holding') {
        await stocksApi.update((selectedItem as StockHolding).id, formData)
      } else {
        await equityApi.update((selectedItem as EquityGrant).id, formData)
      }
      closeModals()
      await loadAllData()
    } catch (err: any) {
      console.error('Failed to update item:', err)
      setError(err.message || 'Failed to update item. Please try again.')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedItem || !selectedItemType) return

    try {
      if (selectedItemType === 'stock_holding') {
        await stocksApi.delete((selectedItem as StockHolding).id)
      } else {
        await equityApi.delete((selectedItem as EquityGrant).id)
      }
      closeModals()
      await loadAllData()
    } catch (err: any) {
      console.error('Failed to delete item:', err)
      setError(err.message || 'Failed to delete item. Please try again.')
    }
  }

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount == null) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatNumber = (num: number | undefined | null) => {
    if (num == null) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(num)
  }

  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString()
  }

  const getTotalValue = () => {
    const stockValue = consolidatedStocks.reduce((sum, stock) => sum + (stock.total_value || 0), 0)
    const equityValue = equityGrants.reduce((sum, grant) => {
      const currentPrice = 100 // Placeholder - would come from market data
      return sum + (grant.vested_shares * currentPrice)
    }, 0)
    return stockValue + equityValue
  }

  // Calculate institution-based data for pie chart
  const institutionData = useMemo(() => {
    const institutionMap = new Map<string, number>()
    
    // Add stock holdings by institution
    stockHoldings.forEach(holding => {
      const value = holding.market_value || 0
      let institution = holding.institution_name
      
      // Handle missing/empty institution names
      if (!institution || institution.trim() === '') {
        institution = 'Unknown Institution'
      }
      
      institutionMap.set(institution, (institutionMap.get(institution) || 0) + value)
    })
    
    // Add vested equity as a separate "institution"
    const equityValue = equityGrants.reduce((sum, grant) => {
      const currentPrice = 100 // Placeholder - would come from market data
      return sum + (grant.vested_shares * currentPrice)
    }, 0)
    
    if (equityValue > 0) {
      institutionMap.set('Vested Equity', equityValue)
    }
    
    // Convert to array for chart
    return Array.from(institutionMap.entries())
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [stockHoldings, equityGrants])

  // Calculate individual holdings data for pie chart
  const individualHoldingsData = useMemo(() => {
    const holdingsData = stockHoldings
      .filter(holding => (holding.market_value || 0) > 0)
      .map(holding => ({
        name: `${holding.symbol} (${holding.institution_name})`,
        value: holding.market_value || 0,
        symbol: holding.symbol
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10) // Show top 10 holdings only
    
    return holdingsData
  }, [stockHoldings])

  // Group stock holdings by institution
  const stocksByInstitution = useMemo(() => {
    const groups = new Map<string, StockHolding[]>()
    
    stockHoldings.forEach(holding => {
      let institution = holding.institution_name
      
      // Handle missing/empty institution names
      if (!institution || institution.trim() === '') {
        institution = 'Unknown Institution'
      }
      
      if (!groups.has(institution)) {
        groups.set(institution, [])
      }
      groups.get(institution)!.push(holding)
    })
    
    return Array.from(groups.entries())
      .map(([institution, holdings]) => ({
        institution,
        holdings,
        totalValue: holdings.reduce((sum, h) => sum + (h.market_value || 0), 0)
      }))
      .sort((a, b) => b.totalValue - a.totalValue)
  }, [stockHoldings])

  // Colors for pie chart
  const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#be123c', '#059669']

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Stock Holdings</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            View and manage your stock portfolio across all platforms
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading stock data...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Stock Holdings</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            View and manage your stock portfolio across all platforms
          </p>
          <div className="mt-3">
            <MarketStatus showDetails={true} />
          </div>
        </div>
        
        {/* Price Status and Refresh */}
        <PriceRefreshControls onRefreshComplete={handleRefreshComplete} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 p-4 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Portfolio Summary</h3>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <div className="text-sm text-blue-600 dark:text-blue-400">Total Portfolio Value</div>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {formatCurrency(getTotalValue())}
            </div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <div className="text-sm text-green-600 dark:text-green-400">Total Positions</div>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">
              {consolidatedStocks.length + equityGrants.length}
            </div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
            <div className="text-sm text-purple-600 dark:text-purple-400">Institutions</div>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {institutionData.length}
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Institution Pie Chart */}
          {institutionData.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Holdings by Institution</h4>
              <div style={{ width: '100%', height: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={institutionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {institutionData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Value']}
                      labelStyle={{ color: '#374151' }}
                      contentStyle={{
                        backgroundColor: '#f9fafb',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px'
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: '12px' }}
                      formatter={(value) => value}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Individual Holdings Pie Chart */}
          {individualHoldingsData.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Top Individual Holdings</h4>
              <div style={{ width: '100%', height: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={individualHoldingsData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {individualHoldingsData.map((_, index) => (
                        <Cell key={`cell-individual-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), 'Value']}
                      labelStyle={{ color: '#374151' }}
                      contentStyle={{
                        backgroundColor: '#f9fafb',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px'
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: '12px' }}
                      formatter={(value) => value}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('consolidated')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'consolidated'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Consolidated Holdings ({consolidatedStocks.length})
            </button>
            <button
              onClick={() => setActiveTab('individual')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'individual'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Individual Holdings ({stockHoldings.length})
            </button>
            <button
              onClick={() => setActiveTab('equity')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'equity'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Equity Compensation ({equityGrants.length})
            </button>
            <button
              onClick={() => setActiveTab('institutions')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'institutions'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              By Institution ({stocksByInstitution.length})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'consolidated' && (
            <div className="space-y-4">
              {consolidatedStocks.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400">No consolidated stock holdings found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Symbol</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Company</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Shares</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Current Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Market Value</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Unrealized Gains</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Sources</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {consolidatedStocks.map((stock, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {stock.symbol}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {stock.company_name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatNumber(stock.total_shares)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatCurrency(stock.current_price)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatCurrency(stock.total_value)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={stock.unrealized_gains >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                              {formatCurrency(stock.unrealized_gains)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {stock.sources?.length || 0} sources
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'individual' && (
            <div className="space-y-4">
              {stockHoldings.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400">No individual stock holdings found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Symbol</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Company</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Institution</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Shares</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cost Basis</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Current Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Market Value</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Data Source</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {stockHoldings.map((stock) => (
                        <tr key={stock.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {stock.symbol}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {stock.company_name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {stock.institution_name || 'Unknown'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatNumber(stock.shares_owned)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatCurrency(stock.cost_basis)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatCurrency(stock.current_price)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatCurrency(stock.market_value)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              {stock.data_source}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleView(stock, 'stock_holding')}
                                className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleEdit(stock, 'stock_holding')}
                                className="p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(stock, 'stock_holding')}
                                className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'equity' && (
            <div className="space-y-4">
              {equityGrants.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400">No equity compensation found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Grant Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Company</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total Shares</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Vested</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Vested Value</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Unvested</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Unvested Value</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Strike Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Grant Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Data Source</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {equityGrants.map((grant) => (
                        <tr key={grant.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {grant.grant_type}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {grant.company_symbol || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatNumber(grant.total_shares)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400">
                            {formatNumber(grant.vested_shares)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400">
                            {formatCurrency(grant.current_price ? grant.vested_shares * grant.current_price : 0)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 dark:text-orange-400">
                            {formatNumber(grant.unvested_shares)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 dark:text-orange-400">
                            {formatCurrency(grant.current_price ? grant.unvested_shares * grant.current_price : 0)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatCurrency(grant.strike_price)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            {formatDate(grant.grant_date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                              {grant.data_source}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleView(grant, 'morgan_stanley')}
                                className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                                title="View Details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleEdit(grant, 'morgan_stanley')}
                                className="p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(grant, 'morgan_stanley')}
                                className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'institutions' && (
            <div className="space-y-6">
              {stocksByInstitution.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400">No stock holdings found grouped by institution.</p>
              ) : (
                stocksByInstitution.map((group) => (
                  <div key={group.institution} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {group.institution}
                        </h4>
                        <div className="text-right">
                          <div className="text-sm text-gray-500 dark:text-gray-400">Total Value</div>
                          <div className="text-lg font-bold text-gray-900 dark:text-white">
                            {formatCurrency(group.totalValue)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Symbol</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Company</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Shares</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cost Basis</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Current Price</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Market Value</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Last Updated</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {group.holdings.map((holding) => (
                              <tr key={holding.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                  {holding.symbol}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                  {holding.company_name || 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                  {formatNumber(holding.shares_owned)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                  {formatCurrency(holding.cost_basis)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                  {formatCurrency(holding.current_price)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                  {formatCurrency(holding.market_value)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                                  {formatDate(holding.last_manual_update)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {selectedItem && selectedItemType && (
        <EditEntryModal
          entryType={selectedItemType}
          entryData={selectedItem}
          title={`Edit ${selectedItemType === 'stock_holding' ? 'Stock Holding' : 'Equity Grant'}`}
          isOpen={editModalOpen}
          onClose={closeModals}
          onUpdate={handleUpdate}
          submitText={`Update ${selectedItemType === 'stock_holding' ? 'Stock' : 'Grant'}`}
        />
      )}

      {/* View Modal */}
      {viewModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {selectedItemType === 'stock_holding' ? 'Stock Holding' : 'Equity Grant'} Details
              </h3>
              <button
                onClick={closeModals}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <pre className="text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">
                {JSON.stringify(selectedItem, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Delete {selectedItemType === 'stock_holding' ? 'Stock Holding' : 'Equity Grant'}
              </h3>
              <button
                onClick={closeModals}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to delete this {selectedItemType === 'stock_holding' ? 'stock holding' : 'equity grant'}? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={closeModals}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Stocks