const fs = require('fs')
const glob = require('glob')

// Define conflict resolution strategies
const CONFLICT_STRATEGIES = {
  ASK_USER: 'ask_user',
  MOST_COMMON: 'most_common',
  CONTEXT_AWARE: 'context_aware',
  PRIORITY_BASED: 'priority_based',
}

// Multiple mapping definitions with conflict resolution
const colorMappingConflicts = {
  'text-gray-700': [
    {
      token: 'text-nc-content-gray-subtle',
      priority: 70,
      context: ['body', 'paragraph', 'description', 'secondary', 'content'],
      usage: 'Primary choice for subtle text content',
    },
    {
      token: 'text-nc-content-inverted-secondary',
      priority: 75,
      context: ['inverted', 'dark', 'overlay', 'modal', 'bg-black', 'bg-gray-900'],
      usage: 'For text on dark/inverted backgrounds',
    },
  ],
  'text-gray-500': [
    {
      token: 'text-nc-content-gray-muted',
      priority: 50,
      context: ['muted', 'disabled', 'placeholder', 'hint', 'caption'],
      usage: 'Primary choice for muted text',
    },
    {
      token: 'text-nc-content-inverted-primary-disabled',
      priority: 40,
      context: ['inverted', 'disabled', 'dark'],
      usage: 'For disabled text on inverted backgrounds',
    },
    {
      token: 'text-nc-content-inverted-secondary-disabled',
      priority: 40,
      context: ['inverted', 'disabled', 'secondary', 'dark'],
      usage: 'For disabled secondary text on inverted backgrounds',
    },
  ],
  'text-white': [
    {
      token: 'text-nc-content-inverted-primary',
      priority: 85,
      context: ['inverted', 'dark', 'overlay', 'primary', 'bg-black', 'bg-gray'],
      usage: 'Primary choice for white text',
    },
    {
      token: 'text-nc-content-inverted-primary-hover',
      priority: 80,
      context: ['inverted', 'hover', 'dark'],
      usage: 'For hover states on inverted backgrounds',
    },
  ],
}

// Fill color conflicts
const fillColorConflicts = {
  'fill-gray-300': [
    {
      token: 'fill-nc-fill-primary-disabled',
      priority: 60,
      context: ['disabled', 'inactive', 'primary', 'button'],
      usage: 'For disabled primary buttons/icons',
    },
  ],
  'fill-white': [
    {
      token: 'fill-nc-fill-secondary',
      priority: 70,
      context: ['secondary', 'outline', 'ghost', 'button'],
      usage: 'For secondary buttons/icons',
    },
    {
      token: 'fill-nc-fill-secondary-disabled',
      priority: 40,
      context: ['secondary', 'disabled', 'button'],
      usage: 'For disabled secondary buttons/icons',
    },
  ],
  'fill-gray-50': [
    {
      token: 'fill-nc-fill-secondary-hover',
      priority: 65,
      context: ['secondary', 'hover', 'button'],
      usage: 'For hover state of secondary buttons/icons',
    },
    {
      token: 'fill-nc-fill-warning-disabled',
      priority: 30,
      context: ['warning', 'disabled'],
      usage: 'For disabled warning buttons/icons',
    },
    {
      token: 'fill-nc-fill-success-disabled',
      priority: 30,
      context: ['success', 'disabled'],
      usage: 'For disabled success buttons/icons',
    },
  ],
  'fill-red-500': [
    {
      token: 'fill-nc-fill-warning',
      priority: 80,
      context: ['warning', 'danger', 'error', 'destructive', 'delete'],
      usage: 'Primary choice for warning/danger states',
    },
    {
      token: 'fill-nc-fill-red-medium',
      priority: 50,
      context: ['red', 'medium', 'color'],
      usage: 'For general red colored elements',
    },
  ],
  'fill-green-500': [
    {
      token: 'fill-nc-fill-success',
      priority: 80,
      context: ['success', 'confirm', 'positive', 'save', 'submit'],
      usage: 'Primary choice for success states',
    },
    {
      token: 'fill-nc-fill-green-medium',
      priority: 50,
      context: ['green', 'medium', 'color'],
      usage: 'For general green colored elements',
    },
  ],
}

