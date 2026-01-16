import { LRUCache } from 'lru-cache'
import type { UserType } from 'nocodb-sdk'
import type { Block } from '../utils/markdownUtils'
import { parseMarkdown } from '../utils/markdownUtils'
import { NcMarkdownParser } from '~/helpers/tiptap'

export const markdownTextCache: LRUCache<string, { blocks: Block[]; width: number }> = new LRUCache({
  max: 1000,
})

export interface MarkdownParserOptions {
  text: string
  maxWidth: number
  baseUsers?: Partial<UserType | User>[]
  user?: Partial<UserType | User> | null
}

export class MarkdownLoader {
  private loadingMarkdown = new Map<string, Promise<{ blocks: Block[]; width: number } | undefined>>()

  private pendingLoads = 0

  constructor(private onSettled?: () => void) {}

  /**
   * Sync render API
   * - returns cached markdown if ready
   * - otherwise starts async parse and returns undefined
   */
  loadOrGetMarkdown(cacheKey: string, options: MarkdownParserOptions): { blocks: Block[]; width: number } | undefined {
    // 1️⃣ Cache hit
    const cached = markdownTextCache.get(cacheKey)
    if (cached) return cached

    // 2️⃣ Already loading
    if (this.loadingMarkdown.has(cacheKey)) {
      return undefined
    }

    // 3️⃣ Start async parse
    const promise = (async () => {
      this.pendingLoads++

      try {
        const { text, maxWidth, baseUsers, user } = options

        // 🔑 Async boundary (even though fn is sync)
        const renderText = await Promise.resolve(NcMarkdownParser.preprocessMarkdown(text, true))

        const parsedBlocks = await Promise.resolve(
          parseMarkdown(renderText, {
            users: baseUsers,
            currentUser: user ?? undefined,
          }),
        )

        const result: { blocks: Block[]; width: number } = {
          width: maxWidth,
          blocks: parsedBlocks,
        }

        markdownTextCache.set(cacheKey, result)

        return result
      } catch {
        return undefined
      } finally {
        this.loadingMarkdown.delete(cacheKey)
        this.pendingLoads--
        this.onSettled?.()
      }
    })()

    this.loadingMarkdown.set(cacheKey, promise)
    return undefined
  }

  clearCache(): void {
    this.loadingMarkdown.clear()
    markdownTextCache.clear()
  }

  isLoading(cacheKey: string): boolean {
    return this.loadingMarkdown.has(cacheKey)
  }
}
