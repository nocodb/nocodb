import { type ColumnType, type LinkToAnotherRecordType, type TableType, isLinksOrLTAR } from 'nocodb-sdk'

export interface FormulaDotPathMatch {
  // titles of the `{A}.{B}.` references before the cursor
  segments: string[]
  // whether the reference being typed started with `{`
  hasBrace: boolean
  // text typed after the last `.` (without the brace)
  partial: string
}

// `{Project}.{Client}.` / `{Project}.Cl` / `{Project}.{Cl` right before the cursor
const DOT_PATH_BEFORE_CURSOR = /((?:\{[^{}]+\}\s*\.\s*)+)(\{?)([^{}().,\s"'+\-*/&<>=!]*)$/

export const matchFormulaDotPath = (textBeforeCursor: string): FormulaDotPathMatch | null => {
  const match = textBeforeCursor.match(DOT_PATH_BEFORE_CURSOR)
  if (!match) return null

  return {
    segments: [...match[1]!.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1]!),
    hasBrace: match[2] === '{',
    partial: match[3] ?? '',
  }
}

// `{Pro` (a field being typed) or a bare word like `SU`, not after a `.`
const FIRST_REFERENCE_BEFORE_CURSOR = /(?:^|[^\w}.{"'])(\{)([^{}]*)$|(?:^|[^\w}.{"'\d])([A-Za-z_]\w*)$/

/** The first reference being typed, which suggests from the current table */
export const matchFormulaFirstReference = (textBeforeCursor: string): FormulaDotPathMatch | null => {
  const match = textBeforeCursor.match(FIRST_REFERENCE_BEFORE_CURSOR)
  if (!match) return null
  if (match[1]) return { segments: [], hasBrace: true, partial: match[2] ?? '' }
  return { segments: [], hasBrace: false, partial: match[3] ?? '' }
}

/** Columns of the table a link field points to, from the loaded metas only */
export const getLinkedMetaColumns = (
  getMetaByKey: (baseId: string | undefined, tableIdOrTitle: string | undefined) => TableType | undefined,
  linkColumn: ColumnType,
): ColumnType[] | undefined => {
  if (!isLinksOrLTAR(linkColumn)) return undefined
  const colOptions = linkColumn.colOptions as LinkToAnotherRecordType | undefined
  if (!colOptions?.fk_related_model_id) return undefined
  return getMetaByKey(colOptions.fk_related_base_id || linkColumn.base_id, colOptions.fk_related_model_id)?.columns
}

export interface FormulaReferenceSegment {
  // title between the braces
  title: string
  // offsets of `{` and just past `}`
  start: number
  end: number
}

/** A bare variable such as a rollup's `values`, outside strings, `{…}` and `.method` names */
export const findBareKeywordReferences = (text: string, keyword: string): FormulaReferenceSegment[] => {
  const result: FormulaReferenceSegment[] = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]!
    if (ch === '"' || ch === "'") {
      i++
      while (i < text.length && text[i] !== ch) i += text[i] === '\\' ? 2 : 1
      i++
      continue
    }
    if (ch === '{') {
      const close = text.indexOf('}', i + 1)
      i = close === -1 ? text.length : close + 1
      continue
    }
    const word = /^\w+/.exec(text.slice(i))?.[0]
    if (!word) {
      i++
      continue
    }
    if (word === keyword && !/\.\s*$/.test(text.slice(0, i))) {
      result.push({ title: word, start: i, end: i + word.length })
    }
    i += word.length
  }
  return result
}

/** `{A}.{B}.{C}` chains in a formula, skipping string literals */
export const findFormulaReferenceChains = (text: string): FormulaReferenceSegment[][] => {
  const chains: FormulaReferenceSegment[][] = []
  let chain: FormulaReferenceSegment[] | null = null
  let i = 0

  const readReference = (at: number): FormulaReferenceSegment | null => {
    const close = text.indexOf('}', at + 1)
    const nextOpen = text.indexOf('{', at + 1)
    if (close === -1 || (nextOpen !== -1 && nextOpen < close)) return null
    return { title: text.slice(at + 1, close), start: at, end: close + 1 }
  }

  while (i < text.length) {
    const ch = text[i]
    if (ch === '"' || ch === "'") {
      chain = null
      i++
      while (i < text.length && text[i] !== ch) i += text[i] === '\\' ? 2 : 1
      i++
      continue
    }
    if (ch === '{') {
      const segment = readReference(i)
      if (!segment) {
        chain = null
        i++
        continue
      }
      if (!chain) {
        chain = []
        chains.push(chain)
      }
      chain.push(segment)
      i = segment.end
      // continue the chain only on `.{`
      const rest = text.slice(i).match(/^\s*\.\s*(?=\{)/)
      if (rest) i += rest[0].length
      else chain = null
      continue
    }
    chain = null
    i++
  }
  return chains
}
