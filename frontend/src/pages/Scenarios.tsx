import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { scenariosApi } from '../services/api';
import { 
  TrendingUp, 
  Plus, 
  Play, 
  Save, 
  Trash2, 
  Download,
  Copy,
  Settings,
  BarChart3,
  Clock
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useTheme } from '../contexts/ThemeContext';

interface ScenarioParameter {
  id?: number;
  scenario_id?: number;
  asset_class: string;
  expected_annual_return: number;
  annual_volatility: number;
  custom_parameters?: any;
  created_at?: string;
}

interface CryptoScenarioParameter {
  id?: number;
  scenario_id?: number;
  crypto_symbol: string;
  expected_annual_return: number;
  annual_volatility: number;
  custom_parameters?: any;
  created_at?: string;
}

interface Scenario {
  id?: number;
  name: string;
  description: string;
  time_horizon_years: number;
  rebalancing_frequency: string;
  bitcoin_allocation_percentage: number;
  created_at?: string;
  updated_at?: string;
  parameters: ScenarioParameter[];
  crypto_parameters?: CryptoScenarioParameter[];
  results?: ScenarioResult[];
}

interface ScenarioResult {
  id: number;
  scenario_id: number;
  projection_year: number;
  total_net_worth: number;
  net_worth_in_btc: number;
  projected_bitcoin_price: number;
  stock_value: number;
  crypto_value: number;
  real_estate_value: number;
  cash_value: number;
  other_assets_value: number;
  asset_allocation: {
    stocks: number;
    crypto: number;
    real_estate: number;
    cash: number;
    other_assets: number;
  };
  calculated_at: string;
}

interface CurrentPortfolio {
  stock_value: number;
  crypto_value: number;
  real_estate_value: number;
  cash_value: number;
  other_assets_value: number;
  total_value: number;
  current_bitcoin_price: number;
}

