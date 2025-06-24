import { useState, useEffect } from 'react'
import { Plus, Key, Shield, Trash2, TestTube } from 'lucide-react'

interface Credential {
  id: number
  service_type: string
  credential_type: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
  last_used?: string
}

interface Service {
  service_type: string
  name: string
  credential_type: string
  description: string
}

function Credentials() {
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCredentials()
    fetchServices()
  }, [])

  const fetchCredentials = async () => {
    try {
      const response = await fetch('/api/v1/credentials')
      const data = await response.json()
      setCredentials(data.credentials || [])
    } catch (error) {
      console.error('Failed to fetch credentials:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/v1/credentials/services')
      const data = await response.json()
      setServices(data.services || [])
    } catch (error) {
      console.error('Failed to fetch services:', error)
    }
  }

  const deleteCredential = async (serviceType: string) => {
    if (!confirm('Are you sure you want to delete this credential?')) {
      return
    }

    try {
      const response = await fetch(`/api/v1/credentials/${serviceType}`, {
        method: 'DELETE',
      })
      
      if (response.ok) {
        fetchCredentials()
      } else {
        alert('Failed to delete credential')
      }
    } catch (error) {
      console.error('Failed to delete credential:', error)
      alert('Failed to delete credential')
    }
  }

  const testCredential = async (serviceType: string) => {
    try {
      const response = await fetch(`/api/v1/credentials/${serviceType}/test`, {
        method: 'POST',
      })
      
      if (response.ok) {
        alert('Credential test successful!')
      } else {
        const data = await response.json()
        alert(`Credential test failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Failed to test credential:', error)
      alert('Failed to test credential')
    }
  }

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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Credential Management</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Securely manage your financial service credentials
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="btn-primary flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Credential
        </button>
      </div>

      {/* Credentials List */}
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Stored Credentials</h3>
        
        {credentials.length === 0 ? (
          <div className="text-center py-8">
            <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No credentials stored yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Add credentials to connect to your financial services
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Service
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Last Used
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                {credentials.map((credential) => (
                  <tr key={credential.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Shield className="w-5 h-5 text-primary-600 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {credential.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {credential.service_type}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {credential.credential_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        credential.is_active 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {credential.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {credential.last_used 
                        ? new Date(credential.last_used).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => testCredential(credential.service_type)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        title="Test credential"
                      >
                        <TestTube className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteCredential(credential.service_type)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        title="Delete credential"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Available Services */}
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Supported Services</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => {
            const hasCredential = credentials.some(c => c.service_type === service.service_type)
            return (
              <div key={service.service_type} className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900 dark:text-white">{service.name}</h4>
                  {hasCredential && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      Configured
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{service.description}</p>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                  {service.credential_type}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Create Form Modal - Placeholder */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Add New Credential</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Credential creation form will be implemented in the next phase.
              </p>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Credentials