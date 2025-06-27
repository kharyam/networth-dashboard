import React, { useState, useEffect, useRef } from 'react';
import { Download, Server, Activity, Clock } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface HealthStatus {
  status: string;
  timestamp: string;
  database: string;
  plugins: {
    total_count: number;
    available: string[];
  };
  price_service: {
    provider: string;
    last_updated: string;
    stale_prices: number;
    total_symbols: number;
    cache_age_minutes: number;
    force_refresh_needed: boolean;
  };
  market_status: {
    is_open: boolean;
  };
  crypto_service: {
    symbols_tracked: number;
  };
  property_service: {
    provider: string;
  };
  version: string;
}

const API: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [swaggerLoading, setSwaggerLoading] = useState(true);
  const [swaggerError, setSwaggerError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetchHealthStatus();
  }, []);


  // Effect to handle theme changes via postMessage
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      const theme = isDarkMode ? 'dark' : 'light';
      console.log(`🎨 Sending theme change to iframe: ${theme}`);
      iframeRef.current.contentWindow.postMessage(
        { type: 'theme-change', theme },
        '*'
      );
    }
  }, [isDarkMode]);

  const getSwaggerUrl = () => {
    const theme = isDarkMode ? 'dark' : 'light';
    return `/swagger-ui.html?theme=${theme}`;
  };

  const fetchHealthStatus = async () => {
    try {
      setHealthLoading(true);
      const response = await fetch('/health');
      if (!response.ok) {
        throw new Error('Failed to fetch health status');
      }
      const data = await response.json();
      setHealthStatus(data);
      setHealthError(null);
    } catch (error) {
      setHealthError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setHealthLoading(false);
    }
  };

  const handleDownloadSpec = async () => {
    try {
      const response = await fetch('/api/v1/swagger/spec');
      if (!response.ok) {
        throw new Error('Failed to download API specification');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'networth-api-spec.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to download API specification. Please ensure the backend is running.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 dark:text-green-400';
      case 'unhealthy':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-yellow-600 dark:text-yellow-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          API Documentation
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Interactive API documentation and system status for the NetWorth Dashboard API
        </p>
      </div>

      {/* API Health Status */}
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <Server className="h-5 w-5 mr-2" />
            API Health Status
          </h2>
          <button
            onClick={fetchHealthStatus}
            disabled={healthLoading}
            className="btn-secondary text-sm"
          >
            {healthLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {healthError ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <p className="text-red-700 dark:text-red-400">Error: {healthError}</p>
          </div>
        ) : healthStatus ? (
          <div className="space-y-4">
            {/* Overall Status */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
              <div className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                <span className="font-medium text-gray-900 dark:text-white">Overall Status</span>
              </div>
              <span className={`font-semibold ${getStatusColor(healthStatus.status)}`}>
                {healthStatus.status.toUpperCase()}
              </span>
            </div>

            {/* Service Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Database */}
              <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-md">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Database</h4>
                <p className={`text-sm ${getStatusColor(healthStatus.database === 'connected' ? 'healthy' : 'unhealthy')}`}>
                  {healthStatus.database}
                </p>
              </div>

              {/* Plugins */}
              <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-md">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Plugins</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {healthStatus.plugins.total_count} available
                </p>
              </div>

              {/* Price Service */}
              <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-md">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Price Service</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Provider: {healthStatus.price_service.provider}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Symbols: {healthStatus.price_service.total_symbols}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Stale: {healthStatus.price_service.stale_prices}
                </p>
              </div>

              {/* Market Status */}
              <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-md">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Market Status</h4>
                <p className={`text-sm ${healthStatus.market_status.is_open ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {healthStatus.market_status.is_open ? 'Open' : 'Closed'}
                </p>
              </div>
            </div>

            {/* Last Updated */}
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <Clock className="h-4 w-4 mr-1" />
              Last updated: {new Date(healthStatus.timestamp).toLocaleString()}
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Loading health status...</p>
          </div>
        )}
      </div>

      {/* API Documentation */}
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Interactive API Documentation
          </h2>
          <button
            onClick={handleDownloadSpec}
            className="btn-secondary text-sm flex items-center"
          >
            <Download className="h-4 w-4 mr-1" />
            Download OpenAPI Spec
          </button>
        </div>

        {/* Swagger UI Container */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white dark:bg-gray-800 relative">
          {swaggerError ? (
            <div className="p-8 text-center">
              <p className="text-red-600 dark:text-red-400 mb-4">Failed to load API documentation</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{swaggerError}</p>
              <button
                onClick={() => {
                  setSwaggerError(null);
                  setSwaggerLoading(true);
                  // Reload iframe with current theme
                  if (iframeRef.current) {
                    iframeRef.current.src = getSwaggerUrl();
                  }
                }}
                className="btn-secondary text-sm"
              >
                Retry Loading
              </button>
            </div>
          ) : (
            <>
              {swaggerLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800 z-10 rounded-md transition-colors duration-200">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-600 dark:text-gray-400">
                      Loading API documentation{isDarkMode ? ' (Dark Theme)' : ' (Light Theme)'}...
                    </p>
                  </div>
                </div>
              )}
              <iframe
                ref={iframeRef}
                src={getSwaggerUrl()}
                className="w-full h-[800px] border-0"
                title="API Documentation"
                onLoad={() => {
                  console.log('Swagger UI iframe loaded');
                  setSwaggerLoading(false);
                  setSwaggerError(null);
                  
                  // Send initial theme to iframe after a short delay
                  setTimeout(() => {
                    if (iframeRef.current?.contentWindow) {
                      const theme = isDarkMode ? 'dark' : 'light';
                      console.log(`🎨 Sending initial theme to iframe: ${theme}`);
                      iframeRef.current.contentWindow.postMessage(
                        { type: 'theme-change', theme },
                        '*'
                      );
                    }
                  }, 500);
                }}
                onError={() => {
                  setSwaggerLoading(false);
                  setSwaggerError('Could not load Swagger UI. Please ensure the backend is running and accessible.');
                }}
                style={{
                  colorScheme: isDarkMode ? 'dark' : 'light',
                  backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                  transition: 'background-color 0.2s ease-in-out'
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* API Information */}
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          API Information
        </h2>
        <div className="space-y-3 text-sm">
          <div>
            <span className="font-medium text-gray-900 dark:text-white">Base URL:</span>{' '}
            <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-blue-600 dark:text-blue-400">
              {window.location.origin}/api/v1
            </code>
          </div>
          <div>
            <span className="font-medium text-gray-900 dark:text-white">Version:</span>{' '}
            <span className="text-gray-600 dark:text-gray-400">
              {healthStatus?.version || '1.0'}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-900 dark:text-white">Documentation:</span>{' '}
            <a
              href={getSwaggerUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Open in new tab
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default API;