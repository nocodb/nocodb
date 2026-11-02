import { buildCmdNlLexicon } from './lexicon'
import { parseCmdNl } from './parse'
import type { CmdNlSchema } from './schema'
import { cmdNlSkeleton } from './skeleton'
import { cmdNlSuggest } from './suggest'
import { cmdNlTaggerLexicon, getCmdNlTagger } from './taggerScore'

/**
 * Builds what the first keystroke would otherwise pay for: the lexicon for these rows, the tagger's
 * lexicon, and one pass through parse / suggest / skeleton so their code is compiled. Run on palette open.
 */
export function warmCmdNl(schema: CmdNlSchema, rows?: Record<string, unknown>[]) {
  buildCmdNlLexicon(schema, rows)
  if (getCmdNlTagger()) cmdNlTaggerLexicon(schema)
  const field = schema.fields.find((f) => f.kind === 'number') ?? schema.fields[0]
  if (!field) return
  for (const query of [`sum of ${field.title} where ${field.title} is 1`, `${field.title} is`]) {
    parseCmdNl(query, schema, { rows })
    cmdNlSuggest(query, schema, { rows })
    cmdNlSkeleton(query, schema, { rows })
  }
}
