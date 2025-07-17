# Institution Name Editing Feature

## Overview

Added the ability to edit institution names when viewing AI extraction results before approval. This allows users to correct or customize institution names that the AI may have extracted incorrectly or generically.

## Features

### Frontend Changes

**DocumentViewer Component** (`frontend/src/components/DocumentViewer.tsx`):
- Added editable institution field in Document Summary section
- Click edit icon (📝) to enable editing mode
- Inline input field with save/cancel buttons
- Press Enter to save, Escape to cancel
- Visual hint showing users can edit institution name before approval

**DocumentProcessing Page** (`frontend/src/pages/DocumentProcessing.tsx`):
- Updated approval handler to pass optional institution name override
- Seamless integration with existing workflow

**API Service** (`frontend/src/services/documentApi.ts`):
- Enhanced `approveDocument()` to accept optional institution name parameter
- Backward compatible - works with or without institution override

### Backend Changes

**API Handler** (`backend/internal/api/handlers.go`):
- Added `ApprovalRequest` struct for optional institution name override
- Enhanced approval endpoint to accept POST body with institution name
- Institution name override applied before data import
- Comprehensive logging for debugging institution name changes
- Swagger documentation updated

## How It Works

### User Flow
1. **Upload Document**: User uploads financial document
2. **AI Processing**: AI extracts financial data including institution name
3. **Review Results**: User reviews extracted data in DocumentViewer
4. **Edit Institution** (Optional): 
   - Click edit icon next to institution name
   - Modify institution name as needed
   - Save changes
5. **Approve**: Click "Approve & Import Data"
   - If institution was edited, override is sent to backend
   - Data imported with corrected institution name

### Technical Flow
1. **Frontend**: DocumentViewer tracks original vs edited institution name
2. **API Call**: Approval request includes institution override if changed
3. **Backend**: Applies institution override to extracted data before import
4. **Import**: All accounts, holdings, and transactions use corrected institution name

## API Changes

### Approval Endpoint
```
POST /api/v1/documents/{id}/approve
```

**Request Body** (Optional):
```json
{
  "institution_name": "Corrected Institution Name"
}
```

**Backward Compatibility**: Empty request body works as before.

## Use Cases

### Common Scenarios
- **Generic Names**: AI extracts "Bank" → User corrects to "Chase Bank"
- **Abbreviations**: AI extracts "MS" → User expands to "Morgan Stanley"
- **OCR Errors**: AI extracts "Fidality" → User fixes to "Fidelity"
- **Branding**: AI extracts formal name → User prefers common name

### Example Workflow
```
1. Upload: Brokerage statement PDF
2. AI Extracts: institution: "MORGAN STANLEY SMITH BARNEY LLC"
3. User Edits: "Morgan Stanley"
4. Import: All data uses "Morgan Stanley" as institution
```

## Implementation Details

### State Management
- `editableInstitution`: Current edited value
- `isEditingInstitution`: Edit mode toggle
- `useEffect`: Syncs with extracted data changes

### Validation
- Trims whitespace from institution names
- Only sends override if value actually changed
- Empty institution names fall back to original

### Error Handling
- Failed parsing of request body doesn't break approval
- Logs warning and continues with default behavior
- Maintains backward compatibility

## Benefits

1. **Accuracy**: Users can correct AI extraction errors
2. **Consistency**: Standardize institution naming across imports
3. **User Control**: Manual override for edge cases
4. **Seamless UX**: Inline editing without modal dialogs
5. **Optional**: Feature doesn't interfere with quick approvals

## Testing

### Manual Testing Checklist
- [ ] Edit institution name and verify it's used in import
- [ ] Cancel editing restores original name
- [ ] Approve without editing uses original name
- [ ] Empty institution name handling
- [ ] Keyboard shortcuts (Enter/Escape) work
- [ ] UI feedback for edit/save actions

### Test Cases
1. **Normal Flow**: Edit → Save → Approve → Verify import uses new name
2. **Cancel Flow**: Edit → Cancel → Approve → Verify import uses original name
3. **No Change**: Edit → No Change → Save → Approve → No override sent
4. **Empty Body**: Approve without editing → Backend handles gracefully

The feature integrates seamlessly with the existing document processing workflow while providing users the flexibility to correct institution names when needed.