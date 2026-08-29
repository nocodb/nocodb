<script setup lang="ts">
const props = defineProps<{
  showFieldsTab?: boolean
  /** Render the Fields tab content in compact mode. Forwarded straight to
   * MiniColumnsWrapper. */
  compactMode?: boolean
  /** Discussion mode — the activity feed lives in the MAIN pane, so the
   * sidebar opens on Fields and keeps the record bell whatever feed is
   * selected. */
  activityInMainPane?: boolean
}>()

const { t } = useI18n()

const { isSqlView } = useSmartsheetStoreOrThrow()

const expandedFormStore = useExpandedFormStoreOrThrow()

// Audit (revision history) is hidden in public/shared bases — the backend
// blocks the read; offering an empty/forbidden feed makes no sense there.
const { isAuditEnabled } = expandedFormStore

const { isExpandedFormCommentMode } = storeToRefs(useConfigStore())

const FEEDS = [
  { value: 'fields', labelKey: 'objects.fields', icon: 'fields', event: 'c:row-expand:fields' },
  { value: 'comments', labelKey: 'general.comments', icon: 'messageCircle', event: 'c:row-expand:comment' },
  { value: 'audits', labelKey: 'labels.revisionHistory', icon: 'audit', event: 'c:row-expand:audit' },
] as const

type SidebarFeed = (typeof FEEDS)[number]['value']

const tab = ref<SidebarFeed>(
  props.showFieldsTab && (props.activityInMainPane || !isExpandedFormCommentMode.value || isSqlView.value)
    ? 'fields'
    : 'comments',
)

const isSelectorOpen = ref(false)

const feedOptions = computed(() =>
  FEEDS.filter((feed) => {
    if (feed.value === 'fields') return !!props.showFieldsTab
    // Discussion mode already renders the merged feed in the main pane —
    // offering it here too would put the same comments on screen twice.
    if (props.activityInMainPane || isSqlView.value) return false

    return feed.value === 'comments' || isAuditEnabled.value
  }),
)

const activeLabel = computed(() => t(FEEDS.find((feed) => feed.value === tab.value)?.labelKey ?? 'general.comments'))

/**
 * The bell subscribes to COMMENTS, so it follows the active feed — except in
 * Discussion mode, where the main pane already IS the comment feed.
 */
const showNotificationBell = computed(() => isEeUI && (props.activityInMainPane || tab.value === 'comments'))

function setFeed(value: SidebarFeed) {
  tab.value = value
  isSelectorOpen.value = false
}

watch(tab, (newValue) => {
  if (newValue === 'audits') {
    expandedFormStore.loadAudits()
  }
})

// Options come and go with the host presentor (Fields) and the row's context
// (SQL view, shared base) — never leave the panel on a feed that's gone.
watch(feedOptions, (options) => {
  if (options.length && !options.some((feed) => feed.value === tab.value)) setFeed(options[0].value)
})
</script>

<template>
  <div v-if="feedOptions.length" class="flex flex-col bg-nc-bg-elevated !h-full w-full rounded-br-2xl overflow-hidden">
    <div class="flex-none flex items-center gap-1 px-2 py-1.5 border-b-1 border-nc-border-gray-light">
      <NcDropdown v-if="feedOptions.length > 1" v-model:visible="isSelectorOpen" placement="bottomLeft">
        <NcButton type="text" size="small" data-testid="nc-expanded-form-sidebar-feed-selector">
          <div class="flex items-center gap-1.5 min-w-0 text-bodyDefaultSm font-medium text-nc-content-gray">
            <span class="truncate">{{ activeLabel }}</span>
            <GeneralIcon icon="chevronDown" class="flex-none w-3.5 h-3.5 text-nc-content-gray-muted" />
          </div>
        </NcButton>

        <template #overlay>
          <NcMenu variant="small">
            <NcMenuItem
              v-for="option in feedOptions"
              :key="option.value"
              v-e="[option.event]"
              :data-testid="`nc-expanded-form-sidebar-feed-${option.value}`"
              @click="setFeed(option.value)"
            >
              <div class="flex items-center gap-2 min-w-48">
                <GeneralIcon :icon="option.icon" class="flex-none w-4 h-4 text-nc-content-gray-subtle" />
                <span class="flex-1">{{ $t(option.labelKey) }}</span>
                <GeneralIcon v-if="tab === option.value" icon="check" class="flex-none w-4 h-4 text-nc-content-brand" />
              </div>
            </NcMenuItem>
          </NcMenu>
        </template>
      </NcDropdown>

      <span v-else class="px-2 min-w-0 truncate text-bodyDefaultSm font-medium text-nc-content-gray">{{ activeLabel }}</span>

      <!-- Record bell — per-user comment-notification preference (EE; CE stub
           renders nothing). -->
      <SmartsheetExpandedFormSidebarCommentNotificationBell v-if="showNotificationBell" class="flex-none ml-auto" />
    </div>

    <div class="flex-1 min-h-0 overflow-hidden">
      <SmartsheetExpandedFormPresentorsFieldsMiniColumnsWrapper v-if="tab === 'fields'" :compact-mode="compactMode" />
      <SmartsheetExpandedFormSidebarComments v-else-if="tab === 'comments'" class="h-full" />
      <SmartsheetExpandedFormSidebarAudits v-else-if="tab === 'audits'" class="h-full" />
    </div>
  </div>
</template>
