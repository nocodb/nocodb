import type { Client } from 'typesense'
import type { BaseIndex, SearchResponseHit } from './types'

/**
 * Group and sort search results from Typesense
 */
export function groupResults(hits: SearchResponseHit[]): SortedResult[] {
  const grouped: SortedResult[] = []
  const scannedUrls = new Set<string>()
  const scannedIds = new Set<string>()

  for (const hit of hits) {
    const document = hit.document as BaseIndex

    if (scannedIds.has(document.id)) {
      continue
    }
    if (!scannedUrls.has(document.url)) {
      scannedUrls.add(document.url)
      scannedIds.add(document.id)

      grouped.push({
        id: document.id,
        type: 'page',
        url: document.url,
        content: document.title,
      })
    }

    const sectionId = document.section_id ? `${document.id}-${document.section_id}` : document.id
    if (!scannedIds.has(sectionId)) {
      scannedIds.add(sectionId)

      grouped.push({
        id: sectionId,
        type: document.content === document.section ? 'heading' : 'text',
        url: document.section_id ? `${document.url}#${document.section_id}` : document.url,
        content: document.content,
      })
    }
  }

  return grouped
}

/**
 * Search documents using Typesense
 */
export async function searchDocs(client: Client, collectionName: string, query: string): Promise<SortedResult[]> {
  // Define search parameters based on Typesense capabilities
  const searchParams: any = {
    q: query,
    query_by: 'title,section,content',
    query_by_weights: '6,4,1', // Give even higher weight to title
    prefix: true, // Enable prefix searching
    infix: 'always', // Enable infix searching to match parts of words
    typo_tolerance: true, // Enable typo tolerance
    num_typos: 2, // Allow up to 2 typos
    boost: {
      is_root_heading: 2, // Boost root headings
      heading_level: {
        value: 1, // Boost h1 headings
        function: 'reciprocal', // Lower heading levels get less boost
      },
    },
    sort_by: '_text_match:asc',
    per_page: 15, // Increase results per page
    filter_by: undefined as string | undefined,
    contextual_search: true,
  }

  if (query.length === 0) {
    const results = await client
      .collections(collectionName)
      .documents()
      .search({
        ...searchParams,
        q: '*',
        per_page: 8,
        group_by: 'page_id',
        group_limit: 1,
      })

    return groupResults(results.hits || []).filter((hit) => hit.type === 'page')
  }

  const results = await client.collections(collectionName).documents().search(searchParams)

  return groupResults(results.hits || [])
}
