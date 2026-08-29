<script setup lang="ts">
import { useStorage } from '@vueuse/core'

const props = defineProps<{
  showFieldsTab?: boolean
  /** Render the Fields tab content in compact mode. Forwarded straight to
   * MiniColumnsWrapper. */
  compactMode?: boolean
  /** Discussion mode — the feed lives in the MAIN pane: Fields only, bell kept. */
  activityInMainPane?: boolean
}>()

const { $e } = useNuxtApp()

const { t } = useI18n()

const { isSqlView } = useSmartsheetStoreOrThrow()

const expandedFormStore = useExpandedFormStoreOrThrow()

// Audit (revision history) is hidden in public/shared bases — the backend
// blocks the read; offering an empty/forbidden feed makes no sense there.
const { isAuditEnabled } = expandedFormStore

const { isExpandedFormCommentMode } = storeToRefs(useConfigStore())

const FEEDS = [
  { value: 'fields', labelKey: 'objects.fields' },
  { value: 'audits', labelKey: 'labels.revisionHistory' },
] as const

/** Bottom section — picking one IS selecting the comments feed. */
const COMMENT_FILTERS = [
  { value: 'all', labelKey: 'labels.allComments' },
  { value: 'record', labelKey: 'labels.recordComments' },
  { value: 'onAttachments', labelKey: 'labels.commentsOnAttachments' },
  { value: 'withAttachments', labelKey: 'labels.commentsWithAttachments' },
] as const

type SidebarFeed = (typeof FEEDS)[number]['value'] | 'comments'
type CommentFilter = (typeof COMMENT_FILTERS)[number]['value']

const tab = ref<SidebarFeed>(
  props.showFieldsTab && (props.activityInMainPane || !isExpandedFormCommentMode.value || isSqlView.value)
    ? 'fields'
    : 'comments',
)

const isSelectorOpen = ref(false)

/** Own keys, not the interface drawer's — the two surfaces must not overwrite each other. */
const commentFilter = useStorage<CommentFilter>('nc-expanded-form-comment-filter', 'all')

/** Defaults ON — the classic feed passed no filter before, so it always showed resolved. */
const showResolvedComments = useStorage('nc-expanded-form-show-resolved', true)

const showCommentFilters = computed(() => !props.activityInMainPane && !isSqlView.value)

const showAudits = computed(() => !props.activityInMainPane && !isSqlView.value && isAuditEnabled.value)

const feedOptions = computed(() => FEEDS.filter((feed) => (feed.value === 'fields' ? !!props.showFieldsTab : showAudits.value)))

const activeLabel = computed(() => {
  const feed = FEEDS.find((f) => f.value === tab.value)
  if (feed) return t(feed.labelKey)

  // The comments feed reads as its active filter ("All comments" & co).
  return t(COMMENT_FILTERS.find((f) => f.value === commentFilter.value)?.labelKey ?? 'labels.allComments')
})

/** The resolved toggle is meaningless for the attachment filters — those are open-comments-only. */
const offersResolvedToggle = computed(
  () => tab.value === 'comments' && (commentFilter.value === 'all' || commentFilter.value === 'record'),
)

/** The bell follows the comments feed — except in Discussion mode, where the main pane is it. */
const showNotificationBell = computed(() => isEeUI && (props.activityInMainPane || tab.value === 'comments'))

function setFeed(value: SidebarFeed) {
  tab.value = value
  isSelectorOpen.value = false
}

function setCommentFilter(filter: CommentFilter) {
  commentFilter.value = filter
  setFeed('comments')
  $e('c:row-expand:comment', { filter })
}

/** A scope toggle, not a feed pick — leaves the active filter alone. */
function toggleShowResolved() {
  showResolvedComments.value = !showResolvedComments.value
  $e('c:row-expand:show-resolved', { on: showResolvedComments.value })
}

watch(tab, (newValue) => {
  if (newValue === 'audits') {
    expandedFormStore.loadAudits()
  }
})

// Options come and go with the host presentor (Fields) and the row's context
// (SQL view, shared base) — never leave the panel on a feed that's gone.
watch(
  [feedOptions, showCommentFilters],
  ([options, hasComments]) => {
    if (tab.value === 'comments' ? hasComments : options.some((feed) => feed.value === tab.value)) return
    if (hasComments) return setFeed('comments')
    if (options.length) setFeed(options[0].value)
  },
  { immediate: true },
)
</script>

