/**
 * Utility functions for handling custom fields transformation
 * between nested JSON storage format and flattened form field names
 */

/**
 * Flattens nested custom fields for form initialization
 * Transforms: {custom_fields: {make: "Honda"}} → {"custom_fields.make": "Honda"}
 */
export function flattenCustomFields(customFields: Record<string, any> | undefined): Record<string, any> {
  if (!customFields) return {}
  
  const flattened: Record<string, any> = {}
  Object.keys(customFields).forEach(fieldName => {
    flattened[`custom_fields.${fieldName}`] = customFields[fieldName]
  })
  
  return flattened
}

/**
 * Flattens custom fields from parsed entry data (for manual entries)
 * Used when editing entries from the manual entries page
 */
export function flattenCustomFieldsFromParsedData(parsed: Record<string, any>): Record<string, any> {
  if (!parsed.custom_fields) return parsed
  
  // Flatten custom fields from nested object to dotted notation
  const customFields = parsed.custom_fields
  Object.keys(customFields).forEach(fieldName => {
    parsed[`custom_fields.${fieldName}`] = customFields[fieldName]
  })
  
  // Remove the original nested custom_fields object
  delete parsed.custom_fields
  
  return parsed
}