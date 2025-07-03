import { useState, useEffect, useCallback } from 'react'
import { logger } from '@/utils/logger'

export interface AssetCRUDConfig<T> {
  // API functions
  fetchAll: () => Promise<T[]>
  create?: (data: any) => Promise<T>
  update?: (id: number, data: any) => Promise<T>
  delete?: (id: number) => Promise<void>
  
  // Schema functions for forms
  fetchSchema?: () => Promise<any>
  fetchSchemaForCategory?: (categoryId: number) => Promise<any>
  
  // Data transformation
  transformData?: (rawData: any[]) => T[]
  
  // Entity name for error messages
  entityName: string
}

export interface AssetCRUDState<T> {
  // Data state
  items: T[]
  rawData: any
  loading: boolean
  refreshing: boolean
  error: string | null
  
  // Modal states
  addModalOpen: boolean
  editModalOpen: boolean
  viewModalOpen: boolean
  deleteModalOpen: boolean
  selectedItem: T | null
  
  // Form states
  schema: any | null
  submitting: boolean
  message: { type: 'success' | 'error', text: string } | null
  
  // View state
  viewMode: 'grid' | 'list' | 'charts' | string
}

export interface AssetCRUDActions<T> {
  // Data actions
  loadItems: () => Promise<void>
  refreshItems: () => Promise<void>
  
  // Modal actions
  openAddModal: () => void
  openEditModal: (item: T) => void
  openViewModal: (item: T) => void
  openDeleteModal: (item: T) => void
  closeModals: () => void
  
  // CRUD actions
  handleCreate: (formData: any) => Promise<void>
  handleUpdate: (formData: any) => Promise<void>
  handleDelete: () => Promise<void>
  
  // Schema actions
  loadSchemaForCategory: (categoryId: number) => Promise<void>
  
  // UI actions
  setViewMode: (mode: 'grid' | 'list' | 'charts') => void
  clearMessage: () => void
  clearError: () => void
}

