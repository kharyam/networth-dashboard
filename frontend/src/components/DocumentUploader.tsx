import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, AlertCircle, CheckCircle, X } from 'lucide-react'
import { documentApi, documentUtils } from '@/services/documentApi'
import type { DocumentUploadState } from '@/types/documents'

interface DocumentUploaderProps {
  onUploadSuccess?: (jobId: number) => void
  onUploadError?: (error: string) => void
  className?: string
}

export default function DocumentUploader({
  onUploadSuccess,
  onUploadError,
  className = ''
}: DocumentUploaderProps) {
  const [uploadState, setUploadState] = useState<DocumentUploadState>({
    uploading: false,
    progress: 0
  })
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0])
    }
  }, [])

  // Handle file selection from input
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0])
    }
  }

  // Validate and set selected file
  const handleFileSelection = (file: File) => {
    const validation = documentUtils.validateFile(file)
    
    if (!validation.valid) {
      setUploadState({
        uploading: false,
        progress: 0,
        error: validation.error
      })
      onUploadError?.(validation.error || 'Invalid file')
      return
    }

    setSelectedFile(file)
    setUploadState({
      uploading: false,
      progress: 0,
      error: undefined
    })
  }

  // Upload the selected file
  const handleUpload = async () => {
    if (!selectedFile) return

    setUploadState({
      uploading: true,
      progress: 0,
      error: undefined
    })

    try {
      const response = await documentApi.uploadDocument(
        selectedFile,
        (progress) => {
          setUploadState(prev => ({ ...prev, progress }))
        }
      )

      if (response.success) {
        setUploadState({
          uploading: false,
          progress: 100,
          error: undefined
        })
        setSelectedFile(null)
        onUploadSuccess?.(response.job.id)
        
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } else {
        throw new Error(response.message || 'Upload failed')
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Upload failed'
      setUploadState({
        uploading: false,
        progress: 0,
        error: errorMessage
      })
      onUploadError?.(errorMessage)
    }
  }

  // Clear selected file
  const clearSelection = () => {
    setSelectedFile(null)
    setUploadState({
      uploading: false,
      progress: 0,
      error: undefined
    })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Open file browser
  const openFileBrowser = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Drag & Drop Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 ${
          dragActive
            ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        } ${uploadState.uploading ? 'pointer-events-none opacity-50' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.csv,.xls,.xlsx,.jpg,.jpeg,.png"
          onChange={handleFileInput}
          className="hidden"
          disabled={uploadState.uploading}
        />

        {!selectedFile ? (
          <>
            <Upload className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
            <div className="space-y-2">
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                Drop your financial statement here
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                or{' '}
                <button
                  onClick={openFileBrowser}
                  className="text-primary-600 hover:text-primary-500 font-medium"
                  disabled={uploadState.uploading}
                >
                  browse to upload
                </button>
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Supports PDF, CSV, Excel, and image files (max 10MB)
              </p>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            {/* Selected File Display */}
            <div className="flex items-center justify-center space-x-3">
              <FileText className="h-8 w-8 text-primary-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900 dark:text-white">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {documentUtils.formatFileSize(selectedFile.size)}
                </p>
              </div>
              {!uploadState.uploading && (
                <button
                  onClick={clearSelection}
                  className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Upload Progress */}
            {uploadState.uploading && (
              <div className="space-y-2">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadState.progress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Uploading... {uploadState.progress}%
                </p>
              </div>
            )}

            {/* Upload Button */}
            {!uploadState.uploading && (
              <button
                onClick={handleUpload}
                className="btn btn-primary"
                disabled={uploadState.uploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error Display */}
      {uploadState.error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Upload Error
              </h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                {uploadState.error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {uploadState.progress === 100 && !uploadState.error && !uploadState.uploading && (
        <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-4">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                Upload Successful
              </h3>
              <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                Your document has been uploaded and is ready for processing.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Supported Formats Info */}
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p className="font-medium">Supported formats:</p>
        <div className="grid grid-cols-2 gap-1">
          <span>📄 PDF statements</span>
          <span>📊 CSV exports</span>
          <span>📈 Excel files (.xls, .xlsx)</span>
          <span>🖼️ Statement images (.jpg, .png)</span>
        </div>
      </div>
    </div>
  )
}