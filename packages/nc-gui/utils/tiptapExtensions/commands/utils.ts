import type { Ref } from 'vue'
import type { Editor, Range } from '@tiptap/vue-3'
import { isMacOS } from '@tiptap/vue-3'
import showdown from 'showdown'
import { TiptapNodesTypes } from 'nocodb-sdk'

import { generateJSON } from '@tiptap/html'
import { createTable } from '@tiptap/extension-table'
import { TextSelection } from 'prosemirror-state'
import CollapsableH1Icon from './custom-icons/CollapsableH1.vue'
import CollapsableH2Icon from './custom-icons/CollapsableH2.vue'
import CollapsableH3Icon from './custom-icons/CollapsableH3.vue'
import GoogleSheetsIcon from './custom-icons/GoogleSheets.vue'
import GoogleDocsIcon from './custom-icons/GoogleDocs.vue'
import GoogleSlidesIcon from './custom-icons/GoogleSlides.vue'
import ClickupIcon from './custom-icons/Clickup.vue'
import MiroIcon from './custom-icons/Miro.vue'
import MdiFormatHeader1 from '~icons/mdi/format-header-1'
import MdiFormatHeader2 from '~icons/mdi/format-header-2'
import MdiFormatHeader3 from '~icons/mdi/format-header-3'
import MdiBulletList from '~icons/mdi/format-list-bulleted'
import MdiNumberedList from '~icons/mdi/format-list-numbered'
import MdiTaskList from '~icons/mdi/format-list-checks'
import MdiMinus from '~icons/mdi/minus'
import MdiCodeSnippet from '~icons/mdi/code-braces'
import MdiImageMultipleOutline from '~icons/mdi/image-multiple-outline'
import MdiFormatColorText from '~icons/mdi/format-color-text'
import PhSparkleFill from '~icons/ph/sparkle-fill'
import MdiFormatQuoteOpen from '~icons/mdi/format-quote-open'
import IcOutlineInfo from '~icons/ic/outline-info'
import IcOutlineCode from '~icons/ic/outline-code'
import IcRoundStar from '~icons/ic/round-star-outline'
import IcRoundWarning from '~icons/ph/warning-circle-bold'
import MdiTable from '~icons/mdi/table'
import LogosYoutubeIcon from '~icons/logos/youtube-icon'
import LogosGithubIcon from '~icons/logos/github-icon'
import LogosFigmaIcon from '~icons/logos/figma'
import LogosAirtableIcon from '~icons/logos/airtable'
import LogosCodepenIcon from '~icons/logos/codepen-icon'
import LogosTrelloIcon from '~icons/logos/trello'
import LogosTypeformIcon from '~icons/logos/typeform-icon'
import MdiLinkVariant from '~icons/mdi/link-variant'
import CollapseListIcon from '~icons/carbon/collapse-categories'
import MdiFileUploadOutline from '~icons/mdi/file-upload-outline'
import MsViewColumn2 from '~icons/material-symbols/view-column-2-outline'
import MaterialSymbolsFileOpen from '~icons/material-symbols/file-open-outline'

