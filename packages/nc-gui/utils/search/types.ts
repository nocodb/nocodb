export interface SearchResponseHit {
  curated?: true
  highlights?: [
    {
      field: any
      snippet?: string
      value?: string
      snippets?: string[]
      indices?: number[]
      matched_tokens: string[][] | string[]
    },
  ]
  highlight: any
  document: any
  text_match: number
  text_match_info?: {
    best_field_score: `${number}`
    best_field_weight: number
    fields_matched: number
    score: `${number}`
    tokens_matched: number
  }
}

export interface BaseIndex {
  id: string
  title: string
  url: string
  page_id: string
  tag?: string
  section?: string
  section_id?: string
  content: string
  description?: string
  [key: string]: unknown
}

export interface SortedResult {
  id: string
  url: string
  type: 'page' | 'heading' | 'text'
  content: string
  /** Hierarchy for the hint: the page title (lvl1) and the heading a result sits under (lvl2). */
  page: string
  section?: string
}
