<script setup lang="ts">
import type { DocCommentExtended } from '~/composables/useDocumentComments'

interface Props {
  comment: DocCommentExtended
  parsedHtml: string
  isOwner: boolean
  isHovered: boolean
  isEditing: boolean
  anchorText?: string
  isFirstInGroup?: boolean
  isLastInGroup?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  parsedHtml: '',
  isOwner: false,
  isHovered: false,
  isEditing: false,
  anchorText: undefined,
  isFirstInGroup: true,
  isLastInGroup: true,
})

const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'delete'): void
  (e: 'resolve'): void
}>()

const { comment } = toRefs(props)

const { user } = useGlobal()

const { isUIAllowed } = useRoles()

const hasEditPermission = computed(() => isUIAllowed('documentCommentUpdate'))

const createdByLabel = computed(() => {
  if (comment.value.created_by === user.value?.id) return 'You'
  if (comment.value.created_display_name_short?.trim()) return comment.value.created_display_name_short
  if (comment.value.created_by_email) return comment.value.created_by_email
  return 'Unknown'
})

const isInlineComment = computed(() => !!comment.value.anchor_id)
</script>

<template>
  <div
    class="nc-doc-comment-item group"
    :class="{
      'px-3 pt-2.5': isFirstInGroup,
      'px-3': !isFirstInGroup,
      'pb-2.5': isLastInGroup,
      'pb-0.5': !isLastInGroup,
    }"
  >
    <!-- Card wrapper — only first-in-group gets the top border radius + header -->
    <div
      class="nc-doc-comment-card border-l-2 pl-2.5"
      :class="isOwner ? 'border-nc-border-brand' : 'border-nc-border-gray-medium'"
    >
      <!-- Header: avatar + name + time — only for first in group -->
      <div v-if="isFirstInGroup" class="flex items-center justify-between mb-1">
        <div class="flex items-center gap-1.5 min-w-0 flex-1">
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

        <!-- Actions — visible on hover -->
        <div class="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <NcDropdown
            v-if="!isEditing && (isOwner || hasEditPermission)"
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

          <NcTooltip v-if="!comment.resolved_by && hasEditPermission">
            <NcButton class="!w-5 !h-5 !bg-transparent !hover:bg-nc-bg-gray-light" size="xsmall" type="text" @click="emit('resolve')">
              <GeneralIcon class="text-xs" icon="checkCircle" />
            </NcButton>
            <template #title>{{ $t('activity.clickToResolve') }}</template>
          </NcTooltip>

          <NcTooltip v-else-if="comment.resolved_by">
            <template #title>{{ `${$t('activity.resolvedBy')} ${comment.resolved_display_name_short}` }}</template>
            <NcButton class="!w-5 !h-5 !bg-transparent !hover:bg-nc-bg-gray-light" size="xsmall" type="text" @click="emit('resolve')">
              <GeneralIcon class="text-xs rounded-full bg-nc-fill-green-dark text-white" icon="checkFill" />
            </NcButton>
          </NcTooltip>
        </div>
      </div>

      <!-- Inline comment — quoted referenced text -->
      <div v-if="isInlineComment && anchorText" class="mb-1">
        <div class="text-xs text-nc-content-gray-subtle line-clamp-2 pl-2 border-l-2 border-nc-border-brand italic rounded-sm bg-nc-bg-gray-light py-1 px-2">
          {{ anchorText }}
        </div>
      </div>

      <!-- Comment body -->
      <div
        class="nc-doc-comment-body nc-rich-text-content text-small leading-5 text-nc-content-gray"
        v-html="parsedHtml"
      />

      <!-- Resolved badge -->
      <div
        v-if="comment.resolved_by"
        class="mt-1 flex items-center gap-1 text-[10px] text-nc-content-green-dark"
      >
        <GeneralIcon icon="checkCircle" class="w-3 h-3" />
        <span>{{ $t('general.resolved') }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-doc-comment-body {
  :deep(p) {
    @apply !m-0 !leading-5;
  }
}
</style>