const colorMappings = {
  // Text colors - definitive mappings
  'text-black': 'text-nc-content-gray-extreme',
  'text-gray-600': 'text-nc-content-gray-subtle2',
  'text-gray-800': 'text-nc-content-gray',
  'text-gray-900': 'text-nc-content-gray-emphasis',

  // Brand colors
  'text-brand-500': 'text-nc-content-brand',
  'text-brand-600': 'text-nc-content-brand-disabled',
  'text-gray-300': 'text-nc-content-brand-hover',

  // Color-specific text mappings (no conflicts)
  'text-red-700': 'text-nc-content-red-dark',
  'text-red-500': 'text-nc-content-red-medium',
  'text-red-300': 'text-nc-content-red-light',
  'text-green-700': 'text-nc-content-green-dark',
  'text-green-500': 'text-nc-content-green-medium',
  'text-green-300': 'text-nc-content-green-light',
  'text-yellow-700': 'text-nc-content-yellow-dark',
  'text-yellow-500': 'text-nc-content-yellow-medium',
  'text-yellow-300': 'text-nc-content-yellow-light',
  'text-blue-700': 'text-nc-content-blue-dark',
  'text-blue-500': 'text-nc-content-blue-medium',
  'text-blue-300': 'text-nc-content-blue-light',
  'text-purple-700': 'text-nc-content-purple-dark',
  'text-purple-500': 'text-nc-content-purple-medium',
  'text-purple-300': 'text-nc-content-purple-light',
  'text-pink-700': 'text-nc-content-pink-dark',
  'text-pink-500': 'text-nc-content-pink-medium',
  'text-pink-300': 'text-nc-content-pink-light',
  'text-orange-700': 'text-nc-content-orange-dark',
  'text-orange-500': 'text-nc-content-orange-medium',
  'text-orange-300': 'text-nc-content-orange-light',
  'text-maroon-700': 'text-nc-content-maroon-dark',
  'text-maroon-500': 'text-nc-content-maroon-medium',
  'text-maroon-300': 'text-nc-content-maroon-light',

  // Background colors (no conflicts in your theme)
  'bg-white': 'bg-nc-bg-default',
  'bg-brand-50': 'bg-nc-bg-brand',
  'bg-gray-50': 'bg-nc-bg-gray-extralight',
  'bg-gray-100': 'bg-nc-bg-gray-light',
  'bg-gray-200': 'bg-nc-bg-gray-medium',
  'bg-gray-300': 'bg-nc-bg-gray-dark',
  'bg-gray-400': 'bg-nc-bg-gray-extradark',
  'bg-red-50': 'bg-nc-bg-red-light',
  'bg-red-100': 'bg-nc-bg-red-dark',
  'bg-green-50': 'bg-nc-bg-green-light',
  'bg-green-100': 'bg-nc-bg-green-dark',
  'bg-yellow-50': 'bg-nc-bg-yellow-light',
  'bg-yellow-100': 'bg-nc-bg-yellow-dark',
  'bg-blue-50': 'bg-nc-bg-blue-light',
  'bg-blue-100': 'bg-nc-bg-blue-dark',
  'bg-purple-50': 'bg-nc-bg-purple-light',
  'bg-purple-100': 'bg-nc-bg-purple-dark',
  'bg-pink-50': 'bg-nc-bg-pink-light',
  'bg-pink-100': 'bg-nc-bg-pink-dark',
  'bg-orange-50': 'bg-nc-bg-orange-light',
  'bg-orange-100': 'bg-nc-bg-orange-dark',
  'bg-maroon-50': 'bg-nc-bg-maroon-light',
  'bg-maroon-100': 'bg-nc-bg-maroon-dark',

  // Border colors (no conflicts)
  'border-brand-500': 'border-nc-border-brand',
  'border-gray-50': 'border-nc-border-gray-extralight',
  'border-gray-100': 'border-nc-border-gray-light',
  'border-gray-200': 'border-nc-border-gray-medium',
  'border-gray-300': 'border-nc-border-gray-dark',
  'border-gray-400': 'border-nc-border-gray-extradark',
  'border-red-500': 'border-nc-border-red',
  'border-green-500': 'border-nc-border-green',
  'border-yellow-500': 'border-nc-border-yellow',
  'border-blue-500': 'border-nc-border-blue',
  'border-purple-500': 'border-nc-border-purple',
  'border-pink-500': 'border-nc-border-pink',
  'border-orange-500': 'border-nc-border-orange',
  'border-maroon-500': 'border-nc-border-maroon',

  // Fill colors (non-conflicting)
  'fill-brand-500': 'fill-nc-fill-primary',
  'fill-brand-600': 'fill-nc-fill-primary-hover',
  'fill-brand-200': 'fill-nc-fill-primary-disabled2',
  'fill-red-600': 'fill-nc-fill-warning-hover',
  'fill-green-600': 'fill-nc-fill-success-hover',
  'fill-red-700': 'fill-nc-fill-red-dark',
  'fill-red-300': 'fill-nc-fill-red-light',
  'fill-green-700': 'fill-nc-fill-green-dark',
  'fill-green-300': 'fill-nc-fill-green-light',
  'fill-yellow-700': 'fill-nc-fill-yellow-dark',
  'fill-yellow-500': 'fill-nc-fill-yellow-medium',
  'fill-yellow-300': 'fill-nc-fill-yellow-light',
  'fill-blue-700': 'fill-nc-fill-blue-dark',
  'fill-blue-500': 'fill-nc-fill-blue-medium',
  'fill-blue-300': 'fill-nc-fill-blue-light',
  'fill-purple-700': 'fill-nc-fill-purple-dark',
  'fill-purple-500': 'fill-nc-fill-purple-medium',
  'fill-purple-300': 'fill-nc-fill-purple-light',
  'fill-pink-700': 'fill-nc-fill-pink-dark',
  'fill-pink-500': 'fill-nc-fill-pink-medium',
  'fill-pink-300': 'fill-nc-fill-pink-light',
  'fill-orange-700': 'fill-nc-fill-orange-dark',
  'fill-orange-500': 'fill-nc-fill-orange-medium',
  'fill-orange-300': 'fill-nc-fill-orange-light',
  'fill-maroon-700': 'fill-nc-fill-maroon-dark',
  'fill-maroon-500': 'fill-nc-fill-maroon-medium',
  'fill-maroon-300': 'fill-nc-fill-maroon-light',
}