<template>
  <div
    v-if="feedOptions.length || showCommentFilters"
    class="flex flex-col bg-nc-bg-elevated !h-full w-full rounded-br-2xl overflow-hidden"
  >
    <div class="flex-none flex items-center gap-1 px-2 py-1.5 border-b-1 border-nc-border-gray-light">
      <NcDropdown v-model:visible="isSelectorOpen" placement="bottomLeft">
        <NcButton type="text" size="small" data-testid="nc-expanded-form-sidebar-feed-selector">
          <div class="flex items-center gap-1.5 min-w-0 text-bodyDefaultSm font-medium text-nc-content-gray">
            <span class="truncate">{{ activeLabel }}</span>
            <GeneralIcon icon="chevronDown" class="flex-none w-3.5 h-3.5 text-nc-content-gray-muted" />
          </div>
        </NcButton>

        <template #overlay>
          <NcMenu variant="small">
            <NcMenuItem
              v-if="showFieldsTab"
              v-e="['c:row-expand:fields']"
              data-testid="nc-expanded-form-sidebar-feed-fields"
              @click="setFeed('fields')"
            >
              <div class="flex items-center gap-2 min-w-52">
                <span class="flex-1">{{ $t('objects.fields') }}</span>
                <GeneralIcon v-if="tab === 'fields'" icon="check" class="flex-none w-4 h-4 text-nc-content-brand" />
              </div>
            </NcMenuItem>

            <NcMenuItem
              v-if="showAudits"
              v-e="['c:row-expand:audit']"
              data-testid="nc-expanded-form-sidebar-feed-audits"
              @click="setFeed('audits')"
            >
              <div class="flex items-center gap-2 min-w-52">
                <span class="flex-1">{{ $t('labels.revisionHistory') }}</span>
                <GeneralIcon v-if="tab === 'audits'" icon="check" class="flex-none w-4 h-4 text-nc-content-brand" />
              </div>
            </NcMenuItem>

            <template v-if="showCommentFilters">
              <NcDivider v-if="feedOptions.length" class="!my-1" />

              <NcMenuItem
                v-for="option in COMMENT_FILTERS"
                :key="option.value"
                :data-testid="`nc-expanded-form-sidebar-filter-${option.value}`"
                @click="setCommentFilter(option.value)"
              >
                <div class="flex items-center gap-2 min-w-52">
                  <span class="flex-1">{{ $t(option.labelKey) }}</span>
                  <GeneralIcon
                    v-if="tab === 'comments' && commentFilter === option.value"
                    icon="check"
                    class="flex-none w-4 h-4 text-nc-content-brand"
                  />
                </div>
              </NcMenuItem>

              <template v-if="offersResolvedToggle">
                <NcDivider class="!my-1" />

                <NcMenuItem data-testid="nc-expanded-form-sidebar-show-resolved" @click="toggleShowResolved">
                  <div class="flex items-center gap-2 min-w-52">
                    <span class="flex-1">{{ $t('labels.showResolvedComments') }}</span>
                    <GeneralIcon v-if="showResolvedComments" icon="check" class="flex-none w-4 h-4 text-nc-content-brand" />
                  </div>
                </NcMenuItem>
              </template>
            </template>
          </NcMenu>
        </template>
      </NcDropdown>

      <!-- Record bell — per-user comment-notification preference (EE; CE stub
           renders nothing). -->
      <SmartsheetExpandedFormSidebarCommentNotificationBell v-if="showNotificationBell" class="flex-none ml-auto" />
    </div>

    <div class="flex-1 min-h-0 overflow-hidden">
      <SmartsheetExpandedFormPresentorsFieldsMiniColumnsWrapper v-if="tab === 'fields'" :compact-mode="compactMode" />
      <SmartsheetExpandedFormSidebarComments
        v-else-if="tab === 'comments'"
        :comment-filter="commentFilter"
        :show-resolved="showResolvedComments"
        class="h-full"
      />
      <SmartsheetExpandedFormSidebarAudits v-else-if="tab === 'audits'" class="h-full" />
    </div>
  </div>
</template>