export function useAssetCRUD<T extends { id: number }>(
  config: AssetCRUDConfig<T>
): [AssetCRUDState<T>, AssetCRUDActions<T>] {
  
  // Data state
  const [items, setItems] = useState<T[]>([])
  const [rawData, setRawData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<T | null>(null)
  
  // Form states
  const [schema, setSchema] = useState<any | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'charts' | string>('grid')

  // Load items from API
  const loadItems = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const rawDataResponse = await config.fetchAll()
      setRawData(rawDataResponse)
      const transformedData = config.transformData ? config.transformData(rawDataResponse) : rawDataResponse
      setItems(transformedData)
      logger.log(`✅ Loaded ${transformedData.length} ${config.entityName}(s)`)
    } catch (err: any) {
      logger.error(`❌ Failed to load ${config.entityName}s:`, err)
      setError(`Failed to load ${config.entityName}s. Please try again.`)
    } finally {
      setLoading(false)
    }
  }, [config])

  // Refresh items (for manual refresh)
  const refreshItems = useCallback(async () => {
    try {
      setRefreshing(true)
      setError(null)
      const rawDataResponse = await config.fetchAll()
      setRawData(rawDataResponse)
      const transformedData = config.transformData ? config.transformData(rawDataResponse) : rawDataResponse
      setItems(transformedData)
      logger.log(`🔄 Refreshed ${transformedData.length} ${config.entityName}(s)`)
    } catch (err: any) {
      logger.error(`❌ Failed to refresh ${config.entityName}s:`, err)
      setError(`Failed to refresh ${config.entityName}s. Please try again.`)
    } finally {
      setRefreshing(false)
    }
  }, [config])

  // Load schema if available
  const loadSchema = useCallback(async () => {
    if (config.fetchSchema) {
      try {
        const schemaData = await config.fetchSchema()
        setSchema(schemaData)
        logger.log(`✅ Loaded schema for ${config.entityName}`)
      } catch (err: any) {
        logger.error(`❌ Failed to load schema for ${config.entityName}:`, err)
      }
    }
  }, [config])

  // Load schema for specific category
  const loadSchemaForCategory = useCallback(async (categoryId: number) => {
    if (config.fetchSchemaForCategory) {
      try {
        const schemaData = await config.fetchSchemaForCategory(categoryId)
        setSchema(schemaData)
        logger.log(`✅ Loaded schema for ${config.entityName} category ${categoryId}`)
      } catch (err: any) {
        logger.error(`❌ Failed to load schema for ${config.entityName} category ${categoryId}:`, err)
      }
    }
  }, [config])

  // Modal actions
  const openAddModal = useCallback(() => {
    setAddModalOpen(true)
  }, [])

  const openEditModal = useCallback((item: T) => {
    setSelectedItem(item)
    setEditModalOpen(true)
  }, [])

  const openViewModal = useCallback((item: T) => {
    setSelectedItem(item)
    setViewModalOpen(true)
  }, [])

  const openDeleteModal = useCallback((item: T) => {
    setSelectedItem(item)
    setDeleteModalOpen(true)
  }, [])

  const closeModals = useCallback(() => {
    setAddModalOpen(false)
    setEditModalOpen(false)
    setViewModalOpen(false)
    setDeleteModalOpen(false)
    setSelectedItem(null)
  }, [])

  // CRUD actions
  const handleCreate = useCallback(async (formData: any) => {
    if (!config.create) {
      throw new Error(`Create not supported for ${config.entityName}`)
    }

    setSubmitting(true)
    setMessage(null)

    try {
      await config.create(formData)
      setMessage({ type: 'success', text: `${config.entityName} added successfully!` })
      await loadItems() // Refresh items
      closeModals()
      
      // Clear success message after delay
      setTimeout(() => setMessage(null), 3000)
    } catch (err: any) {
      logger.error(`❌ Failed to create ${config.entityName}:`, err)
      const errorMessage = err.response?.data?.error || `Failed to add ${config.entityName}. Please try again.`
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setSubmitting(false)
    }
  }, [config, loadItems, closeModals])

  const handleUpdate = useCallback(async (formData: any) => {
    if (!config.update || !selectedItem) {
      throw new Error(`Update not supported for ${config.entityName} or no item selected`)
    }

    setSubmitting(true)
    setMessage(null)

    try {
      await config.update(selectedItem.id, formData)
      setMessage({ type: 'success', text: `${config.entityName} updated successfully!` })
      await loadItems() // Refresh items
      closeModals()
      
      // Clear success message after delay
      setTimeout(() => setMessage(null), 3000)
    } catch (err: any) {
      logger.error(`❌ Failed to update ${config.entityName}:`, err)
      const errorMessage = err.response?.data?.error || `Failed to update ${config.entityName}. Please try again.`
      setMessage({ type: 'error', text: errorMessage })
    } finally {
      setSubmitting(false)
    }
  }, [config, selectedItem, loadItems, closeModals])

  const handleDelete = useCallback(async () => {
    if (!config.delete || !selectedItem) {
      throw new Error(`Delete not supported for ${config.entityName} or no item selected`)
    }

    try {
      await config.delete(selectedItem.id)
      await loadItems() // Refresh items
      closeModals()
      setMessage({ type: 'success', text: `${config.entityName} deleted successfully!` })
      
      // Clear success message after delay
      setTimeout(() => setMessage(null), 3000)
    } catch (err: any) {
      logger.error(`❌ Failed to delete ${config.entityName}:`, err)
      setError(`Failed to delete ${config.entityName}. Please try again.`)
    }
  }, [config, selectedItem, loadItems, closeModals])

  // UI actions
  const clearMessage = useCallback(() => {
    setMessage(null)
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Initialize data on mount
  useEffect(() => {
    const initialize = async () => {
      await Promise.all([
        loadItems(),
        loadSchema()
      ])
    }
    
    initialize()
  }, [loadItems, loadSchema])

  // State object
  const state: AssetCRUDState<T> = {
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
  }

  // Actions object
  const actions: AssetCRUDActions<T> = {
    loadItems,
    refreshItems,
    openAddModal,
    openEditModal,
    openViewModal,
    openDeleteModal,
    closeModals,
    handleCreate,
    handleUpdate,
    handleDelete,
    loadSchemaForCategory,
    setViewMode,
    clearMessage,
    clearError
  }

  return [state, actions]
}