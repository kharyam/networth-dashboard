import { useState, useEffect } from 'react'
import { FileText, Brain, CheckCircle, AlertTriangle } from 'lucide-react'
import DocumentUploader from '@/components/DocumentUploader'
import DocumentList from '@/components/DocumentList'
import DocumentViewer from '@/components/DocumentViewer'
import { documentApi } from '@/services/documentApi'
import type { DocumentProcessingJob, FinancialDocumentData } from '@/types/documents'

export default function DocumentProcessing() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [systemHealth, setSystemHealth] = useState<{
    llm_enabled: boolean
    llm_status: string
    upload_dir_writable: boolean
    pending_jobs: number
  } | null>(null)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [selectedJob, setSelectedJob] = useState<DocumentProcessingJob | null>(null)
  const [extractedData, setExtractedData] = useState<FinancialDocumentData | null>(null)
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [isLoadingDocument, setIsLoadingDocument] = useState(false)

  // Fetch system health status
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const health = await documentApi.getProcessingHealth()
        setSystemHealth(health)
      } catch (error) {
        console.error('Failed to fetch system health:', error)
      }
    }

    fetchHealth()
  }, [])

  // Handle successful upload
  const handleUploadSuccess = (_jobId: number) => {
    setRefreshTrigger(prev => prev + 1)
    setShowSuccessMessage(true)
    setTimeout(() => setShowSuccessMessage(false), 5000)
  }

  // Handle upload error
  const handleUploadError = (error: string) => {
    // Error is already handled in the uploader component
    console.error('Upload error:', error)
  }

  // Handle document processing completion
  const handleDocumentProcessed = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  // Handle document view
  const handleViewDocument = async (job: DocumentProcessingJob) => {
    setSelectedJob(job)
    setIsViewerOpen(true)
    setExtractedData(null) // Reset while loading
    setIsLoadingDocument(true)
    
    try {
      // Fetch the complete document data including extracted_data
      const fullJob = await documentApi.getDocument(job.id)
      
      // Update the selected job with complete data
      setSelectedJob(fullJob)
      
      // Parse extracted data if available
      if (fullJob.extracted_data) {
        try {
          const data = JSON.parse(fullJob.extracted_data) as FinancialDocumentData
          setExtractedData(data)
        } catch (error) {
          console.error('Failed to parse extracted data:', error)
          setExtractedData(null)
        }
      } else {
        setExtractedData(null)
      }
    } catch (error) {
      console.error('Failed to fetch document details:', error)
      // Fallback to original job data
      setSelectedJob(job)
      setExtractedData(null)
    } finally {
      setIsLoadingDocument(false)
    }
  }

  // Handle document approval
  const handleApproveDocument = async (job: DocumentProcessingJob, institutionName?: string) => {
    try {
      await documentApi.approveDocument(job.id, institutionName)
      setRefreshTrigger(prev => prev + 1)
      setIsViewerOpen(false)
      // Could show success message here
    } catch (error) {
      console.error('Failed to approve document:', error)
      // Could show error message here
    }
  }

  // Handle viewer close
  const handleViewerClose = () => {
    setIsViewerOpen(false)
    setSelectedJob(null)
    setExtractedData(null)
    setIsLoadingDocument(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Document Processing
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Upload financial statements and let AI extract your data automatically
          </p>
        </div>
        
        {/* System Status */}
        {systemHealth && (
          <div className="text-right">
            <div className="flex items-center space-x-2">
              {systemHealth.llm_enabled ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm text-green-600 dark:text-green-400">
                    AI Processing Active
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <span className="text-sm text-red-600 dark:text-red-400">
                    AI Processing Disabled
                  </span>
                </>
              )}
            </div>
            {systemHealth.pending_jobs > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {systemHealth.pending_jobs} job(s) pending
              </p>
            )}
          </div>
        )}
      </div>

      {/* Success Message */}
      {showSuccessMessage && (
        <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-4">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                Upload Successful
              </h3>
              <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                Your document has been uploaded successfully. You can now process it with AI to extract financial data.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* LLM Status Warning */}
      {systemHealth && !systemHealth.llm_enabled && (
        <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                AI Processing Unavailable
              </h3>
              <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                The LLM service is currently disabled. You can still upload documents, but automatic processing will not be available. 
                Please check your configuration or contact your administrator.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mx-auto mb-3">
              <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">1. Upload</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Upload your financial statements (PDF, CSV, Excel, or images)
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">2. Process</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              AI analyzes your document and extracts accounts, transactions, and holdings
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">3. Review</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Review the extracted data and approve what you want to import
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center mx-auto mb-3">
              <FileText className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">4. Import</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Data is automatically imported into your dashboard
            </p>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Upload Document
            </h2>
            <DocumentUploader
              onUploadSuccess={handleUploadSuccess}
              onUploadError={handleUploadError}
            />
          </div>
        </div>

        {/* Document List */}
        <div className="lg:col-span-2">
          <DocumentList
            onViewDocument={handleViewDocument}
            onDocumentProcessed={handleDocumentProcessed}
            refreshTrigger={refreshTrigger}
          />
        </div>
      </div>

      {/* Supported Document Types */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Supported Document Types
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">Bank Statements</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• Account balances and information</li>
              <li>• Transaction history</li>
              <li>• Direct deposits and transfers</li>
              <li>• Fee and interest details</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">Investment Statements</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• Portfolio holdings and values</li>
              <li>• Stock and bond positions</li>
              <li>• Dividend and distribution history</li>
              <li>• Account performance metrics</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">Credit Card Statements</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• Account balances and limits</li>
              <li>• Purchase transactions</li>
              <li>• Payment history</li>
              <li>• Interest and fee charges</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">File Formats</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li>• PDF documents</li>
              <li>• CSV exports</li>
              <li>• Excel files (.xls, .xlsx)</li>
              <li>• Image files (.jpg, .png)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Tips for Better Results */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-4">
          Tips for Better Results
        </h2>
        <div className="space-y-3 text-sm text-blue-800 dark:text-blue-300">
          <div className="flex items-start">
            <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
            <span>Use high-quality, clear images or PDFs for best AI recognition</span>
          </div>
          <div className="flex items-start">
            <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
            <span>Ensure all text is readable and not cut off at edges</span>
          </div>
          <div className="flex items-start">
            <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
            <span>Complete statements work better than partial pages</span>
          </div>
          <div className="flex items-start">
            <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
            <span>Review extracted data before approving to ensure accuracy</span>
          </div>
        </div>
      </div>

      {/* Document Viewer Modal */}
      {selectedJob && (
        <DocumentViewer
          job={selectedJob}
          extractedData={extractedData}
          isOpen={isViewerOpen}
          onClose={handleViewerClose}
          onApprove={handleApproveDocument}
          isLoading={isLoadingDocument}
        />
      )}
    </div>
  )
}