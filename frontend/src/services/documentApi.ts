import axios from 'axios'
import { logger, criticalLogger } from '@/utils/logger'
import type {
  DocumentProcessingJob,
  DocumentUploadResponse,
  DocumentListResponse,
  ProcessDocumentResponse,
  ApproveDocumentResponse,
  DocumentListFilters
} from '@/types/documents'

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for auth and logging
api.interceptors.request.use((config) => {
  logger.log('🌐 [DocumentAPI] REQUEST:', {
    method: config.method?.toUpperCase(),
    url: config.url,
    baseURL: config.baseURL,
    fullURL: `${config.baseURL}${config.url}`,
    params: config.params,
    headers: config.headers
  })
  
  return config
}, (error) => {
  criticalLogger.error('❌ [DocumentAPI] REQUEST ERROR:', error)
  return Promise.reject(error)
})

// Response interceptor for error handling and logging
api.interceptors.response.use(
  (response) => {
    logger.log('✅ [DocumentAPI] RESPONSE:', {
      status: response.status,
      statusText: response.statusText,
      url: response.config.url,
      method: response.config.method?.toUpperCase(),
      data: response.data
    })
    return response
  },
  (error) => {
    criticalLogger.error('❌ [DocumentAPI] RESPONSE ERROR:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      responseData: error.response?.data,
      requestData: error.config?.data
    })
    return Promise.reject(error)
  }
)

// Document Processing API
export const documentApi = {
  /**
   * Upload a financial document for processing
   */
  uploadDocument: async (file: File, onProgress?: (progress: number) => void): Promise<DocumentUploadResponse> => {
    const formData = new FormData()
    formData.append('file', file)

    const config = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      ...(onProgress && {
        onUploadProgress: (progressEvent: any) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      })
    }

    const response = await api.post('/documents/upload', formData, config)
    return response.data
  },

  /**
   * Get list of document processing jobs with optional filtering
   */
  getDocuments: async (filters?: DocumentListFilters, page: number = 1, limit: number = 20): Promise<DocumentListResponse> => {
    const offset = (page - 1) * limit
    const params = new URLSearchParams({
      offset: offset.toString(),
      limit: limit.toString()
    })

    if (filters?.status) {
      params.append('status', filters.status)
    }
    if (filters?.fileType) {
      params.append('file_type', filters.fileType)
    }
    if (filters?.dateRange?.start) {
      params.append('start_date', filters.dateRange.start)
    }
    if (filters?.dateRange?.end) {
      params.append('end_date', filters.dateRange.end)
    }

    const response = await api.get(`/documents?${params.toString()}`)
    return response.data
  },

  /**
   * Get a specific document processing job by ID
   */
  getDocument: async (jobId: number): Promise<DocumentProcessingJob> => {
    const response = await api.get(`/documents/${jobId}`)
    return response.data
  },

  /**
   * Process a document using LLM analysis
   */
  processDocument: async (jobId: number): Promise<ProcessDocumentResponse> => {
    const response = await api.post(`/documents/${jobId}/process`)
    return response.data
  },

  /**
   * Approve extracted data and import into dashboard
   */
  approveDocument: async (jobId: number, institutionName?: string): Promise<ApproveDocumentResponse> => {
    const requestBody = institutionName ? { institution_name: institutionName } : {}
    const response = await api.post(`/documents/${jobId}/approve`, requestBody)
    return response.data
  },

  /**
   * Reject extracted data (no import)
   */
  rejectDocument: async (jobId: number): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/documents/${jobId}/reject`)
    return response.data
  },

  /**
   * Delete a document processing job
   */
  deleteDocument: async (jobId: number): Promise<void> => {
    await api.delete(`/documents/${jobId}`)
  },

  /**
   * Get health status of document processing system
   */
  getProcessingHealth: async (): Promise<{
    llm_enabled: boolean
    llm_status: string
    upload_dir_writable: boolean
    pending_jobs: number
  }> => {
    const response = await api.get('/documents/health')
    return response.data
  }
}

// Utility functions for document processing
export const documentUtils = {
  /**
   * Validate file before upload
   */
  validateFile: (file: File): { valid: boolean; error?: string } => {
    const maxSize = 10 * 1024 * 1024 // 10MB
    const allowedTypes = [
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png'
    ]

    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds maximum allowed size (10MB)`
      }
    }

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type '${file.type}' is not supported. Please upload PDF, CSV, Excel, or image files.`
      }
    }

    return { valid: true }
  },

  /**
   * Format file size for display
   */
  formatFileSize: (bytes: number): string => {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  },

  /**
   * Get file type icon
   */
  getFileTypeIcon: (fileType: string): string => {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return '📄'
      case 'csv':
        return '📊'
      case 'xls':
      case 'xlsx':
        return '📈'
      case 'jpg':
      case 'jpeg':
      case 'png':
        return '🖼️'
      default:
        return '📁'
    }
  },

  /**
   * Parse extracted data safely
   */
  parseExtractedData: (jsonString?: string): any | null => {
    if (!jsonString) return null
    
    try {
      return JSON.parse(jsonString)
    } catch (error) {
      criticalLogger.error('Failed to parse extracted data:', error)
      return null
    }
  }
}