// based on source restriction decide the icon color
export const getSourceIconColor = (source: SourceType) => {
  if (source.is_schema_readonly && source.is_data_readonly) {
    return '#de0062'
  }
  if (source.is_schema_readonly) {
    return '#df830f'
  }
  if (source.is_data_readonly) {
    return '#278bff'
  }
  return '#278bff'
}

// based on source restriction decide the tooltip message with docs link
export const getSourceTooltip = (source: SourceType) => {
  if (source.is_schema_readonly && source.is_data_readonly) {
    return `External source is connected in Read Only Mode. Schema and Data is not editable.`
  }
  if (source.is_schema_readonly) {
    return 'Data Edit is enabled. Schema is in disabled state.'
  }
  if (source.is_data_readonly) {
    return 'Schema Edit is enabled. Data is in disabled state.'
  }
  return 'Both Data and Schema Editing is enabled. We suggest to disable Schema editing.'
}
