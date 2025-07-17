import { X, FileText, Building2, AlertCircle, CheckCircle, Edit2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { DocumentProcessingJob, FinancialDocumentData } from '@/types/documents'

interface DocumentViewerProps {
  job: DocumentProcessingJob
  extractedData: FinancialDocumentData | null
  isOpen: boolean
  onClose: () => void
  onApprove?: (job: DocumentProcessingJob, institutionName?: string) => void
  isLoading?: boolean
}

export default function DocumentViewer({ 
  job, 
  extractedData, 
  isOpen, 
  onClose, 
  onApprove,
  isLoading = false
}: DocumentViewerProps) {
  const [editableInstitution, setEditableInstitution] = useState<string>('')
  const [isEditingInstitution, setIsEditingInstitution] = useState(false)

  // Update editable institution when extracted data changes
  useEffect(() => {
    if (extractedData?.institution) {
      setEditableInstitution(extractedData.institution)
    }
  }, [extractedData?.institution])

  if (!isOpen) return null

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20'
      case 'processing':
        return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20'
      case 'failed':
        return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20'
      case 'approved':
        return 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/20'
      case 'rejected':
        return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20'
      default:
        return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20'
    }
  }

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  const handleApprove = () => {
    if (onApprove) {
      const institutionToUse = editableInstitution.trim() !== extractedData?.institution?.trim() 
        ? editableInstitution.trim() 
        : undefined
      onApprove(job, institutionToUse)
    }
  }

  const handleInstitutionEdit = () => {
    setIsEditingInstitution(true)
  }

  const handleInstitutionSave = () => {
    setIsEditingInstitution(false)
  }

  const handleInstitutionCancel = () => {
    setEditableInstitution(extractedData?.institution || '')
    setIsEditingInstitution(false)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-6xl bg-white dark:bg-gray-800 rounded-lg shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center space-x-3">
              <FileText className="h-6 w-6 text-gray-600 dark:text-gray-400" />
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {job.filename}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Uploaded {formatDate(job.created_at)}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.processing_status)}`}>
                {job.processing_status}
              </span>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[80vh] overflow-y-auto">
            {/* Job Details */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  File Size
                </label>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {(job.file_size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  File Type
                </label>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 uppercase">
                  {job.file_type}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Last Updated
                </label>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {formatDate(job.updated_at)}
                </p>
              </div>
            </div>

            {/* Error Message */}
            {job.error_message && (
              <div className="mb-6 rounded-md bg-red-50 dark:bg-red-900/20 p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                      Processing Error
                    </h3>
                    <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                      {job.error_message}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Extracted Data */}
            {extractedData && (
              <div className="space-y-6">
                {/* Document Summary */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <Building2 className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-2" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        Document Summary
                      </h3>
                    </div>
                    {extractedData && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Click <Edit2 className="h-3 w-3 inline mx-1" /> to edit institution name before approval
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Type:</span>
                      <span className="ml-2 text-gray-900 dark:text-gray-100 capitalize">
                        {extractedData.document_type.replace('_', ' ')}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Institution:</span>
                      {isEditingInstitution ? (
                        <div className="ml-2 flex items-center space-x-2">
                          <input
                            type="text"
                            value={editableInstitution}
                            onChange={(e) => setEditableInstitution(e.target.value)}
                            className="px-2 py-1 text-sm border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white flex-1"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleInstitutionSave()
                              if (e.key === 'Escape') handleInstitutionCancel()
                            }}
                          />
                          <button
                            onClick={handleInstitutionSave}
                            className="text-green-600 hover:text-green-700 dark:text-green-400"
                            title="Save"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                          <button
                            onClick={handleInstitutionCancel}
                            className="text-gray-600 hover:text-gray-700 dark:text-gray-400"
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="ml-2 flex items-center space-x-2">
                          <span className="text-gray-900 dark:text-gray-100">
                            {editableInstitution}
                          </span>
                          <button
                            onClick={handleInstitutionEdit}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            title="Edit institution name"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Confidence:</span>
                      <span className="ml-2 text-gray-900 dark:text-gray-100">
                        {extractedData.metadata.confidence_score}
                      </span>
                    </div>
                  </div>
                  {extractedData.metadata.statement_date && (
                    <div className="mt-2 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Statement Date:</span>
                      <span className="ml-2 text-gray-900 dark:text-gray-100">
                        {formatDate(extractedData.metadata.statement_date)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Accounts */}
                {extractedData.accounts.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                      Accounts ({extractedData.accounts.length})
                    </h3>
                    <div className="space-y-3">
                      {extractedData.accounts.map((account, index) => (
                        <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-gray-900 dark:text-white">
                                {account.name || 'Account'}
                              </h4>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {account.account_type.replace('_', ' ').toUpperCase()} • {account.account_number}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                {formatCurrency(account.balance, account.currency)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transactions */}
                {extractedData.transactions.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                      Transactions ({extractedData.transactions.length})
                    </h3>
                    <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                        <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Date
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Description
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Category
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Amount
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                          {extractedData.transactions.map((transaction, index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                {formatDate(transaction.date)}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                                <div className="max-w-xs truncate">{transaction.description}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                  {transaction.category}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                <span className={transaction.type === 'debit' 
                                  ? 'text-red-600 dark:text-red-400' 
                                  : 'text-green-600 dark:text-green-400'
                                }>
                                  {transaction.type === 'debit' ? '-' : '+'}
                                  {formatCurrency(transaction.amount)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Holdings */}
                {extractedData.holdings.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                      Holdings ({extractedData.holdings.length})
                    </h3>
                    <div className="space-y-3">
                      {extractedData.holdings.map((holding, index) => (
                        <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-gray-900 dark:text-white">
                                {holding.symbol}
                              </h4>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {holding.description}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {holding.shares.toLocaleString()} shares @ {formatCurrency(holding.price)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                {formatCurrency(holding.value)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Crypto Holdings */}
                {extractedData.crypto && extractedData.crypto.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                      Cryptocurrency ({extractedData.crypto.length})
                    </h3>
                    <div className="space-y-3">
                      {extractedData.crypto.map((crypto, index) => (
                        <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-gray-900 dark:text-white">
                                {crypto.symbol}
                              </h4>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {crypto.description}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {crypto.balance.toLocaleString()} tokens @ {formatCurrency(crypto.price)}
                              </p>
                              {crypto.wallet_type && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  Wallet: {crypto.wallet_type}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                {formatCurrency(crypto.value)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <h3 className="mt-4 text-sm font-medium text-gray-900 dark:text-white">
                  Loading document data...
                </h3>
              </div>
            )}

            {/* No Data Message */}
            {!extractedData && !isLoading && job.processing_status === 'completed' && (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                  No extracted data available
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  The document was processed but no financial data could be extracted.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-6">
            <div className="flex justify-between">
              <button
                onClick={onClose}
                className="btn-secondary"
              >
                Close
              </button>
              
              {extractedData && job.processing_status === 'completed' && onApprove && (
                <button
                  onClick={handleApprove}
                  className="btn-primary flex items-center space-x-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  <span>Approve & Import Data</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}