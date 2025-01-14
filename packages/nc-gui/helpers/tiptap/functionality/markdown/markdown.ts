import MarkdownIt from 'markdown-it'
import mdTaskList from 'markdown-it-task-lists'
import type { UserType } from 'nocodb-sdk'
import { mdImageAsText, mdLinkRuleSetupExt } from '.'
import { parseUserMention } from '~/helpers/tiptap-markdown/extensions'

declare module 'markdown-it-task-lists' {
  import type { PluginWithOptions } from 'markdown-it'

  const taskLists: PluginWithOptions
  export default taskLists
}

export type NcMarkdownExtension = MarkdownIt.PluginSimple | MarkdownIt.PluginWithOptions<any> | MarkdownIt.PluginWithParams

export interface NcMarkdownParserConstructorType {
  openLinkOnClick?: boolean
  enableMention?: boolean
  users?: (Partial<UserType> | Partial<User>)[]
  currentUser?: Partial<UserType> | Partial<User> | null
  html?: boolean
  linkify?: boolean
  breaks?: boolean
  extensions?: NcMarkdownExtension[]
  maxBlockTokens?: number // Add this to limit block tokens
}

// Precompiled regex patterns
const taskRegex = /^(?!.*- )(\s*)\[( |x|X)\]/gm // Matches unchecked and checked tasks
const strikeThroughRegex = /(?<!~)~(?!~)(.*?)(?<!~)~(?!~)/g // Matches strikethrough syntax

export class NcMarkdownParser {
  private static instance: NcMarkdownParser | null = null
  private md: MarkdownIt
  private openLinkOnClick: boolean = true
  private maxBlockTokens?: number

  private constructor({
    openLinkOnClick = true,
    enableMention = false,
    users = [],
    currentUser = null,
    html = true,
    linkify = false,
    breaks = false,
    extensions = [],
    maxBlockTokens,
  }: NcMarkdownParserConstructorType = {}) {
    this.openLinkOnClick = openLinkOnClick
    this.maxBlockTokens = maxBlockTokens

    this.md = this.withPatchedRenderer(new MarkdownIt({ html, linkify, breaks }))

    // Use the task list plugin with options
    this.md.use(this.taskListExt)
    this.md.use(this.setupLinkRules, { openLinkOnClick: this.openLinkOnClick })

    if (enableMention) {
      this.md.use(this.mentionExt, { users, currentUser })
    }

    /**
     * Todo: Remove this once we enable proper image support in the rich text editor.
     * Also, replace its usage in other places such as:
     * 1. packages/nc-gui/helpers/tiptap-markdown/parse/MarkdownParser.ts
     * 2. packages/nc-gui/helpers/tiptap-markdown/extensions/nodes/image.ts
     */
    this.md.use(mdImageAsText)

    // Apply custom extensions passed during instantiation
    this.applyCustomExtensions(extensions)
  }

  /**
   * Gets the singleton instance of NcMarkdownParser.
   * If no instance exists, it creates and returns a new instance.
   * @param options - The options to initialize the parser.
   * @returns The singleton instance of the parser.
   */
  public static getInstance(options: NcMarkdownParserConstructorType = {}): NcMarkdownParser {
    if (!NcMarkdownParser.instance) {
      NcMarkdownParser.instance = new NcMarkdownParser(options)
    } else {
      // Reconfigure the instance based on new options
      NcMarkdownParser.instance.updateConfiguration(options)
    }

    return NcMarkdownParser.instance
  }

  private updateConfiguration(options: NcMarkdownParserConstructorType) {
    // Update properties that may change

    this.maxBlockTokens = options.maxBlockTokens

    if (!ncIsUndefined(options.openLinkOnClick) && this.openLinkOnClick !== options.openLinkOnClick) {
      this.openLinkOnClick = options.openLinkOnClick || false

      this.md.use(this.setupLinkRules, { openLinkOnClick: this.openLinkOnClick })
    }
  }

  public static preprocessMarkdown(markdownText: string, _isEditor = false): string {
    if (!ncIsString(markdownText)) return markdownText ?? ''
    // Only process task lists if not in editor mode
    // if (!isEditor) {
    // Replace [ ] and [x] with GitHub-style checklist syntax only if not already prefixed with "- "
    markdownText = markdownText.replace(taskRegex, (_match, spaces, state) => {
      const checked = state.toLowerCase() === 'x' ? '[x]' : '[ ]'
      return `${spaces}- ${checked}`
    })
    // }

    // Replace single tilde strikethrough syntax with <s> tags
    return markdownText.replace(strikeThroughRegex, '<s>$1</s>')
  }

