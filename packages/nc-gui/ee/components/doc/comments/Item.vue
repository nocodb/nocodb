<script setup lang="ts">
import { REACTION_EMOJIS } from 'nocodb-sdk'
import type { DocCommentExtended, ReactionSummaryItem } from '~/composables/useDocumentComments'

interface Props {
  comment: DocCommentExtended
  parsedHtml: string
  isOwner: boolean
  anchorText?: string
  isReply?: boolean
  reactionSummary?: ReactionSummaryItem[]
}

const props = withDefaults(defineProps<Props>(), {
  parsedHtml: '',
  isOwner: false,
  anchorText: undefined,
  isReply: false,
  reactionSummary: () => [],
})

const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'delete'): void
  (e: 'resolve'): void
  (e: 'activate'): void
  (e: 'reply'): void
  (e: 'scrollToAnchor', anchorId: string): void
  (e: 'react', emoji: string): void
}>()

const { comment } = toRefs(props)

const { user } = useGlobal()

const { t } = useI18n()

const { isUIAllowed } = useRoles()

const hasEditPermission = computed(() => isUIAllowed('documentCommentUpdate'))

const createdByLabel = computed(() => {
  if (comment.value.created_by === user.value?.id) return t('general.you')
  if (comment.value.created_display_name_short?.trim()) return comment.value.created_display_name_short
  if (comment.value.created_by_email) return comment.value.created_by_email
  return t('general.unknown')
})

const isInlineComment = computed(() => !!comment.value.anchor_id)
</script>

