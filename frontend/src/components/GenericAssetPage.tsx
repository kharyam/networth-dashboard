import React from 'react'
import { Plus, RefreshCw, BarChart3, Grid3X3, List, AlertTriangle, X, Eye, Edit2, Trash2 } from 'lucide-react'
import { useAssetCRUD, AssetCRUDConfig } from '@/hooks/useAssetCRUD'
import EditEntryModal from '@/components/EditEntryModal'
import SmartDynamicForm from '@/components/SmartDynamicForm'
import { formatCurrency, formatDate } from '@/utils/formatting'

export interface GenericAssetPageConfig<T extends { id: number }> extends AssetCRUDConfig<T> {
  // Page configuration
  title: string
  description: string
  icon: React.ComponentType<any>
  
  // Component configuration
  renderCard?: (item: T, actions: { onEdit: () => void, onView: () => void, onDelete: () => void }) => React.ReactNode
  renderListItem?: (item: T, actions: { onEdit: () => void, onView: () => void, onDelete: () => void }) => React.ReactNode
  renderListRow?: (item: T, actions: { onEdit: () => void, onView: () => void, onDelete: () => void }) => React.ReactNode
  renderListHeaders?: () => React.ReactNode
  renderCharts?: (items: T[]) => React.ReactNode
  renderSummaryCards?: (items: T[], rawData?: any) => React.ReactNode
  renderCustomView?: (viewMode: string, items: T[]) => React.ReactNode
  
  // Modal configuration
  entryType?: string // For EditEntryModal
  getFormData?: (item: T) => Record<string, any> // Transform item to form data
  
  // Feature flags
  supportedViewModes?: ('grid' | 'list' | 'charts' | string)[]
  enableAdd?: boolean
  enableRefresh?: boolean
  enableBulkActions?: boolean
}

interface GenericAssetPageProps<T extends { id: number }> {
  config: GenericAssetPageConfig<T>
}

