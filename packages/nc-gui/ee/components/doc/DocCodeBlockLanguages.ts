/**
 * Language metadata for the code block language selector.
 *
 * Language IDs must match what lowlight's `common` bundle registers
 * (based on highlight.js identifiers). The `aliases` array enables
 * fuzzy search by common abbreviations.
 */

export interface CodeBlockLanguage {
  id: string // lowlight/highlight.js language identifier
  label: string // Display name shown in the dropdown
  aliases?: string[] // Extra search terms
}

/** Popular languages pinned at the top of the dropdown. */
export const POPULAR_LANGUAGES: CodeBlockLanguage[] = [
  { id: 'javascript', label: 'JavaScript', aliases: ['js', 'node'] },
  { id: 'typescript', label: 'TypeScript', aliases: ['ts'] },
  { id: 'python', label: 'Python', aliases: ['py'] },
  { id: 'json', label: 'JSON' },
  { id: 'bash', label: 'Bash', aliases: ['sh', 'zsh'] },
  { id: 'xml', label: 'HTML / XML', aliases: ['html', 'htm', 'xhtml', 'svg'] },
  { id: 'css', label: 'CSS' },
  { id: 'sql', label: 'SQL', aliases: ['mysql', 'postgres'] },
]

const POPULAR_IDS = new Set(POPULAR_LANGUAGES.map((l) => l.id))

/**
 * All other languages from lowlight's `common` bundle,
 * excluding popular (shown separately) and internal variants
 * (php-template, python-repl, plaintext).
 */
export const ALL_LANGUAGES: CodeBlockLanguage[] = [
  { id: 'arduino', label: 'Arduino' },
  { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++', aliases: ['cc', 'cxx'] },
  { id: 'csharp', label: 'C#', aliases: ['cs', 'dotnet'] },
  { id: 'diff', label: 'Diff', aliases: ['patch'] },
  { id: 'go', label: 'Go', aliases: ['golang'] },
  { id: 'graphql', label: 'GraphQL', aliases: ['gql'] },
  { id: 'ini', label: 'INI', aliases: ['toml', 'cfg'] },
  { id: 'java', label: 'Java' },
  { id: 'kotlin', label: 'Kotlin', aliases: ['kt'] },
  { id: 'less', label: 'Less' },
  { id: 'lua', label: 'Lua' },
  { id: 'makefile', label: 'Makefile', aliases: ['make'] },
  { id: 'markdown', label: 'Markdown', aliases: ['md'] },
  { id: 'objectivec', label: 'Objective-C', aliases: ['objc'] },
  { id: 'perl', label: 'Perl' },
  { id: 'php', label: 'PHP' },
  { id: 'r', label: 'R' },
  { id: 'ruby', label: 'Ruby', aliases: ['rb'] },
  { id: 'rust', label: 'Rust', aliases: ['rs'] },
  { id: 'scss', label: 'SCSS', aliases: ['sass'] },
  { id: 'shell', label: 'Shell' },
  { id: 'swift', label: 'Swift' },
  { id: 'vbnet', label: 'VB.Net' },
  { id: 'wasm', label: 'WebAssembly' },
  { id: 'yaml', label: 'YAML', aliases: ['yml'] },
].filter((l) => !POPULAR_IDS.has(l.id))

/** The "no highlighting" option — always first in the list. */
export const PLAIN_TEXT: CodeBlockLanguage = { id: '', label: 'Plain text' }

/** Lookup map: language ID → display label. */
const LANGUAGE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  [PLAIN_TEXT, ...POPULAR_LANGUAGES, ...ALL_LANGUAGES].map((l) => [l.id, l.label]),
)

/** Get display label for a language ID. Falls back to capitalised ID. */
export function getLanguageLabel(id: string | null | undefined): string {
  if (!id) return PLAIN_TEXT.label
  return LANGUAGE_LABEL_MAP[id] || id.charAt(0).toUpperCase() + id.slice(1)
}

/** Check if a language matches a search query (label + aliases). */
export function matchesSearch(lang: CodeBlockLanguage, query: string): boolean {
  const q = query.toLowerCase()
  return lang.label.toLowerCase().includes(q) || !!lang.aliases?.some((a) => a.includes(q))
}
