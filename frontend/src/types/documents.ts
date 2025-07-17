// Document processing types for LLM-powered financial statement analysis

export interface DocumentProcessingJob {
  id: number
  filename: string
  file_path: string
  file_type: string
  file_size: number
  processing_status: ProcessingStatus
  extracted_data?: string
  error_message?: string
  created_at: string
  updated_at: string
}

export enum ProcessingStatus {
  UPLOADED = 'uploaded',
  PROCESSING = 'processing', 
  COMPLETED = 'completed',
  FAILED = 'failed',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export interface FinancialDocumentData {
  document_type: DocumentType
  institution: string
  accounts: ExtractedAccount[]
  transactions: ExtractedTransaction[]
  holdings: ExtractedHolding[]
  crypto: ExtractedCrypto[]
  metadata: DocumentMetadata
}

export type DocumentType = 'bank_statement' | 'investment_statement' | 'credit_card_statement' | 'other'

export interface ExtractedAccount {
  account_number: string
  account_type: AccountType
  balance: number
  currency: string
  name?: string
}

export type AccountType = 'checking' | 'savings' | 'investment' | 'credit' | '401k' | 'ira' | 'taxable_brokerage'

export interface ExtractedTransaction {
  date: string // YYYY-MM-DD format
  amount: number
  description: string
  category?: TransactionCategory
  type?: TransactionType
}

export type TransactionCategory = 'food' | 'gas' | 'shopping' | 'transfer' | 'dividend' | 'other'
export type TransactionType = 'debit' | 'credit'

export interface ExtractedHolding {
  symbol: string
  shares: number
  price: number
  value: number
  description?: string
}

export interface ExtractedCrypto {
  symbol: string
  balance: number
  price: number
  value: number
  wallet_type?: string
  description?: string
}

export interface DocumentMetadata {
  statement_date?: string
  statement_period?: string
  confidence_score: ConfidenceLevel
  [key: string]: any
}

export type ConfidenceLevel = 'High' | 'Medium' | 'Low'

// UI state types
export interface DocumentUploadState {
  uploading: boolean
  progress: number
  error?: string
}

export interface DocumentListFilters {
  status?: ProcessingStatus
  dateRange?: {
    start: string
    end: string
  }
  fileType?: string
}

export interface DataReviewState {
  selectedJob: DocumentProcessingJob | null
  extractedData: FinancialDocumentData | null
  reviewMode: 'view' | 'edit' | 'approve'
  hasChanges: boolean
}

// API response types
export interface DocumentUploadResponse {
  success: boolean
  job: DocumentProcessingJob
  message?: string
}

export interface DocumentListResponse {
  jobs: DocumentProcessingJob[]
  total: number
  page: number
  limit: number
}

export interface ProcessDocumentResponse {
  success: boolean
  message: string
  job: DocumentProcessingJob
}

export interface ApproveDocumentResponse {
  success: boolean
  message: string
  imported_accounts: number
  imported_transactions: number
  imported_holdings: number
}

// File upload validation
export interface FileValidation {
  maxSize: number // in bytes
  allowedTypes: string[]
  allowedExtensions: string[]
}

export const DOCUMENT_VALIDATION: FileValidation = {
  maxSize: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/jpg', 
    'image/png'
  ],
  allowedExtensions: ['.pdf', '.csv', '.xls', '.xlsx', '.jpg', '.jpeg', '.png']
}

// Status display helpers
export const STATUS_COLORS: Record<ProcessingStatus, string> = {
  [ProcessingStatus.UPLOADED]: 'bg-blue-100 text-blue-800',
  [ProcessingStatus.PROCESSING]: 'bg-yellow-100 text-yellow-800',
  [ProcessingStatus.COMPLETED]: 'bg-green-100 text-green-800',
  [ProcessingStatus.FAILED]: 'bg-red-100 text-red-800',
  [ProcessingStatus.APPROVED]: 'bg-purple-100 text-purple-800',
  [ProcessingStatus.REJECTED]: 'bg-gray-100 text-gray-800'
}

export const STATUS_DESCRIPTIONS: Record<ProcessingStatus, string> = {
  [ProcessingStatus.UPLOADED]: 'Document uploaded successfully, ready for processing',
  [ProcessingStatus.PROCESSING]: 'AI is analyzing the document and extracting financial data',
  [ProcessingStatus.COMPLETED]: 'Processing complete, ready for review and approval',
  [ProcessingStatus.FAILED]: 'Processing failed, please check document format and try again',
  [ProcessingStatus.APPROVED]: 'Data approved and imported into your dashboard',
  [ProcessingStatus.REJECTED]: 'Data rejected, no changes made to your dashboard'
}