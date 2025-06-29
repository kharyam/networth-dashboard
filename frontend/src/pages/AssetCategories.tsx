import { useState, useEffect } from 'react'
import { 
  Plus, 
  RefreshCw, 
  Edit2,
  Trash2,
  Eye,
  X,
  Save,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { assetCategoriesApi } from '../services/api'

interface AssetCategory {
  id: number
  name: string
  description?: string
  icon?: string
  color?: string
  custom_schema?: any
  valuation_api_config?: any
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

interface CustomField {
  name: string
  type: string
  label: string
  required: boolean
  options?: { value: string; label: string }[]
  validation?: { min?: number; max?: number }
  placeholder?: string
}

function AssetCategories() {
  const [categories, setCategories] = useState<AssetCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '',
    color: '#3B82F6',
    is_active: true,
    sort_order: 0,
    custom_fields: [] as CustomField[]
  })

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await assetCategoriesApi.getAll()
      console.log('Asset categories API response:', data)
      
      // Ensure data is an array
      const categoriesArray = Array.isArray(data) ? data : []
      console.log('Categories array:', categoriesArray)
      
      setCategories(categoriesArray.sort((a, b) => a.sort_order - b.sort_order))
    } catch (error: any) {
      console.error('Failed to load categories:', error)
      setError('Failed to load asset categories. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleAddCategory = () => {
    setFormData({
      name: '',
      description: '',
      icon: '',
      color: '#3B82F6',
      is_active: true,
      sort_order: categories.length,
      custom_fields: []
    })
    setShowAddModal(true)
  }

  const handleEditCategory = (category: AssetCategory) => {
    const customFields: CustomField[] = category.custom_schema?.fields || []
    setFormData({
      name: category.name,
      description: category.description || '',
      icon: category.icon || '',
      color: category.color || '#3B82F6',
      is_active: category.is_active,
      sort_order: category.sort_order,
      custom_fields: customFields
    })
    setSelectedCategory(category)
    setShowEditModal(true)
  }

  const handleViewCategory = (category: AssetCategory) => {
    setSelectedCategory(category)
    setShowViewModal(true)
  }

  const handleDeleteCategory = (category: AssetCategory) => {
    setSelectedCategory(category)
    setShowDeleteModal(true)
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: 'Category name is required' })
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      const categoryData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        icon: formData.icon.trim() || null,
        color: formData.color,
        is_active: formData.is_active,
        sort_order: formData.sort_order,
        custom_schema: formData.custom_fields.length > 0 ? {
          fields: formData.custom_fields
        } : null
      }

      if (selectedCategory) {
        await assetCategoriesApi.update(selectedCategory.id, categoryData)
        setMessage({ type: 'success', text: 'Category updated successfully!' })
        setShowEditModal(false)
      } else {
        await assetCategoriesApi.create(categoryData)
        setMessage({ type: 'success', text: 'Category created successfully!' })
        setShowAddModal(false)
      }

      setSelectedCategory(null)
      await loadCategories()
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      console.error('Failed to save category:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to save category' })
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDelete = async () => {
    if (!selectedCategory) return

    try {
      setSubmitting(true)
      await assetCategoriesApi.delete(selectedCategory.id)
      setMessage({ type: 'success', text: 'Category deleted successfully!' })
      setShowDeleteModal(false)
      setSelectedCategory(null)
      await loadCategories()
      setTimeout(() => setMessage(null), 3000)
    } catch (error: any) {
      console.error('Failed to delete category:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to delete category' })
    } finally {
      setSubmitting(false)
    }
  }

  const addCustomField = () => {
    setFormData(prev => ({
      ...prev,
      custom_fields: [...prev.custom_fields, {
        name: '',
        type: 'text',
        label: '',
        required: false,
        placeholder: ''
      }]
    }))
  }

  const updateCustomField = (index: number, field: Partial<CustomField>) => {
    setFormData(prev => ({
      ...prev,
      custom_fields: prev.custom_fields.map((f, i) => 
        i === index ? { ...f, ...field } : f
      )
    }))
  }

  const removeCustomField = (index: number) => {
    setFormData(prev => ({
      ...prev,
      custom_fields: prev.custom_fields.filter((_, i) => i !== index)
    }))
  }

  const moveCategory = async (categoryId: number, direction: 'up' | 'down') => {
    const sortedCategories = [...categories].sort((a, b) => a.sort_order - b.sort_order)
    const currentIndex = sortedCategories.findIndex(c => c.id === categoryId)
    
    if (currentIndex === -1) return
    if (direction === 'up' && currentIndex === 0) return
    if (direction === 'down' && currentIndex === sortedCategories.length - 1) return

    const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const currentCategory = sortedCategories[currentIndex]
    const swapCategory = sortedCategories[swapIndex]

    try {
      // Swap sort orders
      await Promise.all([
        assetCategoriesApi.update(currentCategory.id, { ...currentCategory, sort_order: swapCategory.sort_order }),
        assetCategoriesApi.update(swapCategory.id, { ...swapCategory, sort_order: currentCategory.sort_order })
      ])
      
      await loadCategories()
    } catch (error: any) {
      console.error('Failed to reorder categories:', error)
      setMessage({ type: 'error', text: 'Failed to reorder categories' })
    }
  }

  const closeModals = () => {
    setShowAddModal(false)
    setShowEditModal(false)
    setShowViewModal(false)
    setShowDeleteModal(false)
    setSelectedCategory(null)
    setMessage(null)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const fieldTypeOptions = [
    { value: 'text', label: 'Text' },
    { value: 'textarea', label: 'Textarea' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'select', label: 'Select' },
  ]

  if (loading && categories.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Asset Categories</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage asset categories and their custom field schemas
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={loadCategories}
            className="flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={handleAddCategory}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {message && (
        <div className={`card border-l-4 ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-600' 
            : 'bg-red-50 dark:bg-red-900/20 border-red-400 dark:border-red-600'
        }`}>
          <p className={`${
            message.type === 'success' 
              ? 'text-green-700 dark:text-green-300' 
              : 'text-red-700 dark:text-red-300'
          }`}>
            {message.text}
          </p>
        </div>
      )}

      {/* Categories List */}
      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Order</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Category</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Description</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Custom Fields</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Created</th>
                <th className="text-right py-3 px-4 font-medium text-gray-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr 
                  key={category.id} 
                  className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-1">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {category.sort_order}
                      </span>
                      <div className="flex flex-col">
                        <button
                          onClick={() => moveCategory(category.id, 'up')}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                          disabled={categories.findIndex(c => c.id === category.id) === 0}
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => moveCategory(category.id, 'down')}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                          disabled={categories.findIndex(c => c.id === category.id) === categories.length - 1}
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center">
                      {category.color && (
                        <div 
                          className="w-4 h-4 rounded mr-3"
                          style={{ backgroundColor: category.color }}
                        />
                      )}
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {category.name}
                        </p>
                        {category.icon && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Icon: {category.icon}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {category.description || 'No description'}
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {category.custom_schema?.fields?.length || 0} fields
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                      category.is_active 
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                    }`}>
                      {category.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(category.created_at)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleViewCategory(category)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        title="View Category"
                      >
                        <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      </button>
                      <button
                        onClick={() => handleEditCategory(category)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        title="Edit Category"
                      >
                        <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        title="Delete Category"
                      >
                        <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    No asset categories found. Create your first category to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Category Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {selectedCategory ? 'Edit Category' : 'Add Category'}
              </h2>
              <button
                onClick={closeModals}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit} className="p-6 space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., Vehicles, Jewelry, Art"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Color
                  </label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                    className="w-full h-10 border border-gray-300 dark:border-gray-600 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  rows={3}
                  placeholder="Brief description of this asset category..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Icon Name
                  </label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., car, gem, palette"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Active (available for use)
                  </span>
                </label>
              </div>

              {/* Custom Fields */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Custom Fields</h3>
                  <button
                    type="button"
                    onClick={addCustomField}
                    className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Field
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.custom_fields.map((field, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-gray-900 dark:text-white">Field {index + 1}</h4>
                        <button
                          type="button"
                          onClick={() => removeCustomField(index)}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                        >
                          <X className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Field Name *
                          </label>
                          <input
                            type="text"
                            value={field.name}
                            onChange={(e) => updateCustomField(index, { name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            placeholder="e.g., make"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Display Label *
                          </label>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => updateCustomField(index, { label: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            placeholder="e.g., Make"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Field Type *
                          </label>
                          <select
                            value={field.type}
                            onChange={(e) => updateCustomField(index, { type: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                          >
                            {fieldTypeOptions.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Placeholder
                          </label>
                          <input
                            type="text"
                            value={field.placeholder || ''}
                            onChange={(e) => updateCustomField(index, { placeholder: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                            placeholder="Placeholder text..."
                          />
                        </div>
                        
                        <div>
                          <label className="flex items-center mt-6">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => updateCustomField(index, { required: e.target.checked })}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                              Required field
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={closeModals}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      {selectedCategory ? 'Update' : 'Create'} Category
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Category Modal */}
      {showViewModal && selectedCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {selectedCategory.name}
              </h2>
              <button
                onClick={closeModals}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Description
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {selectedCategory.description || 'No description'}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Status
                  </label>
                  <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                    selectedCategory.is_active 
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                  }`}>
                    {selectedCategory.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Icon
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {selectedCategory.icon || 'No icon'}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Color
                  </label>
                  <div className="flex items-center">
                    <div 
                      className="w-4 h-4 rounded mr-2"
                      style={{ backgroundColor: selectedCategory.color }}
                    />
                    <span className="text-gray-900 dark:text-white">
                      {selectedCategory.color}
                    </span>
                  </div>
                </div>
              </div>

              {selectedCategory.custom_schema?.fields && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Custom Fields</h3>
                  <div className="space-y-3">
                    {selectedCategory.custom_schema.fields.map((field: CustomField, index: number) => (
                      <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {field.label}
                              {field.required && <span className="text-red-500 ml-1">*</span>}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Field: {field.name} | Type: {field.type}
                            </p>
                            {field.placeholder && (
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Placeholder: {field.placeholder}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Created
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {formatDate(selectedCategory.created_at)}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Last Updated
                  </label>
                  <p className="text-gray-900 dark:text-white">
                    {formatDate(selectedCategory.updated_at)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mr-4">
                  <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Delete Category
                </h3>
              </div>
              
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Are you sure you want to delete "{selectedCategory.name}"? This action cannot be undone and may affect existing assets using this category.
              </p>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={closeModals}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={submitting}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Deleting...
                    </>
                  ) : (
                    'Delete Category'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AssetCategories