/**
 * Resolve conflicts using context analysis
 */
function resolveConflictWithContext(tailwindClass, conflicts, surroundingCode, strategy = CONFLICT_STRATEGIES.CONTEXT_AWARE) {
  const codeContext = surroundingCode.toLowerCase()

  switch (strategy) {
    case CONFLICT_STRATEGIES.CONTEXT_AWARE: {
      // Score each option based on context keywords
      const scored = conflicts.map((option) => {
        let score = option.priority

        // Boost score if context keywords are found
        option.context.forEach((keyword) => {
          if (codeContext.includes(keyword)) {
            score += 20
          }
        })

        return { ...option, finalScore: score }
      })

      // Return highest scored option
      return scored.sort((a, b) => b.finalScore - a.finalScore)[0]
    }
    case CONFLICT_STRATEGIES.PRIORITY_BASED:
      return conflicts.sort((a, b) => b.priority - a.priority)[0]

    case CONFLICT_STRATEGIES.MOST_COMMON:
      // For now, return highest priority (could be enhanced with usage analytics)
      return conflicts.sort((a, b) => b.priority - a.priority)[0]

    default:
      return conflicts[0]
  }
}

/**
 * Get all conflicting mappings combined
 */
function getAllConflicts() {
  return { ...colorMappingConflicts, ...fillColorConflicts }
}

/**
 * Enhanced conversion with conflict resolution
 */
