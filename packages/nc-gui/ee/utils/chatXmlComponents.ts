/**
 * XML component mappings for chat message rendering.
 * Maps <nc-*> XML tags in LLM output to Vue components.
 *
 * Must be called inside <script setup> context since it uses resolveComponent.
 */
import type { NcChatRendererOptions } from '~/ee/utils/chatMarkdown'

export function useChatXmlComponents(): NcChatRendererOptions['xmlComponents'] {
  return {
    'nc-table': { component: resolveComponent('ChatMarkdownTableMention') as any },
    'nc-field': { component: resolveComponent('ChatMarkdownFieldMention') as any },
    'nc-records': { component: resolveComponent('ChatMarkdownEmbeddedGrid') as any },
    'nc-data': { component: resolveComponent('ChatMarkdownVirtualTable') as any },
    'nc-record-source': { component: resolveComponent('ChatMarkdownRecordCitation') as any },
    'nc-url-source': { component: resolveComponent('ChatMarkdownUrlSource') as any },
    'nc-view': { component: resolveComponent('ChatMarkdownViewMention') as any },
    'nc-dashboard': { component: resolveComponent('ChatMarkdownDashboardMention') as any },
  }
}
