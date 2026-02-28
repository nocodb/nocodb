<script setup lang="ts">
import type { DocCommentExtended } from '~/composables/useDocumentComments'

interface Props {
  comment: DocCommentExtended
  parsedHtml: string
  isOwner: boolean
  isActive?: boolean
  hasActiveComment?: boolean
  anchorText?: string
  isReply?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  parsedHtml: '',
  isOwner: false,
  isActive: false,
  hasActiveComment: false,
  anchorText: undefined,
  isReply: false,
})

const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'delete'): void
  (e: 'resolve'): void
  (e: 'activate'): void
  (e: 'reply'): void
  (e: 'scrollToAnchor', anchorId: string): void
}>()

const { comment } = toRefs(props)

const { user } = useGlobal()

const { isUIAllowed } = useRoles()

const hasEditPermission = computed(() => isUIAllowed('documentCommentUpdate'))

const createdByLabel = computed(() => {
  // Matches existing pattern in EntryComment.vue, Sidebar/Comments.vue etc.
  if (comment.value.created_by === user.value?.id) return 'You'
  if (comment.value.created_display_name_short?.trim()) return comment.value.created_display_name_short
  if (comment.value.created_by_email) return comment.value.created_by_email
  return 'Unknown'
})

const isInlineComment = computed(() => !!comment.value.anchor_id)
</script>

<template>
  <div
    class="nc-doc-comment-item group cursor-pointer transition-opacity duration-200"
    :class="{
      'opacity-40': hasActiveComment && !isActive,
      'pl-9 pr-3 pt-0.5': isReply,
      'px-3 pt-1.5': !isReply,
    }"
    :data-testid="`nc-doc-comment-item${isReply ? '-reply' : ''}`"
    @click="emit('activate')"
  >
    <div
      class="nc-doc-comment-card rounded-lg border-1 border-nc-border-gray-medium px-3 py-2 transition-all duration-150"
      :class="{
        'bg-nc-bg-gray-extralight': !isActive,
        'bg-nc-bg-gray-light shadow-sm': isActive,
      }"
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
            <NcDropdown
              v-if="isOwner || hasEditPermission"
              overlay-class-name="!min-w-[140px]"
              placement="bottomRight"
            >
              <NcButton class="!w-5 !h-5 !bg-transparent !hover:bg-nc-bg-gray-light" size="xsmall" type="text">
                <GeneralIcon class="text-xs" icon="threeDotVertical" />
              </NcButton>
              <template #overlay>
                <NcMenu variant="small">
                  <NcMenuItem
                    v-if="isOwner && hasEditPermission"
                    v-e="['c:doc:comment:edit']"
                    @click="emit('edit')"
                  >
                    <div class="flex gap-2 items-center">
                      <component :is="iconMap.rename" class="cursor-pointer" />
                      {{ $t('general.edit') }}
                    </div>
                  </NcMenuItem>
                  <template v-if="isOwner && hasEditPermission">
                    <NcDivider />
                    <NcMenuItem
                      v-e="['c:doc:comment:delete']"
                      danger
                      @click="emit('delete')"
                    >
                      <div class="flex gap-2 items-center">
                        <GeneralIcon icon="delete" class="cursor-pointer" />
                        {{ $t('general.delete') }}
                      </div>
                    </NcMenuItem>
                  </template>
                </NcMenu>
              </template>
            </NcDropdown>

            <NcTooltip v-if="hasEditPermission">
              <NcButton v-e="['c:doc:comment:reply']" class="!w-5 !h-5 !bg-transparent !hover:bg-nc-bg-gray-light" size="xsmall" type="text" @click.stop="emit('reply')">
                <GeneralIcon class="text-xs" icon="ncCornerDownLeft" />
              </NcButton>
              <template #title>{{ $t('general.reply') }}</template>
            </NcTooltip>

            <!-- Resolve button (unresolved state) — only on top-level comments, not replies -->
            <NcTooltip v-if="!isReply && !comment.resolved_by && hasEditPermission">
              <NcButton class="!w-5 !h-5 !bg-transparent !hover:bg-nc-bg-gray-light" size="xsmall" type="text" @click.stop="emit('resolve')">
                <GeneralIcon class="text-xs" icon="checkCircle" />
              </NcButton>
              <template #title>{{ $t('activity.clickToResolve') }}</template>
            </NcTooltip>
          </div>

          <!-- Resolved badge — always visible (green checkmark), only on top-level comments -->
          <NcTooltip v-if="!isReply && comment.resolved_by">
            <template #title>{{ `${$t('activity.resolvedBy')} ${comment.resolved_display_name_short}` }}</template>
            <NcButton class="nc-doc-resolve-badge !w-5 !h-5 !bg-transparent !hover:bg-nc-bg-gray-light" size="xsmall" type="text" @click.stop="emit('resolve')">
              <GeneralIcon class="text-xs text-nc-content-green-dark" icon="checkCircle" />
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
      <div
        class="nc-doc-comment-body nc-rich-text-content text-small leading-5 text-nc-content-gray pl-6"
        v-html="parsedHtml"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-doc-comment-body {
  :deep(p) {
    @apply !m-0 !leading-5;
  }
}

.nc-doc-comment-item:hover .nc-doc-comment-card {
  @apply bg-nc-bg-gray-light;
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