function convertFileToSemanticWithConflicts(filePath, strategy = CONFLICT_STRATEGIES.CONTEXT_AWARE, interactive = false) {
  try {
    let content = fs.readFileSync(filePath, 'utf8')
    let hasChanges = false
    const changes = []
    const conflictChoices = []

    const allConflicts = getAllConflicts()

    // First, handle non-conflicting mappings
    const sortedMappings = Object.keys(colorMappings).sort((a, b) => b.length - a.length)

    sortedMappings.forEach((tailwindClass) => {
      const semanticClass = colorMappings[tailwindClass]
      const classRegex = new RegExp(`\\b${tailwindClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')

      if (classRegex.test(content)) {
        const beforeContent = content
        content = content.replace(classRegex, semanticClass)

        if (beforeContent !== content) {
          hasChanges = true
          changes.push(`${tailwindClass} → ${semanticClass}`)
        }
      }
    })

    // Then handle conflicting mappings
    Object.keys(allConflicts).forEach((tailwindClass) => {
      const conflicts = allConflicts[tailwindClass]
      const classRegex = new RegExp(`\\b${tailwindClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')

      if (classRegex.test(content)) {
        // Get surrounding context for each match
        const matches = [...content.matchAll(classRegex)]

        matches.forEach((match) => {
          const matchIndex = match.index
          const contextStart = Math.max(0, matchIndex - 200)
          const contextEnd = Math.min(content.length, matchIndex + 200)
          const surroundingCode = content.slice(contextStart, contextEnd)

          const resolvedConflict = resolveConflictWithContext(tailwindClass, conflicts, surroundingCode, strategy)

          conflictChoices.push({
            original: tailwindClass,
            chosen: resolvedConflict.token,
            reason: resolvedConflict.usage,
            context: surroundingCode.trim(),
            alternatives: conflicts.filter((c) => c !== resolvedConflict).map((c) => c.token),
          })
        })

        // Apply the resolved choice to all instances
        if (matches.length > 0) {
          const firstResolution = resolveConflictWithContext(tailwindClass, conflicts, content, strategy)

          const beforeContent = content
          content = content.replace(classRegex, firstResolution.token)

          if (beforeContent !== content) {
            hasChanges = true
            changes.push(`${tailwindClass} → ${firstResolution.token} (resolved conflict)`)
          }
        }
      }
    })

    if (hasChanges) {
      if (!interactive) {
        fs.writeFileSync(filePath, content)
      }

      console.log(`✅ ${interactive ? 'Preview for' : 'Updated'} ${filePath}`)
      changes.forEach((change) => console.log(`   ${change}`))

      if (conflictChoices.length > 0) {
        console.log(`\n🔀 Conflict resolutions:`)
        conflictChoices.forEach((choice) => {
          console.log(`   ${choice.original} → ${choice.chosen}`)
          console.log(`      Reason: ${choice.reason}`)
          if (choice.alternatives.length > 0) {
            console.log(`      Alternatives: ${choice.alternatives.join(', ')}`)
          }
        })
      }

      return { file: filePath, changes: changes.length, conflicts: conflictChoices }
    }

    return null
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message)
    return null
  }
}

// Additional mappings for responsive and state variants
const generateVariantMappings = () => {
  const variants = [
    'sm:',
    'md:',
    'lg:',
    'xl:',
    '2xl:',
    'dark:',
    'group-hover:',
    'hover:',
    'focus:',
    'active:',
    'disabled:',
    'focus-within:',
    'focus-visible:',
    'group-focus:',
    'peer-focus:',
    'first:',
    'last:',
    'odd:',
    'even:',
    'visited:',
    'checked:',
    'group-active:',
    'group-disabled:',
    'peer-hover:',
    'peer-active:',
  ]
  const additionalMappings = {}

  // Only generate variants for non-conflicting mappings
  variants.forEach((variant) => {
    Object.keys(colorMappings).forEach((oldClass) => {
      const newClass = colorMappings[oldClass]
      additionalMappings[variant + oldClass] = variant + newClass
    })
  })

  return additionalMappings
}

const allMappings = { ...colorMappings, ...generateVariantMappings() }

/**
 * Scan and convert files in a directory to semantic tokens with conflict resolution
 */
function convertDirectoryToSemanticWithConflicts(
  directory,
  strategy = CONFLICT_STRATEGIES.CONTEXT_AWARE,
  fileExtensions = ['js', 'jsx', 'ts', 'tsx', 'vue', 'svelte', 'html', 'css', 'scss'],
) {
  const pattern = `${directory}/**/*.{${fileExtensions.join(',')}}`
  const files = glob.sync(pattern, {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**', '**/coverage/**'],
  })

  console.log(`🔍 Found ${files.length} files to process...`)
  console.log(`🧠 Using strategy: ${strategy}`)

  const results = []
  let totalChanges = 0
  let totalConflicts = 0

  files.forEach((file) => {
    const result = convertFileToSemanticWithConflicts(file, strategy, false)
    if (result) {
      results.push(result)
      totalChanges += result.changes
      totalConflicts += result.conflicts.length
    }
  })

  console.log(`\n📊 Migration Summary:`)
  console.log(`   Files processed: ${files.length}`)
  console.log(`   Files updated: ${results.length}`)
  console.log(`   Total changes: ${totalChanges}`)
  console.log(`   Conflicts resolved: ${totalConflicts}`)

  return results
}

/**
 * Interactive conflict resolution for a single file
 */
function interactiveConflictResolution(filePath) {
  const readline = require('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      const allConflicts = getAllConflicts()
      let modifiedContent = content
      const decisions = []

      // First handle non-conflicting mappings
      Object.keys(colorMappings).forEach((tailwindClass) => {
        const semanticClass = colorMappings[tailwindClass]
        const classRegex = new RegExp(`\\b${tailwindClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')
        modifiedContent = modifiedContent.replace(classRegex, semanticClass)
      })

      const conflictKeys = Object.keys(allConflicts)
      let currentConflictIndex = 0

      function processNextConflict() {
        if (currentConflictIndex >= conflictKeys.length) {
          rl.close()
          fs.writeFileSync(filePath, modifiedContent)
          console.log('\n✅ Interactive conversion completed!')
          resolve(decisions)
          return
        }

        const tailwindClass = conflictKeys[currentConflictIndex]
        const conflicts = allConflicts[tailwindClass]
        const classRegex = new RegExp(`\\b${tailwindClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')

        if (!classRegex.test(modifiedContent)) {
          currentConflictIndex++
          processNextConflict()
          return
        }

        console.log(`\n🔀 Conflict found: ${tailwindClass}`)
        console.log('Choose the semantic token:')

        conflicts.forEach((option, index) => {
          console.log(`  ${index + 1}. ${option.token}`)
          console.log(`     Usage: ${option.usage}`)
          console.log(`     Context: ${option.context.join(', ')}`)
        })

        console.log(`  ${conflicts.length + 1}. Skip this class`)

        rl.question('\nEnter your choice (number): ', (answer) => {
          const choice = parseInt(answer) - 1

          if (choice >= 0 && choice < conflicts.length) {
            const selectedOption = conflicts[choice]
            modifiedContent = modifiedContent.replace(classRegex, selectedOption.token)
            decisions.push({
              original: tailwindClass,
              chosen: selectedOption.token,
              reason: 'User selected',
            })
            console.log(`✅ Replaced ${tailwindClass} with ${selectedOption.token}`)
          } else if (choice === conflicts.length) {
            console.log(`⏭️ Skipped ${tailwindClass}`)
          } else {
            console.log('❌ Invalid choice, skipping...')
          }

          currentConflictIndex++
          processNextConflict()
        })
      }

      processNextConflict()
    } catch (error) {
      rl.close()
      console.error(`❌ Error in interactive resolution:`, error.message)
      resolve([])
    }
  })
}

/**
 * Generate detailed conflict report
 */
function generateConflictReport(directory) {
  const pattern = `${directory}/**/*.{js,jsx,ts,tsx,vue,svelte,html}`
  const files = glob.sync(pattern, {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'],
  })

  const allConflicts = getAllConflicts()
  const foundConflicts = {}
  const fileConflicts = []

  files.forEach((file) => {
    try {
      const content = fs.readFileSync(file, 'utf8')
      const fileConflictInfo = { file, conflicts: [] }

      Object.keys(allConflicts).forEach((tailwindClass) => {
        const classRegex = new RegExp(`\\b${tailwindClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')

        if (classRegex.test(content)) {
          const matches = content.match(classRegex)
          foundConflicts[tailwindClass] = (foundConflicts[tailwindClass] || 0) + matches.length

          fileConflictInfo.conflicts.push({
            class: tailwindClass,
            count: matches.length,
            options: allConflicts[tailwindClass],
          })
        }
      })

      if (fileConflictInfo.conflicts.length > 0) {
        fileConflicts.push(fileConflictInfo)
      }
    } catch (error) {
      console.error(`Error reading ${file}:`, error.message)
    }
  })

  console.log(`\n📊 Conflict Analysis Report`)
  console.log(`==========================`)

  if (Object.keys(foundConflicts).length === 0) {
    console.log(`✅ No conflicts found!`)
    return
  }

  console.log(`\n🔥 Conflicts Summary:`)
  Object.entries(foundConflicts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([tailwindClass, count]) => {
      const options = allConflicts[tailwindClass]
      console.log(`\n${tailwindClass} (${count} occurrences)`)
      options.forEach((option, index) => {
        console.log(`  ${index + 1}. ${option.token} (priority: ${option.priority})`)
        console.log(`     ${option.usage}`)
      })
    })

  console.log(`\n📁 Files with conflicts:`)
  fileConflicts.forEach((fileInfo) => {
    console.log(`\n${fileInfo.file}`)
    fileInfo.conflicts.forEach((conflict) => {
      console.log(`  ${conflict.class} (${conflict.count}x)`)
    })
  })

  console.log(`\n💡 Recommendations:`)
  console.log(`- Use 'convert-smart' for automatic context-aware resolution`)
  console.log(`- Use 'interactive' for manual decision making`)
}

/**
 * Generate a report of unconverted Tailwind classes
 */
function generateTailwindReport(directory) {
  const pattern = `${directory}/**/*.{js,jsx,ts,tsx,vue,svelte,html}`
  const files = glob.sync(pattern, {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'],
  })

  const unconvertedClasses = new Set()

  // Enhanced regex to catch more Tailwind color classes
  const colorClassRegex = new RegExp(
    [
      // Standard color classes
      '\\b(text-|bg-|border-|fill-|ring-|divide-|placeholder-|caret-)',
      // State variants
      '(hover:|focus:|active:|disabled:|group-hover:|group-focus:|peer-hover:|focus-within:|focus-visible:)?',
      // Responsive variants
      '(sm:|md:|lg:|xl:|2xl:|dark:)?',
      // Color families with numbers
      '(gray|red|green|blue|yellow|purple|pink|orange|indigo|cyan|teal|lime|emerald|sky|violet|fuchsia|rose|amber|slate|zinc|neutral|stone|black|white|brand|maroon)-',
      // Color scale
      '(50|100|200|300|400|500|600|700|800|900|950)\\b',
    ].join(''),
    'g',
  )

  files.forEach((file) => {
    try {
      const content = fs.readFileSync(file, 'utf8')
      const matches = content.match(colorClassRegex)

      if (matches) {
        matches.forEach((match) => {
          // Only add if we don't have a mapping for it
          if (!allMappings[match] && !getAllConflicts()[match]) {
            unconvertedClasses.add(match)
          }
        })
      }
    } catch (error) {
      console.error(`Error reading ${file}:`, error.message)
    }
  })

  if (unconvertedClasses.size > 0) {
    console.log(`\n⚠️  Tailwind classes that could be converted to semantic tokens:`)
    Array.from(unconvertedClasses)
      .sort()
      .forEach((cls) => {
        console.log(`   ${cls}`)
      })

    console.log(`\n💡 Consider adding mappings for these classes to complete the migration.`)
  } else {
    console.log(`\n✅ All applicable Tailwind classes have been converted to semantic tokens!`)
  }

  return Array.from(unconvertedClasses)
}

/**
 * Legacy conversion function (for backward compatibility)
 */
function convertFileToSemantic(filePath) {
  return convertFileToSemanticWithConflicts(filePath, CONFLICT_STRATEGIES.PRIORITY_BASED, false)
}

function convertDirectoryToSemantic(directory, fileExtensions) {
  return convertDirectoryToSemanticWithConflicts(directory, CONFLICT_STRATEGIES.PRIORITY_BASED, fileExtensions)
}

// CLI Interface with enhanced conflict handling
const args = process.argv.slice(2)
const command = args[0]
const target = args[1] || './src'

switch (command) {
  case 'convert':
    console.log(`🚀 Starting Tailwind → Semantic Token migration for: ${target}`)
    console.log(`📝 Using priority-based conflict resolution`)
    convertDirectoryToSemantic(target)
    break

  case 'convert-smart':
    console.log(`🚀 Starting smart Tailwind → Semantic Token migration for: ${target}`)
    console.log(`🧠 Using context-aware conflict resolution`)
    convertDirectoryToSemanticWithConflicts(target, CONFLICT_STRATEGIES.CONTEXT_AWARE)
    break

  case 'interactive':
    if (!args[1]) {
      console.error('Please provide a file path for interactive mode')
      process.exit(1)
    }
    console.log(`🤝 Starting interactive conversion for: ${args[1]}`)
    interactiveConflictResolution(args[1]).then(() => {
      console.log('Interactive conversion completed!')
    })
    break

  case 'conflicts':
    console.log(`🔍 Analyzing conflicts in: ${target}`)
    generateConflictReport(target)
    break

  case 'report':
    console.log(`📋 Generating Tailwind usage report for: ${target}`)
    generateTailwindReport(target)
    break

  case 'file': {
    if (!args[1]) {
      console.error('Please provide a file path')
      process.exit(1)
    }
    console.log(`🔄 Converting single file: ${args[1]}`)
    const result = convertFileToSemantic(args[1])
    if (!result) {
      console.log('No changes needed')
    }
    break
  }

  case 'file-smart':
    {
      if (!args[1]) {
        console.error('Please provide a file path')
        process.exit(1)
      }
      console.log(`🧠 Smart converting single file: ${args[1]}`)
      const smartResult = convertFileToSemanticWithConflicts(args[1], CONFLICT_STRATEGIES.CONTEXT_AWARE)
      if (!smartResult) {
        console.log('No changes needed')
      }
    }
    break

  default:
    console.log(`
🎨 Advanced Tailwind → Semantic Token Migration Script

Usage:
  node migrate-colors.js convert [directory]        # Convert using priority-based resolution
  node migrate-colors.js convert-smart [directory]  # Convert using context-aware resolution  
  node migrate-colors.js interactive [filepath]     # Interactive conflict resolution
  node migrate-colors.js conflicts [directory]      # Analyze conflicts before converting
  node migrate-colors.js report [directory]         # Generate Tailwind usage report
  node migrate-colors.js file [filepath]            # Convert single file (priority-based)
  node migrate-colors.js file-smart [filepath]      # Convert single file (context-aware)

Conflict Resolution Strategies:
  🏆 Priority-based: Uses predefined priority scores for each semantic token
  🧠 Context-aware: Analyzes surrounding code to make intelligent choices
  🤝 Interactive: Lets you manually choose resolution for each conflict

Examples:
  node migrate-colors.js conflicts ./src              # Analyze conflicts first
  node migrate-colors.js convert-smart ./src          # Smart conversion
  node migrate-colors.js interactive ./src/Button.jsx # Manual resolution

Conflict Examples:
  text-gray-700 can become:
    • text-nc-content-gray-subtle (for body text)
    • text-nc-content-inverted-secondary (on dark backgrounds)
  
  fill-red-500 can become:
    • fill-nc-fill-warning (for warning states)
    • fill-nc-fill-red-medium (for general red elements)

Features:
  ✅ Intelligent conflict resolution based on code context
  ✅ Interactive mode for manual decision making
  ✅ Comprehensive conflict analysis and reporting
  ✅ Priority-based fallback for edge cases
  ✅ Support for all Tailwind variants (responsive, state, etc.)
`)
    break
}
