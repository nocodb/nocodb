import TipTapMention from '@tiptap/extension-mention'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import EntityMentionChip from './EntityMentionChip.vue'

/** Every entity a host may allow mentioning. Hosts opt into a subset. */
export type EntityMentionKind =
  | 'table'
  | 'view'
  | 'automation'
  | 'script'
  | 'document'
  | 'user'
  | 'dashboard'
  | 'interface'
  | 'interfacePage'
  | 'integration'

export interface EntityMentionItem {
  kind: EntityMentionKind
  /** Entity id within its own kind. */
  refId: string
  title: string
  /** Secondary context — parent interface for a page, email for a user. */
  hint?: string
  /** Integration sub_type; drives the brand icon in the list and chip. */
  subType?: string
}

/**
 * Mention chip for non-user entities (tables, integrations today).
 *
 * Only registered where the host editor explicitly supplies items — agent
 * instructions — so docs and SmartText cells keep plain user mentions.
 * The `id` attr carries the whole `EntityMentionItem`, mirroring how
 * UserMention stuffs a payload object into `data-id`.
 */
export const EntityMention = TipTapMention.extend({
  name: 'entityMention',

  deleteTriggerWithBackspace: true,

  parseHTML() {
    return [{ tag: 'span[data-type="entity-mention"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const payload = parseProp(HTMLAttributes['data-id'])

    return [
      'span',
      {
        'class': 'mention nc-entity-mention',
        'data-type': 'entity-mention',
        'data-id': HTMLAttributes['data-id'],
      },
      `@${payload.title ?? ''}`,
    ]
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          const payload = node.attrs.id
          if (payload?.title) state.write(`@${payload.title}`)
        },
      },
    }
  },

  /** Icon-bearing chip. `renderHTML` above still defines the HTML/markdown form. */
  addNodeView() {
    return VueNodeViewRenderer(EntityMentionChip)
  },
})