export const useCommandList = ({
  fileInputDomRef,
  linkOptions,
  loadingOpType,
}: {
  fileInputDomRef: Ref<HTMLElement[] | undefined>
  linkOptions: Ref<{
    url: string
    title: string
    type: string
    isErrored: boolean
    isVisible: boolean
  }>
  loadingOpType: Ref<string>
}) => {
  const { magicOutline } = useDocStore()
  const { openedPage, openedProjectId } = storeToRefs(useDocStore())

  const commands = ref([
    {
      title: 'Heading 1',
      class: 'text-xs',
      style: 'font-weight: 800;',
      command: ({ editor, range }: { editor: Editor; range: Range }) => {
        editor.chain().focus().deleteRange(range).setNode(TiptapNodesTypes.heading, { level: 1 }).run()
      },
      icon: MdiFormatHeader1,
      iconClass: 'pt-0.5',
      shortCutText: isMacOS() ? '^ ⇧ 1' : 'Ctrl ⇧ 1',
    },
    {
      title: 'Heading 2',
      class: 'text-xs',
      style: 'font-weight: 700;',
      command: ({ editor, range }: { editor: Editor; range: Range }) => {
        editor.chain().focus().deleteRange(range).setNode(TiptapNodesTypes.heading, { level: 2 }).run()
      },
      icon: MdiFormatHeader2,
      iconClass: 'pt-0.5',
      shortCutText: isMacOS() ? '^ ⇧ 2' : 'Ctrl ⇧ 2',
    },
    {
      title: 'Heading 3',
      class: 'text-xs',
      style: 'font-weight: 500;',
      command: ({ editor, range }: { editor: Editor; range: Range }) => {
        editor.chain().focus().deleteRange(range).setNode(TiptapNodesTypes.heading, { level: 3 }).run()
      },
      icon: MdiFormatHeader3,
      iconClass: 'pt-0.5',
      hasDivider: true,
      shortCutText: isMacOS() ? '^ ⇧ 3' : 'Ctrl ⇧ 3',
    },
    {
      title: 'Link',
      class: 'text-xs',
      command: ({ editor, range }: { editor: Editor; range: Range }) => {
        editor.chain().focus().deleteRange(range).setLink({ href: '' }).run()
      },
      icon: MdiLinkVariant,
      shortCutText: isMacOS() ? '⌘ J' : 'Ctrl J',
    },
    {
      title: 'Link to page',
      class: 'text-xs',
      command: ({ editor, range }: { editor: Editor; range: Range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContentAt(range.from - 2, {
            type: TiptapNodesTypes.sec,
            content: [
              {
                type: TiptapNodesTypes.linkToPage,
              },
            ],
          })
          .run()
      },
      icon: MaterialSymbolsFileOpen,
    },
    {
      title: 'Body Text',
      class: 'text-xs',
      command: ({ editor, range }: { editor: Editor; range: Range }) => {
        editor.chain().focus().deleteRange(range).setNode(TiptapNodesTypes.paragraph, { level: 2 }).run()
      },
      icon: MdiFormatColorText,
      iconClass: '',
    },
    {
      title: 'Quote',
      class: 'text-xs',
      command: ({ editor, range }: { editor: Editor; range: Range }) => {
        editor.chain().focus().deleteRange(range).setBlockquote().run()
      },
      icon: MdiFormatQuoteOpen,
      iconClass: '',
      shortCutText: isMacOS() ? '^ ⌥ Q' : 'Ctrl Alt Q',
    },
    {
      title: 'Image',
      class: 'text-xs',
      command: () => {
        fileInputDomRef.value?.[0]?.click()
      },
      icon: MdiImageMultipleOutline,
      iconClass: '',
    },

    {
      title: 'Code',
      class: 'text-xs',
      command: ({ editor, range }: { editor: Editor; range: Range }) => {
        editor.chain().focus().deleteRange(range).setCodeBlock().run()
      },
      icon: MdiCodeSnippet,
      iconClass: '',
      shortCutText: isMacOS() ? '⌥ ⌘ C' : 'Alt Ctrl C',
    },
    {
      title: 'Attachment',
      class: 'text-xs',
      command: () => {
        fileInputDomRef.value?.[0]?.click()
      },
      icon: MdiFileUploadOutline,
      iconClass: '',
    },
    {
      title: 'Columns - 2',
      class: 'text-xs',
      command: ({ editor, range }: { editor: Editor; range: Range }) => {
        editor.chain().focus().deleteRange(range).insertColumn(2).run()
      },
      icon: MsViewColumn2,
      hasDivider: true,
    },
    {
      title: 'Task List',
      class: 'text-xs',
      command: ({ editor, range }: { editor: Editor; range: Range }) => {
        editor.chain().focus().deleteRange(range).setParagraph().toggleTask().run()
      },
      icon: MdiTaskList,
      iconClass: '',
      shortCutText: isMacOS() ? '^ ⌥ 1' : 'Ctrl Alt 1',
    },
    {
      title: 'Bullet List',
      class: 'text-xs',
      command: ({ editor, range }: { editor: Editor; range: Range }) => {
        editor.chain().focus().deleteRange(range).setParagraph().toggleBullet().run()
      },
      icon: MdiBulletList,
      iconClass: '',
      // Ctrl + Option + Shift + 8
      shortCutText: isMacOS() ? '^ ⌥ 2' : 'Ctrl Alt 2',
    },
    {
      title: 'Numbered List',
      class: 'text-xs',
      command: ({ editor, range }: { editor: Editor; range: Range }) => {
        editor.chain().focus().deleteRange(range).insertOrdered().run()
      },
      icon: MdiNumberedList,
      iconClass: '',
      shortCutText: isMacOS() ? '^ ⌥ 3' : 'Ctrl Alt 3',
    },
    {
      title: 'Collapsable',
      class: 'text-xs',
      command: ({ editor, range }: { editor: Editor; range: Range }) => {
        editor.chain().focus().deleteRange(range).insertCollapsable().run()
      },
      icon: CollapseListIcon,
      shortCutText: isMacOS() ? '^ ⌥ 4' : 'Ctrl Alt 4',
      hasDivider: true,
    },
    {
      title: 'Info notice',
      class: 'text-xs',
      command: ({ editor, range }: { editor: Editor; range: Range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({
            type: TiptapNodesTypes.infoCallout,
            content: [
              {
                type: TiptapNodesTypes.paragraph,
                text: '',
              },
            ],
          })
          .run()
      },
      icon: IcOutlineInfo,
      iconClass: '',
    },
    {
      title: 'Tip notice',
      class: 'text-xs',
      command: ({ editor, range }: { editor: Editor; range: Range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({
            type: TiptapNodesTypes.tipCallout,
            content: [
              {
                type: TiptapNodesTypes.paragraph,
                text: '',
              },
            ],
          })
          .run()
      },
      icon: IcRoundStar,
      iconClass: '',
    },
    {
      title: 'Warning notice',
      class: 'text-xs',
      command: ({ editor, range }: { editor: Editor; range: Range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({
            type: TiptapNodesTypes.warningCallout,
            content: [
              {
                type: TiptapNodesTypes.paragraph,
                text: '',
              },
            ],
          })
          .run()
      },
      icon: IcRoundWarning,
      iconClass: '',
      hasDivider: true,
    },
    {
      title: 'Table',
      class: 'text-xs',
      command: ({ editor, range }: { editor: Editor; range: Range }) => {
        editor.chain().focus().deleteRange(range).run()
        const node = createTable(editor.schema, 3, 3, false)
        const tr = editor.state.tr

        const offset = tr.selection.anchor + 1
        tr.replaceWith(tr.selection.anchor - 1, tr.selection.anchor, node)
          .scrollIntoView()
          .setSelection(TextSelection.near(tr.doc.resolve(offset)))

        editor.view.dispatch(tr)
      },
      icon: MdiTable,
      iconClass: '',
    },
    {
      title: 'Divider',
      class: 'text-xs',
      command: ({ editor, range }: { editor: Editor; range: Range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .setNode(TiptapNodesTypes.divider)
          .focus()
          .setHorizontalRule()
          .setTextSelection(range.from + 3)
          .run()
      },
      icon: MdiMinus,
      iconClass: '',
      hasDivider: true,
      shortCutText: isMacOS() ? '^ ⇧ H' : 'Ctrl ⇧ H',
    },
    {
      title: 'Collapsable heading 1',
      class: 'text-xs',
      style: 'font-weight: 800;',
      command: ({ editor, range }: { editor: Editor; range: Range }) => {
        editor.chain().focus().deleteRange(range).insertCollapsableH1().run()
      },
      icon: CollapsableH1Icon,
      iconClass: '',
    },
    {
      title: 'Collapsable heading 2',
      class: 'text-xs',
      style: 'font-weight: 700;',
      command: ({ editor, range }: { editor: Editor; range: Range }) => {
        editor.chain().focus().deleteRange(range).insertCollapsableH2().run()
      },
      icon: CollapsableH2Icon,
      iconClass: '',
    },
    {
      title: 'Collapsable heading 3',
      class: 'text-xs',
      style: 'font-weight: 500;',
      command: ({ editor, range }: { editor: Editor; range: Range }) => {
        editor.chain().focus().deleteRange(range).insertCollapsableH3().run()
      },
      icon: CollapsableH3Icon,
      iconClass: '',
      hasDivider: true,
    },
    {
      title: 'Google Docs',
      class: 'text-xs',
      command: () => {
        linkOptions.value.type = 'googleDoc'
        linkOptions.value.isVisible = true
      },
      icon: GoogleDocsIcon,
      iconClass: '',
    },
    {
      title: 'Google Sheet',
      class: 'text-xs',
      command: () => {
        linkOptions.value.type = 'googleSheet'
        linkOptions.value.isVisible = true
      },
      icon: GoogleSheetsIcon,
      iconClass: '',
    },
    {
      title: 'Google Slide',
      class: 'text-xs',
      command: () => {
        linkOptions.value.type = 'googleSlide'
        linkOptions.value.isVisible = true
      },
      icon: GoogleSlidesIcon,
      iconClass: '',
    },
    {
      title: 'Airtable',
      class: 'text-xs',
      command: () => {
        linkOptions.value.type = 'airtable'
        linkOptions.value.isVisible = true
      },
      icon: LogosAirtableIcon,
      iconClass: '',
    },
    {
      title: 'Github Gist',
      class: 'text-xs',
      command: () => {
        linkOptions.value.type = 'githubGist'
        linkOptions.value.isVisible = true
      },
      icon: LogosGithubIcon,
      iconClass: '',
    },
    {
      title: 'Figma',
      class: 'text-xs',
      command: () => {
        linkOptions.value.type = 'figma'
        linkOptions.value.isVisible = true
      },
      icon: LogosFigmaIcon,
      iconClass: '',
    },
    {
      title: 'Clickup',
      class: 'text-xs -ml-1',
      command: () => {
        linkOptions.value.type = 'clickup'
        linkOptions.value.isVisible = true
      },
      icon: ClickupIcon,
      iconClass: '',
    },
    {
      title: 'Miro',
      class: 'text-xs -ml-1',
      command: () => {
        linkOptions.value.type = 'miro'
        linkOptions.value.isVisible = true
      },
      icon: MiroIcon,
      iconClass: '',
    },
    {
      title: 'Typeform',
      class: 'text-xs',
      command: () => {
        linkOptions.value.type = 'typeform'
        linkOptions.value.isVisible = true
      },
      icon: LogosTypeformIcon,
      iconClass: '',
    },
    {
      title: 'Trello',
      class: 'text-xs',
      command: () => {
        linkOptions.value.type = 'trello'
        linkOptions.value.isVisible = true
      },
      icon: LogosTrelloIcon,
      iconClass: '',
    },
    {
      title: 'Codepen',
      class: 'text-xs',
      command: () => {
        linkOptions.value.type = 'codepen'
        linkOptions.value.isVisible = true
      },
      icon: LogosCodepenIcon,
      iconClass: '',
    },
    {
      title: 'Youtube',
      class: 'text-xs',
      command: () => {
        linkOptions.value.type = 'youtube'
        linkOptions.value.isVisible = true
      },
      icon: LogosYoutubeIcon,
      iconClass: '',
    },
    {
      title: 'Embed iframe',
      class: 'text-xs',
      command: () => {
        linkOptions.value.type = 'embed'
        linkOptions.value.isVisible = true
      },
      icon: IcOutlineCode,
      iconClass: '',
      hasDivider: true,
    },
    {
      title: 'Outline page',
      class: 'text-xs',
      command: ({ editor }: { editor: Editor }) => {
        outlinePage(editor)
      },
      icon: PhSparkleFill,
      iconClass: 'text-orange-400 h-3.5',
    },
  ])

  async function outlinePage(editor: Editor) {
    if (loadingOpType.value) return

    // Delete the current line
    const { from } = editor.state.selection
    const parent = editor.state.doc.resolve(from).parent

    loadingOpType.value = 'Outline page'
    try {
      const converter = new showdown.Converter()
      converter.setOption('noHeaderId', true)

      const response: any = await magicOutline({
        projectId: openedProjectId.value,
        pageId: openedPage.value?.id,
      })

      const html = converter
        .makeHtml(
          response.text
            .replace(/\n\n# .*?\n/g, '')
            .replace('## ', '# ')
            .replace('### ', '## '),
        )
        .replace('>\n<', '><')

      // Removed line which has :content: text
      const cleanedHtml = html.replace(/--content--/gi, '')
      const tiptapNewNodeJSON = generateJSON(cleanedHtml, editor.extensionManager.extensions)

      editor
        .chain()
        .focus()
        .setNodeSelection(from - parent.nodeSize)
        .deleteSelection()
        .run()

      const transaction = editor?.state.tr
      for (const node of tiptapNewNodeJSON.content.reverse()) {
        if (node?.content?.[0]?.text === openedPage.value?.title) {
          continue
        }

        const proseNode = editor.schema.nodeFromJSON(node)
        transaction.insert(0, proseNode)
      }
      editor?.view.dispatch(transaction)
    } finally {
      loadingOpType.value = ''
    }
  }

  return {
    commands,
  }
}
