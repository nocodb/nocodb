const config = input.config({
  title: 'Find and replace',
  description: `This script will find and replace all text matches for a text-based field you pick.
    You will be able to see all matches before replacing them.`,
  items: [input.config.table('table', { label: 'Table' }), input.config.field('field', { parentTable: 'table', label: 'Field' })],
})

const { table, field } = config
output.text(`Finding and replacing in the ${field.name} field of ${table.name}.`)

const findText = await input.textAsync('Enter text to find:')
const replaceText = await input.textAsync('Enter to replace matches with:')

// Load all of the records in the table
const result = await table.selectRecordsAsync()

// Find every record we need to update
const replacements = []
for (const record of result.records) {
  const originalValue = record.getCellValue(field)

  // Skip non-string records
  if (typeof originalValue !== 'string') {
    continue
  }

  // Skip records which don't have the value set, so the value is null
  if (!originalValue) {
    continue
  }

  const newValue = originalValue.replace(findText, replaceText)

  if (originalValue !== newValue) {
    replacements.push({
      record,
      before: originalValue,
      after: newValue,
    })
  }
}
if (!replacements.length) {
  output.text('No replacements found')
} else {
  output.markdown('## Replacements')
  output.table(replacements)

  const shouldReplace = await input.buttonsAsync('Are you sure you want to save these changes?', [
    { label: 'Save', variant: 'danger' },
    { label: 'Cancel' },
  ])

  if (shouldReplace === 'Save') {
    // Update the records
    let updates = replacements.map((replacement) => ({
      id: replacement.record.id,
      fields: {
        [field.id]: replacement.after,
      },
    }))

    // Only up to 50 updates are allowed at one time, so do it in batches
    while (updates.length > 0) {
      await table.updateRecordsAsync(updates.slice(0, 50))
      updates = updates.slice(50)
    }
  }
}
