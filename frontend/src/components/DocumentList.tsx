import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  Eye, 
  Play, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  RefreshCw, 
  Filter,
  Calendar,
  FileText,
  AlertTriangle
} from 'lucide-react'
import { documentApi, documentUtils } from '@/services/documentApi'
import type { 
  DocumentProcessingJob, 
  ProcessingStatus, 
  DocumentListFilters 
} from '@/types/documents'
import { STATUS_COLORS } from '@/types/documents'

interface DocumentListProps {
  onViewDocument?: (job: DocumentProcessingJob) => void
  onDocumentProcessed?: () => void
  refreshTrigger?: number
  className?: string
}

export default function DocumentList({
  onViewDocument,
  onDocumentProcessed,
  refreshTrigger,
  className = ''
}: DocumentListProps) {
  const [documents, setDocuments] = useState<DocumentProcessingJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<DocumentListFilters>({})
  const [showFilters, setShowFilters] = useState(false)
  const [processingJobs, setProcessingJobs] = useState<Set<number>>(new Set())
  const [autoRefresh, setAutoRefresh] = useState(true)
  const documentsRef = useRef<DocumentProcessingJob[]>([])

  // Keep ref in sync with documents state
  useEffect(() => {
    documentsRef.current = documents
  }, [documents])

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await documentApi.getDocuments(filters)
      setDocuments(response.jobs || [])
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch documents')
      setDocuments([]) // Ensure documents is always an array
    } finally {
      setLoading(false)
    }
  }, [filters])

  // Refresh documents when trigger changes
  useEffect(() => {
    fetchDocuments()
  }, [refreshTrigger, filters])

  // Auto-refresh for processing documents
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      // Check if there are any processing documents before fetching
      const hasProcessingDocs = documentsRef.current.some(doc => 
        doc.processing_status === 'processing' || doc.processing_status === 'uploaded'
      )

      if (hasProcessingDocs) {
        fetchDocuments()
      }
    }, 3000) // Refresh every 3 seconds

    return () => clearInterval(interval)
  }, [autoRefresh, fetchDocuments]) // Include fetchDocuments since it's now memoized

  // Process document
  const handleProcess = async (jobId: number) => {
    try {
      setProcessingJobs(prev => new Set(prev).add(jobId))
      await documentApi.processDocument(jobId)
      await fetchDocuments() // Refresh list
      onDocumentProcessed?.()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to process document')
    } finally {
      setProcessingJobs(prev => {
        const newSet = new Set(prev)
        newSet.delete(jobId)
        return newSet
      })
    }
  }

  // Approve document
  const handleApprove = async (jobId: number) => {
    try {
      const response = await documentApi.approveDocument(jobId)
      if (response.success) {
        await fetchDocuments() // Refresh list
        onDocumentProcessed?.()
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to approve document')
    }
  }

  // Reject document
  const handleReject = async (jobId: number) => {
    try {
      await documentApi.rejectDocument(jobId)
      await fetchDocuments() // Refresh list
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reject document')
    }
  }

  // Delete document
  const handleDelete = async (jobId: number) => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return
    }

    try {
      await documentApi.deleteDocument(jobId)
      await fetchDocuments() // Refresh list
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete document')
    }
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Get status badge component
  const getStatusBadge = (status: ProcessingStatus) => {
    const colorClass = STATUS_COLORS[status]
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    )
  }

  // Get action buttons based on status
  const getActionButtons = (job: DocumentProcessingJob) => {
    const isProcessing = processingJobs.has(job.id)
    
    return (
      <div className="flex items-center space-x-2">
        {/* View button */}
        <button
          onClick={() => onViewDocument?.(job)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="View details"
        >
          <Eye className="h-4 w-4" />
        </button>

        {/* Process button */}
        {job.processing_status === 'uploaded' && (
          <button
            onClick={() => handleProcess(job.id)}
            disabled={isProcessing}
            className="text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 disabled:opacity-50"
            title="Process with AI"
          >
            {isProcessing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </button>
        )}

        {/* Approve button */}
        {job.processing_status === 'completed' && (
          <button
            onClick={() => handleApprove(job.id)}
            className="text-green-400 hover:text-green-600 dark:hover:text-green-300"
            title="Approve and import data"
          >
            <CheckCircle className="h-4 w-4" />
          </button>
        )}

        {/* Reject button */}
        {job.processing_status === 'completed' && (
          <button
            onClick={() => handleReject(job.id)}
            className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
            title="Reject data"
          >
            <XCircle className="h-4 w-4" />
          </button>
        )}

        {/* Delete button */}
        {!['processing'].includes(job.processing_status) && (
          <button
            onClick={() => handleDelete(job.id)}
            className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
            title="Delete document"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <RefreshCw className="h-6 w-6 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading documents...</span>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with filters */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Document Processing Jobs
        </h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn btn-secondary btn-sm"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </button>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`btn btn-sm ${autoRefresh ? 'btn-primary' : 'btn-secondary'}`}
              title={autoRefresh ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh && documents.some(d => d.processing_status === 'processing') ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto' : 'Manual'}
            </button>
            <button
              onClick={fetchDocuments}
              className="btn btn-secondary btn-sm"
              title="Manual refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card bg-gray-50 dark:bg-gray-800/50 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) => setFilters(prev => ({ 
                  ...prev, 
                  status: e.target.value as ProcessingStatus || undefined 
                }))}
                className="input input-sm w-full"
              >
                <option value="">All statuses</option>
                <option value="uploaded">Uploaded</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                File Type
              </label>
              <select
                value={filters.fileType || ''}
                onChange={(e) => setFilters(prev => ({ 
                  ...prev, 
                  fileType: e.target.value || undefined 
                }))}
                className="input input-sm w-full"
              >
                <option value="">All types</option>
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
                <option value="xls">Excel</option>
                <option value="xlsx">Excel</option>
                <option value="jpg">Image</option>
                <option value="png">Image</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({})}
                className="btn btn-secondary btn-sm"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Error
              </h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Document List */}
      {!documents || documents.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No documents found
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Upload your first financial statement to get started
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Document
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Uploaded
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {documents?.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-lg mr-3">
                          {documentUtils.getFileTypeIcon(job.file_type)}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {job.filename}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {job.file_type.toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {getStatusBadge(job.processing_status as ProcessingStatus)}
                        {job.error_message && (
                          <div className="text-xs text-red-600 dark:text-red-400 max-w-xs break-words" title={job.error_message}>
                            {job.error_message}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {formatDate(job.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {documentUtils.formatFileSize(job.file_size)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {getActionButtons(job)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}