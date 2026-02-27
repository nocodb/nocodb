<script setup lang="ts">
import type { DocCommentExtended } from '~/composables/useDocumentComments'

interface Props {
  comment: DocCommentExtended
  parsedHtml: string
  isOwner: boolean
  isHovered: boolean
  isEditing: boolean
  anchorText?: string
}

const props = withDefaults(defineProps<Props>(), {
  parsedHtml: '',
  isOwner: false,
  isHovered: false,
  isEditing: false,
  anchorText: undefined,
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
    class="nc-doc-comment-item group px-3 py-2 transition-colors"
    :class="{
      'hover:bg-nc-bg-gray-light': !isEditing,
      'bg-nc-bg-gray-light': isHovered,
    }"
  >
    <div class="flex items-start justify-between">
      <div class="flex items-start gap-2.5 flex-1 min-w-0">
        <GeneralUserIcon
          :user="{
            display_name: comment.created_display_name,
            email: comment.created_by_email,
            meta: comment.created_by_meta,
          }"
          class="mt-0.5 flex-shrink-0"
          size="medium"
        />
        <div class="flex flex-col min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="truncate text-nc-content-gray font-medium text-small leading-[18px]">
              {{ createdByLabel }}
            </span>
            <span class="text-xs text-nc-content-gray-muted flex-shrink-0">
              {{ timeAgo(comment.created_at!) }}
            </span>
          </div>

          <!-- Inline comment — quoted referenced text -->
          <div v-if="isInlineComment" class="nc-doc-comment-anchor-quote mt-1">
            <div v-if="anchorText" class="text-xs text-nc-content-gray-subtle line-clamp-2 pl-1.5 border-l-2 border-nc-border-brand italic">
              {{ anchorText }}
            </div>
            <div v-else class="text-xs text-nc-content-gray-muted italic">
              {{ $t('labels.referencedTextRemoved') }}
            </div>
          </div>

          <!-- Comment body -->
          <div
            class="nc-doc-comment-body mt-1 nc-rich-text-content text-small leading-[18px] text-nc-content-gray"
            v-html="parsedHtml"
          />

          <!-- Resolved badge -->
          <div
            v-if="comment.resolved_by"
            class="mt-1 flex items-center gap-1 text-xs text-nc-content-green-dark"
          >
            <GeneralIcon icon="checkCircle" class="w-3.5 h-3.5" />
            <span>{{ $t('general.resolved') }}</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-0.5 flex-shrink-0">
        <NcDropdown
          v-if="!isEditing && (isOwner || hasEditPermission)"
          class="!hidden !group-hover:block"
          overlay-class-name="!min-w-[140px]"
          placement="bottomRight"
        >
          <NcButton
            class="!w-7 !h-7 !bg-transparent !hover:bg-nc-bg-gray-medium"
            size="xsmall"
            type="text"
          >
            <GeneralIcon class="text-md" icon="threeDotVertical" />
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

        <!-- Resolve button (EE) -->
        <NcTooltip v-if="!comment.resolved_by && hasEditPermission">
          <NcButton
            class="!w-7 !h-7 !bg-transparent !hover:bg-nc-bg-gray-medium !hidden !group-hover:block"
            size="xsmall"
            type="text"
            @click="emit('resolve')"
          >
            <GeneralIcon class="text-md" icon="checkCircle" />
          </NcButton>
          <template #title>{{ $t('activity.clickToResolve') }}</template>
        </NcTooltip>

        <NcTooltip v-else-if="comment.resolved_by">
          <template #title>{{ `${$t('activity.resolvedBy')} ${comment.resolved_display_name_short}` }}</template>
          <NcButton
            class="!h-7 !w-7 !bg-transparent !hover:bg-nc-bg-gray-medium"
            size="xsmall"
            type="text"
            @click="emit('resolve')"
          >
            <GeneralIcon class="text-md rounded-full bg-nc-fill-green-dark text-white" icon="checkFill" />
          </NcButton>
        </NcTooltip>
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