const Scenarios: React.FC = () => {
  const { } = useTheme();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [currentPortfolio, setCurrentPortfolio] = useState<CurrentPortfolio | null>(null);
  const [defaultParameters, setDefaultParameters] = useState<Record<string, ScenarioParameter>>({});
  const [availableCryptoSymbols, setAvailableCryptoSymbols] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'results' | 'comparison'>('list');
  const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
  const [exporting, setExporting] = useState<string | false>(false);

  useEffect(() => {
    fetchScenarios();
    fetchDefaultParameters();
    fetchCurrentPortfolio();
  }, []);

  const fetchScenarios = async () => {
    try {
      const response = await axios.get('/api/v1/scenarios');
      setScenarios(response.data || []);
    } catch (error) {
      console.error('Error fetching scenarios:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDefaultParameters = async () => {
    try {
      const response = await axios.get('/api/v1/scenarios/default-parameters');
      setDefaultParameters(response.data.default_parameters || {});
      setAvailableCryptoSymbols(response.data.available_crypto_symbols || []);
    } catch (error) {
      console.error('Error fetching default parameters:', error);
    }
  };

  const fetchCurrentPortfolio = async () => {
    try {
      const response = await axios.get('/api/v1/net-worth');
      setCurrentPortfolio({
        stock_value: response.data.stock_holdings_value || 0,
        crypto_value: response.data.crypto_holdings_value || 0,
        real_estate_value: response.data.real_estate_equity || 0,
        cash_value: response.data.cash_holdings_value || 0,
        other_assets_value: response.data.other_assets_value || 0,
        total_value: response.data.total_assets || 0,
        current_bitcoin_price: 45000, // Default - will be updated by backend
      });
    } catch (error) {
      console.error('Error fetching current portfolio:', error);
    }
  };

  const createNewScenario = () => {
    // Safely extract parameters with defensive programming
    const parameters = defaultParameters && typeof defaultParameters === 'object' 
      ? Object.values(defaultParameters).filter(param => param && param.asset_class).map(param => ({
          asset_class: param.asset_class,
          expected_annual_return: param.expected_annual_return,
          annual_volatility: param.annual_volatility,
          custom_parameters: param.custom_parameters,
        }))
      : [];

    const newScenario: Scenario = {
      name: '',
      description: '',
      time_horizon_years: 10,
      rebalancing_frequency: 'annual',
      bitcoin_allocation_percentage: 0,
      parameters: parameters,
      crypto_parameters: [],
    };
    
    setEditingScenario(newScenario);
    setShowScenarioModal(true);
  };

  const saveScenario = async (scenario: Scenario) => {
    try {
      if (scenario.id) {
        await axios.put(`/api/v1/scenarios/${scenario.id}`, scenario);
      } else {
        await axios.post('/api/v1/scenarios', scenario);
      }
      setShowScenarioModal(false);
      setEditingScenario(null);
      await fetchScenarios();
    } catch (error) {
      console.error('Error saving scenario:', error);
      alert('Error saving scenario');
    }
  };

  const deleteScenario = async (id: number) => {
    if (!confirm('Are you sure you want to delete this scenario?')) return;
    
    try {
      await axios.delete(`/api/v1/scenarios/${id}`);
      await fetchScenarios();
      if (selectedScenario?.id === id) {
        setSelectedScenario(null);
      }
    } catch (error) {
      console.error('Error deleting scenario:', error);
      alert('Error deleting scenario');
    }
  };

  const calculateScenario = async (scenario: Scenario) => {
    setCalculating(true);
    try {
      const response = await axios.post(`/api/v1/scenarios/${scenario.id}/calculate`);
      const updatedScenario = { ...scenario, results: response.data };
      setSelectedScenario(updatedScenario);
      setViewMode('results');
    } catch (error) {
      console.error('Error calculating scenario:', error);
      alert('Error calculating scenario');
    } finally {
      setCalculating(false);
    }
  };

  const exportScenario = async (scenario: Scenario, format: string) => {
    try {
      const response = await axios.get(`/api/v1/scenarios/${scenario.id}/export?format=${format}`);
      
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `scenario_${scenario.name.replace(/\s+/g, '_')}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting scenario:', error);
      alert('Error exporting scenario');
    }
  };

  const handleExport = async (format: string) => {
    if (!selectedScenario?.id) return;
    
    setExporting(format);
    try {
      const data = await scenariosApi.exportResults(selectedScenario.id, format as 'json' | 'csv' | 'html' | 'pdf' | 'zip');
      
      let filename = `scenario_${selectedScenario.name.replace(/\s+/g, '_')}`;
      let blob: Blob;
      
      switch (format) {
        case 'json':
          blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          filename += '.json';
          break;
        case 'csv':
          blob = data as Blob;
          filename += '.csv';
          break;
        case 'html':
          blob = data as Blob;
          filename += '.html';
          break;
        case 'pdf':
          blob = data as Blob;
          filename += '.pdf';
          break;
        case 'zip':
          blob = data as Blob;
          filename += '_package.zip';
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting results:', error);
      alert('Error exporting results');
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (amount: number, shortFormat = false) => {
    if (shortFormat) {
      // Short format for charts
      if (amount >= 1e9) {
        return `$${(amount / 1e9).toFixed(1)}B`;
      } else if (amount >= 1e6) {
        return `$${(amount / 1e6).toFixed(1)}M`;
      } else if (amount >= 1e3) {
        return `$${(amount / 1e3).toFixed(1)}K`;
      }
    }
    
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatBTC = (amount: number) => {
    return `₿${amount.toFixed(4)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="h-8 w-8" />
            What-If Scenarios
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Explore how your portfolio might grow under different market conditions
          </p>
        </div>
        <button
          onClick={createNewScenario}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus className="h-5 w-5" />
          New Scenario
        </button>
      </div>

      {/* Current Portfolio Summary */}
      {currentPortfolio && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm mb-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Current Portfolio
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(currentPortfolio.stock_value)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Stocks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(currentPortfolio.crypto_value)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Crypto</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(currentPortfolio.real_estate_value)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Real Estate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">
                {formatCurrency(currentPortfolio.cash_value)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Cash</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(currentPortfolio.other_assets_value)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Other</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">
                {formatCurrency(currentPortfolio.total_value)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total</div>
            </div>
          </div>
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 mb-6 bg-white dark:bg-gray-800">
        <button
          onClick={() => setViewMode('list')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-l-lg ${
            viewMode === 'list'
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <Settings className="h-4 w-4 inline mr-2" />
          Scenarios
        </button>
        <button
          onClick={() => setViewMode('results')}
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            viewMode === 'results'
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          disabled={!selectedScenario}
        >
          <BarChart3 className="h-4 w-4 inline mr-2" />
          Results
        </button>
        <button
          onClick={() => setViewMode('comparison')}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-r-lg ${
            viewMode === 'comparison'
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <Copy className="h-4 w-4 inline mr-2" />
          Compare
        </button>
      </div>

      {/* Scenarios List */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scenarios.map((scenario) => (
            <div
              key={scenario.id}
              className={`bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border-2 transition-colors cursor-pointer ${
                selectedScenario?.id === scenario.id
                  ? 'border-blue-500'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
              onClick={() => setSelectedScenario(scenario)}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {scenario.name}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingScenario(scenario);
                      setShowScenarioModal(true);
                    }}
                    className="text-gray-500 hover:text-blue-600"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteScenario(scenario.id!);
                    }}
                    className="text-gray-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                {scenario.description}
              </p>
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Time Horizon:</span>
                  <span className="text-gray-900 dark:text-white">{scenario.time_horizon_years} years</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Bitcoin Allocation:</span>
                  <span className="text-gray-900 dark:text-white">{scenario.bitcoin_allocation_percentage}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Rebalancing:</span>
                  <span className="text-gray-900 dark:text-white capitalize">{scenario.rebalancing_frequency}</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    calculateScenario(scenario);
                  }}
                  disabled={calculating}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-3 py-2 rounded text-sm flex items-center justify-center gap-2"
                >
                  {calculating ? (
                    <>
                      <Clock className="h-4 w-4 animate-spin" />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Calculate
                    </>
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    exportScenario(scenario, 'json');
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded text-sm flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results View */}
      {viewMode === 'results' && selectedScenario && selectedScenario.results && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              {selectedScenario.name} - Projection Results
            </h2>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100">Final Net Worth</h3>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(selectedScenario.results[selectedScenario.results.length - 1]?.total_net_worth || 0)}
                </p>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-orange-900 dark:text-orange-100">Final Net Worth (BTC)</h3>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {formatBTC(selectedScenario.results[selectedScenario.results.length - 1]?.net_worth_in_btc || 0)}
                </p>
              </div>
              <div className="bg-green-50 dark:bg-green-900 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-green-900 dark:text-green-100">Growth Multiple</h3>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {currentPortfolio ? (
                    `${((selectedScenario.results[selectedScenario.results.length - 1]?.total_net_worth || 0) / currentPortfolio.total_value).toFixed(1)}x`
                  ) : 'N/A'}
                </p>
              </div>
            </div>
            
            {/* Wealth Over Time Chart */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Wealth Growth Over Time</h3>
              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={selectedScenario.results}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="projection_year" 
                      tickFormatter={(value) => value === 0 ? 'Current' : `Year ${value}`}
                    />
                    <YAxis tickFormatter={(value) => formatCurrency(value, true)} />
                    <Tooltip 
                      formatter={(value, name) => [formatCurrency(value as number), name]}
                      labelFormatter={(label) => label === 0 ? 'Current' : `Year ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="total_net_worth"
                      stackId="1"
                      stroke="#3B82F6"
                      fill="#3B82F6"
                      fillOpacity={0.1}
                      name="Total Net Worth"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Asset Allocation Over Time Chart */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Asset Allocation Evolution</h3>
              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={selectedScenario.results}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="projection_year" 
                      tickFormatter={(value) => value === 0 ? 'Current' : `Year ${value}`}
                    />
                    <YAxis tickFormatter={(value) => formatCurrency(value, true)} />
                    <Tooltip 
                      formatter={(value, name) => [formatCurrency(value as number), name]}
                      labelFormatter={(label) => label === 0 ? 'Current' : `Year ${label}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="stock_value"
                      stackId="1"
                      stroke="#10B981"
                      fill="#10B981"
                      name="Stocks"
                    />
                    <Area
                      type="monotone"
                      dataKey="crypto_value"
                      stackId="1"
                      stroke="#F59E0B"
                      fill="#F59E0B"
                      name="Crypto"
                    />
                    <Area
                      type="monotone"
                      dataKey="real_estate_value"
                      stackId="1"
                      stroke="#8B5CF6"
                      fill="#8B5CF6"
                      name="Real Estate"
                    />
                    <Area
                      type="monotone"
                      dataKey="cash_value"
                      stackId="1"
                      stroke="#06B6D4"
                      fill="#06B6D4"
                      name="Cash"
                    />
                    <Area
                      type="monotone"
                      dataKey="other_assets_value"
                      stackId="1"
                      stroke="#EF4444"
                      fill="#EF4444"
                      name="Other Assets"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bitcoin Price Projection Chart */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Bitcoin Price Projection</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selectedScenario.results}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="projection_year" 
                      tickFormatter={(value) => value === 0 ? 'Current' : `Year ${value}`}
                    />
                    <YAxis tickFormatter={(value) => formatCurrency(value, true)} />
                    <Tooltip 
                      formatter={(value, name) => [formatCurrency(value as number), name]}
                      labelFormatter={(label) => label === 0 ? 'Current' : `Year ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="projected_bitcoin_price"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name="Bitcoin Price"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Results Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 text-gray-900 dark:text-white">Year</th>
                    <th className="text-right py-2 text-gray-900 dark:text-white">Net Worth (USD)</th>
                    <th className="text-right py-2 text-gray-900 dark:text-white">Net Worth (BTC)</th>
                    <th className="text-right py-2 text-gray-900 dark:text-white">BTC Price</th>
                    <th className="text-right py-2 text-gray-900 dark:text-white">Stocks</th>
                    <th className="text-right py-2 text-gray-900 dark:text-white">Crypto</th>
                    <th className="text-right py-2 text-gray-900 dark:text-white">Real Estate</th>
                    <th className="text-right py-2 text-gray-900 dark:text-white">Cash</th>
                    <th className="text-right py-2 text-gray-900 dark:text-white">Other</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedScenario.results.map((result) => (
                    <tr key={result.projection_year} className={`border-b border-gray-100 dark:border-gray-800 ${result.projection_year === 0 ? 'bg-blue-50 dark:bg-blue-900' : ''}`}>
                      <td className="py-2 text-gray-900 dark:text-white font-medium">
                        {result.projection_year === 0 ? 'Current' : result.projection_year}
                      </td>
                      <td className="py-2 text-right text-gray-900 dark:text-white font-medium">
                        {formatCurrency(result.total_net_worth)}
                      </td>
                      <td className="py-2 text-right text-gray-900 dark:text-white">
                        {formatBTC(result.net_worth_in_btc)}
                      </td>
                      <td className="py-2 text-right text-gray-900 dark:text-white">
                        {formatCurrency(result.projected_bitcoin_price)}
                      </td>
                      <td className="py-2 text-right text-gray-900 dark:text-white">
                        {formatCurrency(result.stock_value)}
                      </td>
                      <td className="py-2 text-right text-gray-900 dark:text-white">
                        {formatCurrency(result.crypto_value)}
                      </td>
                      <td className="py-2 text-right text-gray-900 dark:text-white">
                        {formatCurrency(result.real_estate_value)}
                      </td>
                      <td className="py-2 text-right text-gray-900 dark:text-white">
                        {formatCurrency(result.cash_value)}
                      </td>
                      <td className="py-2 text-right text-gray-900 dark:text-white">
                        {formatCurrency(result.other_assets_value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Export Results */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Export Results</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <button
                onClick={() => handleExport('json')}
                disabled={!!exporting}
                className="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-left transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  <div>
                    <div className="font-medium text-sm">
                      {exporting === 'json' ? 'Exporting...' : 'JSON Data'}
                    </div>
                    <div className="text-xs opacity-75">Raw data export</div>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => handleExport('csv')}
                disabled={!!exporting}
                className="px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-left transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  <div>
                    <div className="font-medium text-sm">
                      {exporting === 'csv' ? 'Exporting...' : 'CSV Spreadsheet'}
                    </div>
                    <div className="text-xs opacity-75">Excel-compatible</div>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => handleExport('html')}
                disabled={!!exporting}
                className="px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-left transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  <div>
                    <div className="font-medium text-sm">
                      {exporting === 'html' ? 'Exporting...' : 'HTML Report'}
                    </div>
                    <div className="text-xs opacity-75">Interactive charts</div>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => alert('PDF export is not yet implemented. Please use HTML export for now.')}
                disabled={true}
                className="px-4 py-3 bg-gray-400 text-white rounded-lg cursor-not-allowed text-left transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  <div>
                    <div className="font-medium text-sm">PDF Report</div>
                    <div className="text-xs opacity-75">Coming soon</div>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => alert('ZIP package export is not yet implemented. Please use HTML export for now.')}
                disabled={true}
                className="px-4 py-3 bg-gray-400 text-white rounded-lg cursor-not-allowed text-left transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  <div>
                    <div className="font-medium text-sm">HTML Package</div>
                    <div className="text-xs opacity-75">Coming soon</div>
                  </div>
                </div>
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
              Export your scenario results in various formats for analysis, sharing, or archival purposes. 
              <span className="font-medium">Available now:</span> JSON, CSV, HTML. 
              <span className="font-medium">Coming soon:</span> PDF, ZIP packages.
            </p>
          </div>
        </div>
      )}

      {/* Scenario Modal */}
      {showScenarioModal && editingScenario && (
        <ScenarioModal
          scenario={editingScenario}
          defaultParameters={defaultParameters}
          availableCryptoSymbols={availableCryptoSymbols}
          onSave={saveScenario}
          onClose={() => {
            setShowScenarioModal(false);
            setEditingScenario(null);
          }}
        />
      )}
    </div>
  );
};

// Scenario Modal Component
interface ScenarioModalProps {
  scenario: Scenario;
  defaultParameters: Record<string, ScenarioParameter>;
  availableCryptoSymbols: string[];
  onSave: (scenario: Scenario) => void;
  onClose: () => void;
}

const ScenarioModal: React.FC<ScenarioModalProps> = ({ scenario, defaultParameters, availableCryptoSymbols, onSave, onClose }) => {
  const [editScenario, setEditScenario] = useState<Scenario>(() => {
    // If scenario doesn't have parameters, populate from defaults
    if (!scenario.parameters || scenario.parameters.length === 0) {
      const defaultParams = defaultParameters && typeof defaultParameters === 'object' 
        ? Object.values(defaultParameters).filter(param => param && param.asset_class).map(param => ({
            asset_class: param.asset_class,
            expected_annual_return: param.expected_annual_return,
            annual_volatility: param.annual_volatility,
            custom_parameters: param.custom_parameters,
          }))
        : [];
      
      return {
        ...scenario,
        parameters: defaultParams,
        crypto_parameters: scenario.crypto_parameters || [],
      };
    }
    return {
      ...scenario,
      crypto_parameters: scenario.crypto_parameters || [],
    };
  });

  const [showCryptoConfig, setShowCryptoConfig] = useState(false);

  const handleSave = () => {
    if (!editScenario.name.trim()) {
      alert('Please enter a scenario name');
      return;
    }
    onSave(editScenario);
  };

  const updateParameter = (assetClass: string, field: string, value: number) => {
    setEditScenario(prev => ({
      ...prev,
      parameters: prev.parameters.map(param => 
        param.asset_class === assetClass
          ? { ...param, [field]: value }
          : param
      )
    }));
  };

  const updateCryptoParameter = (cryptoSymbol: string, field: string, value: number) => {
    setEditScenario(prev => ({
      ...prev,
      crypto_parameters: (prev.crypto_parameters || []).map(param => 
        param.crypto_symbol === cryptoSymbol
          ? { ...param, [field]: value }
          : param
      )
    }));
  };

  const addCryptoParameter = (cryptoSymbol: string) => {
    const defaultCryptoParam = defaultParameters['crypto'];
    const newParam: CryptoScenarioParameter = {
      crypto_symbol: cryptoSymbol,
      expected_annual_return: defaultCryptoParam?.expected_annual_return || 15,
      annual_volatility: defaultCryptoParam?.annual_volatility || 40,
    };
    
    setEditScenario(prev => ({
      ...prev,
      crypto_parameters: [...(prev.crypto_parameters || []), newParam]
    }));
  };

  const removeCryptoParameter = (cryptoSymbol: string) => {
    setEditScenario(prev => ({
      ...prev,
      crypto_parameters: (prev.crypto_parameters || []).filter(param => param.crypto_symbol !== cryptoSymbol)
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {scenario.id ? 'Edit Scenario' : 'New Scenario'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <span className="sr-only">Close</span>
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Scenario Name
              </label>
              <input
                type="text"
                value={editScenario.name}
                onChange={(e) => setEditScenario(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter scenario name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Time Horizon (Years)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={editScenario.time_horizon_years}
                onChange={(e) => setEditScenario(prev => ({ ...prev, time_horizon_years: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={editScenario.description}
              onChange={(e) => setEditScenario(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={3}
              placeholder="Enter scenario description"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bitcoin Allocation (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={editScenario.bitcoin_allocation_percentage}
                onChange={(e) => setEditScenario(prev => ({ ...prev, bitcoin_allocation_percentage: parseFloat(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 mt-1">
                Percentage of non-crypto assets to move to Bitcoin
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rebalancing Frequency
              </label>
              <select
                value={editScenario.rebalancing_frequency}
                onChange={(e) => setEditScenario(prev => ({ ...prev, rebalancing_frequency: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="none">No Rebalancing</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          </div>

          {/* Asset Class Parameters */}
          <div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Expected Annual Returns by Asset Class
            </h4>
            <div className="space-y-4">
              {(editScenario.parameters || []).map((param) => (
                <div key={param.asset_class} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                  <div className="flex justify-between items-center mb-2">
                    <h5 className="font-medium text-gray-900 dark:text-white capitalize">
                      {param.asset_class.replace('_', ' ')}
                    </h5>
                    <span className="text-sm text-gray-500">
                      {param.custom_parameters?.historical_range || 'Historical range varies'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                        Expected Annual Return (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="-10"
                        max="50"
                        value={param.expected_annual_return}
                        onChange={(e) => updateParameter(param.asset_class, 'expected_annual_return', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                        Annual Volatility (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={param.annual_volatility}
                        onChange={(e) => updateParameter(param.asset_class, 'annual_volatility', parseFloat(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  {param.custom_parameters?.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      {param.custom_parameters.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Individual Crypto Parameters */}
          {availableCryptoSymbols.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                  Individual Crypto Parameters
                </h4>
                <button
                  type="button"
                  onClick={() => setShowCryptoConfig(!showCryptoConfig)}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {showCryptoConfig ? 'Hide' : 'Configure Individual Cryptos'}
                </button>
              </div>
              
              {showCryptoConfig && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Configure specific growth rates for individual cryptocurrencies. If not set, the general crypto parameter will be used.
                  </p>
                  
                  {/* Add Crypto Parameter */}
                  <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-md">
                    <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Add Crypto Parameter</h5>
                    <div className="flex gap-2">
                      <select
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        onChange={(e) => {
                          if (e.target.value) {
                            addCryptoParameter(e.target.value);
                            e.target.value = '';
                          }
                        }}
                      >
                        <option value="">Select crypto to add...</option>
                        {availableCryptoSymbols
                          .filter(symbol => !(editScenario.crypto_parameters || []).some(p => p.crypto_symbol === symbol))
                          .map(symbol => (
                            <option key={symbol} value={symbol}>{symbol}</option>
                          ))
                        }
                      </select>
                    </div>
                  </div>
                  
                  {/* Existing Crypto Parameters */}
                  {(editScenario.crypto_parameters || []).map((param) => (
                    <div key={param.crypto_symbol} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                      <div className="flex justify-between items-center mb-2">
                        <h5 className="font-medium text-gray-900 dark:text-white">
                          {param.crypto_symbol}
                        </h5>
                        <button
                          type="button"
                          onClick={() => removeCryptoParameter(param.crypto_symbol)}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                            Expected Annual Return (%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="-50"
                            max="200"
                            value={param.expected_annual_return}
                            onChange={(e) => updateCryptoParameter(param.crypto_symbol, 'expected_annual_return', parseFloat(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                            Annual Volatility (%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="200"
                            value={param.annual_volatility}
                            onChange={(e) => updateCryptoParameter(param.crypto_symbol, 'annual_volatility', parseFloat(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-4 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            Save Scenario
          </button>
        </div>
      </div>
    </div>
  );
};

export default Scenarios;