<template>
  <div
    class="nc-doc-comment-item group px-3 py-2 cursor-pointer"
    :data-testid="`nc-doc-comment-item${isReply ? '-reply' : ''}`"
    @click="emit('activate')"
  >
    <!-- Header: avatar + name + time + actions -->
    <div class="flex items-center justify-between mb-1.5">
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <GeneralUserIcon
          :user="{
            display_name: comment.created_display_name,
            email: comment.created_by_email,
            meta: comment.created_by_meta,
          }"
          class="flex-shrink-0"
          size="small"
          :initials-length="1"
        />
        <span class="font-semibold text-xs text-nc-content-gray truncate">
          {{ createdByLabel }}
        </span>
        <span class="text-[10px] text-nc-content-gray-muted flex-shrink-0">
          {{ timeAgo(comment.created_at!) }}
        </span>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-0.5 flex-shrink-0">
        <!-- Hover-only actions: 3-dot menu, reply, resolve (unresolved only) -->
        <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <NcDropdown v-if="isOwner || hasEditPermission" overlay-class-name="!min-w-[140px]" placement="bottomRight">
            <NcButton class="nc-doc-comment-action-btn" size="xxsmall" type="text" @click.stop>
              <GeneralIcon class="text-xs" icon="threeDotVertical" />
            </NcButton>
            <template #overlay>
              <NcMenu variant="small">
                <NcMenuItem v-if="isOwner && hasEditPermission" v-e="['c:doc:comment:edit']" @click="emit('edit')">
                  <div class="flex gap-2 items-center">
                    <component :is="iconMap.rename" class="cursor-pointer" />
                    {{ $t('general.edit') }}
                  </div>
                </NcMenuItem>
                <template v-if="isOwner && hasEditPermission">
                  <NcDivider />
                  <NcMenuItem v-e="['c:doc:comment:delete']" danger @click="emit('delete')">
                    <div class="flex gap-2 items-center">
                      <GeneralIcon icon="delete" class="cursor-pointer" />
                      {{ $t('general.delete') }}
                    </div>
                  </NcMenuItem>
                </template>
              </NcMenu>
            </template>
          </NcDropdown>

          <NcTooltip v-if="hasEditPermission" class="flex">
            <NcButton
              v-e="['c:doc:comment:reply']"
              class="nc-doc-comment-action-btn"
              size="xxsmall"
              type="text"
              @click.stop="emit('reply')"
            >
              <GeneralIcon class="text-xs" icon="ncCornerDownLeft" />
            </NcButton>
            <template #title>{{ $t('general.reply') }}</template>
          </NcTooltip>

          <!-- Reaction picker — NcTooltip outside NcDropdown for alignment, dropdown gets NcButton as direct child -->
          <NcTooltip v-if="hasEditPermission" class="flex">
            <NcDropdown placement="bottomRight">
              <NcButton
                v-e="['c:doc:comment:react']"
                class="nc-doc-comment-action-btn"
                size="xxsmall"
                type="text"
                data-testid="nc-doc-comment-react-btn"
                @click.stop
              >
                <GeneralIcon class="text-xs" icon="ncSmile" />
              </NcButton>
              <template #overlay>
                <div class="flex items-center gap-0.5 p-1.5">
                  <button
                    v-for="emoji in REACTION_EMOJIS"
                    :key="emoji"
                    class="nc-reaction-picker-emoji flex items-center justify-center w-7 h-7 rounded-md hover:bg-nc-bg-gray-light cursor-pointer text-base transition-colors"
                    :data-testid="`nc-doc-comment-react-${emoji}`"
                    @click="emit('react', emoji)"
                  >
                    {{ emoji }}
                  </button>
                </div>
              </template>
            </NcDropdown>
            <template #title>{{ $t('general.react') }}</template>
          </NcTooltip>

          <!-- Resolve button (unresolved state) — only on top-level comments, not replies -->
          <NcTooltip v-if="!isReply && !comment.resolved_by && hasEditPermission" class="flex" placement="topRight">
            <NcButton class="nc-doc-comment-action-btn" size="xxsmall" type="text" @click.stop="emit('resolve')">
              <GeneralIcon class="text-xs" icon="checkCircle" />
            </NcButton>
            <template #title>{{ $t('general.resolve') }}</template>
          </NcTooltip>
        </div>

        <!-- Resolved badge — always visible (green checkmark), only on top-level comments -->
        <NcTooltip v-if="!isReply && comment.resolved_by" class="flex" placement="topRight">
          <template #title>{{ `${$t('activity.resolvedBy')} ${comment.resolved_display_name_short}` }}</template>
          <NcButton
            class="nc-doc-resolve-badge nc-doc-comment-action-btn"
            size="xxsmall"
            type="text"
            @click.stop="emit('resolve')"
          >
            <GeneralIcon class="text-xs text-green-700" icon="checkCircle" />
          </NcButton>
        </NcTooltip>
      </div>
    </div>

    <!-- Inline comment — quoted referenced text from the document (click to scroll editor to source) -->
    <div
      v-if="isInlineComment && anchorText"
      class="mb-1.5 pl-6 cursor-pointer hover:opacity-80 transition-opacity"
      @click.stop="emit('scrollToAnchor', comment.anchor_id!)"
    >
      <div class="text-xs text-nc-content-gray-subtle line-clamp-2 italic border-l-2 border-nc-border-brand pl-2 py-0.5">
        {{ anchorText }}
      </div>
    </div>

    <!-- Comment body (rendered markdown/HTML) -->
    <div class="nc-doc-comment-body nc-rich-text-content text-small leading-5 text-nc-content-gray pl-6" v-html="parsedHtml" />

    <!-- Reaction bubbles -->
    <div v-if="reactionSummary.length" class="flex flex-wrap gap-1 pl-6 mt-1">
      <button
        v-for="r in reactionSummary"
        :key="r.emoji"
        class="nc-reaction-pill inline-flex items-center gap-0.75 px-1.5 h-6 rounded-full text-xs border-1 cursor-pointer transition-colors"
        :class="
          r.hasReacted
            ? 'bg-nc-bg-brand-light border-nc-border-brand text-nc-content-brand'
            : 'bg-nc-bg-gray-light border-nc-border-gray-medium text-nc-content-gray hover:bg-nc-bg-gray-medium'
        "
        :data-testid="`nc-doc-comment-reaction-${r.emoji}`"
        @click.stop="emit('react', r.emoji)"
      >
        <span>{{ r.emoji }}</span>
        <span class="font-medium">{{ r.count }}</span>
      </button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-doc-comment-body {
  :deep(p) {
    @apply !m-0 !leading-5;
  }
}

.nc-doc-comment-action-btn {
  @apply !bg-transparent hover:!bg-nc-bg-gray-medium;
}

// Pop-in animation when resolve badge appears (unresolved → resolved)
.nc-doc-resolve-badge {
  animation: resolve-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes resolve-pop {
  0% {
    transform: scale(0.3);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
