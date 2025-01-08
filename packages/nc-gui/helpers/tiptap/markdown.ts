import MarkdownIt from 'markdown-it'
import taskList from 'markdown-it-task-lists'
import type { UserType } from 'nocodb-sdk'

declare module 'markdown-it-task-lists' {
  import { PluginWithOptions } from 'markdown-it'

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
}

export class NcMarkdownParser {
  public md: MarkdownIt
  public openLinkOnClick: boolean = false

  constructor({
    openLinkOnClick = false,
    enableMention = false,
    users = [],
    currentUser = null,
    html = false,
    linkify = false,
    breaks = false,
    extensions = [],
  }: NcMarkdownParserConstructorType = {}) {
    this.openLinkOnClick = openLinkOnClick

    this.md = this.withPatchedRenderer(new MarkdownIt({ html, linkify, breaks }))

    // Use the task list plugin with options
    this.md.use(this.taskListExt)
    this.md.use(this.setupLinkRules)

    if (enableMention) {
      this.md.use(this.mentionExt, { users, currentUser })
    }

    // Apply custom extensions passed during instantiation
    this.applyCustomExtensions(extensions)
  }

  public parse<T extends any>(content: T): string | T {
    if (ncIsString(content)) {
      // Render Markdown to HTML
      return this.md.render(content)
    }

    return content
  }

  public taskListExt(md: MarkdownIt): void {
    md.use(taskList, { label: true, enabled: true })
  }

  public mentionExt(
    md: MarkdownIt,
    { users, currentUser }: Pick<NcMarkdownParserConstructorType, 'users' | 'currentUser'>,
  ): void {
    // Todo: mention logic add
  }

  /**
   * Configures link rules (whether links should open in a new tab)
   * @param openLinkOnClick
   */
  private setupLinkRules(md: MarkdownIt): void {
    if (!this.openLinkOnClick) {
      // Remove the href attribute from links
      md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
        const hrefIndex = tokens[idx]!.attrIndex('href')
        if (hrefIndex >= 0) {
          tokens[idx]!.attrs!.splice(hrefIndex, 1)
        }
        return self.renderToken(tokens, idx, options)
      }
    } else {
      // Add attributes to links
      md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
        const targetIndex = tokens[idx]!.attrIndex('target')
        if (targetIndex < 0) {
          tokens[idx]!.attrPush(['target', '_blank'])
        }
        const relIndex = tokens[idx]!.attrIndex('rel')
        if (relIndex < 0) {
          tokens[idx]!.attrPush(['rel', 'noopener noreferrer nofollow'])
        }
        const onClickIndex = tokens[idx]!.attrIndex('onmousedown')
        if (onClickIndex < 0) {
          tokens[idx]!.attrPush(['onmousedown', '(function(event) { event.stopImmediatePropagation(); })(event)'])
        }
        return self.renderToken(tokens, idx, options)
      }
    }
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

  public withPatchedRenderer(md: MarkdownIt): MarkdownIt {
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

    return md
  }
}