  /**
   * Parses the content and optionally accepts options to initialize a new NcMarkdownParser instance.
   * @param content - The markdown content to parse.
   * @param options - Optional options to initialize the parser instance dynamically.
   */
  public static parse<T extends string>(
    content: T,
    options: NcMarkdownParserConstructorType = {},
    useSingleton: boolean = false,
  ): string {
    if (!ncIsString(content)) return content

    let parser: NcMarkdownParser

    if (useSingleton) {
      // Use the singleton instance
      parser = NcMarkdownParser.getInstance(options)
    } else {
      // Create a new instance for each parse call
      parser = new NcMarkdownParser(options)
    }

    // If content is a string, parse it
    if (ncIsString(content)) {
      return parser.md.render(NcMarkdownParser.preprocessMarkdown(content))
    }

    return content
  }

  public taskListExt(md: MarkdownIt): void {
    md.use(mdTaskList, { label: true, enabled: false })
  }

  public mentionExt(
    md: MarkdownIt,
    { users, currentUser }: Pick<NcMarkdownParserConstructorType, 'users' | 'currentUser'>,
  ): void {
    md.use(parseUserMention(users || [], currentUser, true))
  }

  /**
   * Configures link rules (whether links should open in a new tab)
   * @param openLinkOnClick
   */
  private setupLinkRules(
    md: MarkdownIt,
    { openLinkOnClick = true }: Pick<NcMarkdownParserConstructorType, 'openLinkOnClick'> = {},
  ): void {
    md.use(mdLinkRuleSetupExt, { openLinkOnClick })
  }

  /**
   * Dynamically apply custom extensions passed via constructor to the markdown-it instance.
   * @param extensions - Array of markdown-it plugins (extensions).
   */
  private applyCustomExtensions(extensions: NcMarkdownExtension[]): void {
    extensions.forEach((extension) => {
      this.md.use(extension)
    })
  }

  private patchedRender(
    tokens: MarkdownIt.Token[], // Array of tokens to render
    options: MarkdownIt.Options,
    env: any,
  ): string {
    const maxBlockTokens = this.maxBlockTokens

    let result = ''
    const rules = this.md.renderer.rules
    let blockCount = 0
    const blockStack: string[] = [] // Stack to manage block-level tokens
    let inBlockMode = false // Flag to handle when blocks exceed maxBlockTokens

    for (let i = 0, len = tokens.length; i < len; i++) {
      const { type, block, nesting } = tokens[i] as MarkdownIt.Token

      // Count block-level tokens
      if (maxBlockTokens && block) {
        if (nesting === 1) {
          // Push opening tag to the stack
          blockStack.push(type)
          blockCount++
        } else if (nesting === -1 && blockStack.length > 0) {
          // Match closing tag with stack
          blockStack.pop()
        }

        // If block count exceeds the limit, we enter block mode
        if (blockCount > maxBlockTokens) {
          inBlockMode = true
        }

        // Only break if blockStack is empty and maxBlock limit is exceeded
        if (inBlockMode && blockStack.length === 0) {
          break // Stop processing further tokens once max block limit is reached and stack is empty
        }
      }

      if (type === 'inline') {
        result += this.md.renderer.renderInline(tokens[i].children, options, env)
      } else if (typeof rules[type] !== 'undefined') {
        result += rules[type](tokens, i, options, env, this.md.renderer)
      } else {
        result += this.md.renderer.renderToken(tokens, i, options)
      }

      // Exit block mode if the stack is empty
      if (inBlockMode && blockStack.length === 0) {
        inBlockMode = false
      }
    }

    return result
  }

  private withPatchedRenderer(md: MarkdownIt): MarkdownIt {
    // Apply withoutNewLine adjustments
    const withoutNewLine =
      (renderer: any) =>
      (...args: any[]) => {
        const rendered = renderer(...args)
        if (rendered === '\n') {
          return rendered // keep soft breaks
        }
        if (rendered[rendered.length - 1] === '\n') {
          return rendered.slice(0, -1)
        }
        return rendered
      }

    md.renderer.rules.hardbreak = withoutNewLine(md.renderer.rules.hardbreak)
    md.renderer.rules.softbreak = withoutNewLine(md.renderer.rules.softbreak)
    md.renderer.rules.fence = withoutNewLine(md.renderer.rules.fence)
    md.renderer.rules.code_block = withoutNewLine(md.renderer.rules.code_block)
    md.renderer.renderToken = withoutNewLine(md.renderer.renderToken.bind(md.renderer))

    // Replace the render method with the patched version
    md.renderer.render = (tokens, options, env) => this.patchedRender(tokens, options, env)

    return md
  }
}