export function GenericAssetPage<T extends { id: number }>({ 
  config 
}: GenericAssetPageProps<T>) {
  const [state, actions] = useAssetCRUD(config)
  
  const {
    items,
    rawData,
    loading,
    refreshing,
    error,
    addModalOpen,
    editModalOpen,
    viewModalOpen,
    deleteModalOpen,
    selectedItem,
    schema,
    submitting,
    message,
    viewMode
  } = state

  const {
    refreshItems,
    openAddModal,
    openEditModal,
    openViewModal,
    openDeleteModal,
    closeModals,
    handleCreate,
    handleUpdate,
    handleDelete,
    setViewMode,
    clearMessage,
    clearError
  } = actions

  // Default supported view modes
  const supportedViewModes = config.supportedViewModes || ['grid', 'list']
  const enableAdd = config.enableAdd !== false
  const enableRefresh = config.enableRefresh !== false

  // Default card renderer
  const defaultCardRenderer = (item: T, itemActions: any) => (
    <div key={item.id} className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {/* Display first few properties of the item */}
            {Object.entries(item).slice(1, 3).map(([key, value]) => (
              <span key={key} className="mr-2">
                {typeof value === 'string' ? value : JSON.stringify(value)}
              </span>
            ))}
          </h3>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={itemActions.onView}
            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={itemActions.onEdit}
            className="p-2 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={itemActions.onDelete}
            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

  // Default list item renderer
  const defaultListRenderer = (item: T, itemActions: any) => (
    <div key={item.id} className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          {/* Display item properties */}
          {Object.entries(item).slice(1, 4).map(([key, value]) => (
            <span key={key} className="mr-4 text-sm text-gray-600 dark:text-gray-400">
              <strong className="text-gray-900 dark:text-white">{key}:</strong> {String(value)}
            </span>
          ))}
        </div>
        <div className="flex space-x-2">
          <button
            onClick={itemActions.onView}
            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={itemActions.onEdit}
            className="p-2 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={itemActions.onDelete}
            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )

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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <config.icon className="w-8 h-8 mr-3 text-primary-600" />
            {config.title}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {config.description}
          </p>
        </div>

        <div className="flex items-center space-x-4">
          {/* View Mode Toggle */}
          {supportedViewModes.length > 1 && (
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-600">
              {supportedViewModes.includes('grid') && (
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-2 text-sm font-medium rounded-l-lg ${
                    viewMode === 'grid'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
              )}
              {supportedViewModes.includes('list') && (
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 text-sm font-medium ${
                    supportedViewModes.length === 2 ? '' : 'rounded-r-lg'
                  } ${
                    viewMode === 'list'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              )}
              {supportedViewModes.includes('charts') && (
                <button
                  onClick={() => setViewMode('charts')}
                  className={`px-3 py-2 text-sm font-medium rounded-r-lg ${
                    viewMode === 'charts'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {enableRefresh && (
            <button
              onClick={refreshItems}
              disabled={refreshing}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          )}

          {enableAdd && (
            <button
              onClick={openAddModal}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add {config.entityName}
            </button>
          )}
        </div>
      </div>

      {/* Success/Error Messages */}
      {message && (
        <div className={`card border-l-4 ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-600' 
            : 'bg-red-50 dark:bg-red-900/20 border-red-400 dark:border-red-600'
        }`}>
          <div className="flex items-center justify-between">
            <p className={`${
              message.type === 'success' 
                ? 'text-green-700 dark:text-green-300' 
                : 'text-red-700 dark:text-red-300'
            }`}>
              {message.text}
            </p>
            <button onClick={clearMessage} className="ml-3">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="card bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
            <button onClick={clearError} className="ml-3">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {config.renderSummaryCards && config.renderSummaryCards(items, rawData)}

      {/* Main Content */}
      {viewMode === 'charts' && config.renderCharts ? (
        config.renderCharts(items)
      ) : config.renderCustomView && !['grid', 'list', 'charts'].includes(viewMode) ? (
        config.renderCustomView(viewMode, items)
      ) : items.length === 0 ? (
        <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-center py-12">
          <config.icon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No {config.entityName}s found</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Get started by adding your first {config.entityName.toLowerCase()}.
          </p>
          {enableAdd && (
            <button
              onClick={openAddModal}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First {config.entityName}
            </button>
          )}
        </div>
      ) : viewMode === 'list' && config.renderListRow && config.renderListHeaders ? (
        // Table-style list view
        <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                {config.renderListHeaders()}
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {items.map((item) => {
                  const itemActions = {
                    onEdit: () => openEditModal(item),
                    onView: () => openViewModal(item),
                    onDelete: () => openDeleteModal(item)
                  }
                  return <React.Fragment key={item.id}>{config.renderListRow!(item, itemActions)}</React.Fragment>
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className={
          viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
            : 'space-y-4'
        }>
          {items.map((item) => {
            const itemActions = {
              onEdit: () => openEditModal(item),
              onView: () => openViewModal(item),
              onDelete: () => openDeleteModal(item)
            }
            
            if (viewMode === 'grid' && config.renderCard) {
              return config.renderCard(item, itemActions)
            } else if (viewMode === 'list' && config.renderListItem) {
              return config.renderListItem(item, itemActions)
            } else {
              // Fallback to default renderers
              return viewMode === 'grid' 
                ? defaultCardRenderer(item, itemActions)
                : defaultListRenderer(item, itemActions)
            }
          })}
        </div>
      )}

      {/* Add Modal */}
      {addModalOpen && schema && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Add New {config.entityName}
              </h3>
              <button
                onClick={closeModals}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <SmartDynamicForm
                schema={schema}
                onSubmit={handleCreate}
                loading={submitting}
                onSchemaChange={actions.loadSchemaForCategory}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {config.entryType && (
        <EditEntryModal
          entryType={config.entryType}
          entryData={selectedItem && config.getFormData ? config.getFormData(selectedItem) : selectedItem || {}}
          title={`Edit ${config.entityName}`}
          isOpen={editModalOpen}
          onClose={closeModals}
          onUpdate={handleUpdate}
          submitText={`Update ${config.entityName}`}
          schemaOverride={schema || undefined}
        />
      )}

      {/* View Modal */}
      {viewModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {config.entityName} Details
              </h3>
              <button
                onClick={closeModals}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {Object.entries(selectedItem).map(([key, value]) => (
                  <div key={key}>
                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1 capitalize">
                      {key.replace(/_/g, ' ')}
                    </h4>
                    <p className="text-gray-900 dark:text-white">
                      {typeof value === 'number' && key.includes('amount') || key.includes('price') || key.includes('value') 
                        ? formatCurrency(value)
                        : typeof value === 'string' && key.includes('date')
                        ? formatDate(value)
                        : String(value)
                      }
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Delete {config.entityName}
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
                Are you sure you want to delete this {config.entityName.toLowerCase()}? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={closeModals}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
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

export default GenericAssetPage