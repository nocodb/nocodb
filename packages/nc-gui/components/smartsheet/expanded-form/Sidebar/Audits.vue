<script setup lang="ts">
import { type AuditType, PlanLimitTypes, type TableType } from 'nocodb-sdk'
import dayjs from 'dayjs'
import type { IconMapKey } from '#imports'

type TimelineEventKind = 'created' | 'trashed' | 'restored'

type TimelineItem =
  | { type: 'day'; key: string; label: string }
  | { type: 'event'; key: string; audit: AuditType; kind: TimelineEventKind }
  | { type: 'group'; key: string; audits: AuditType[] }

const { user } = useGlobal()

const { agents } = storeToRefs(useAgentStore())

const { t } = useI18n()

const { primaryKey, consolidatedAudits, isAuditLoading, loadMoreAudits, resetAuditPages, hasMoreAudits } =
  useExpandedFormStoreOrThrow()

const { getPlanLimit } = useWorkspace()

const { handleUpgradePlan, isPaymentEnabled, isHigherActivePlan } = useEeConfig()

function showAuditUpgradeModal() {
  handleUpgradePlan({
    limitOrFeature: PlanLimitTypes.LIMIT_RECORD_AUDIT_RETENTION,
    triggerSource: 'record-audit',
  })
}

const auditRetentionLimit = computed(() => {
  const retention = getPlanLimit(PlanLimitTypes.LIMIT_RECORD_AUDIT_RETENTION)

  if (retention === 14) {
    return t('labels.audit.retention.twoWeeks')
  } else if (retention === 60) {
    return t('labels.audit.retention.twoMonths')
  } else if (retention === 180) {
    return t('labels.audit.retention.sixMonths')
  } else if (retention === 365) {
    return t('labels.audit.retention.oneYear')
  }

  return null
})

const auditsWrapperEl = ref<HTMLElement | null>(null)

watch(primaryKey, () => {
  resetAuditPages()
})

function scrollToLastAudit() {
  auditsWrapperEl.value?.scrollBy({
    top: 50000,
    behavior: 'instant',
  })
}

const createdByAudit = (
  comment: AuditType & {
    created_display_name_short?: string
  },
) => {
  if (comment.user === user.value?.email) {
    return t('general.you')
  } else if (comment.created_display_name_short?.trim()) {
    return comment.created_display_name_short || t('labels.sharedSource')
  } else if (comment.user) {
    return comment.user
  } else {
    return t('labels.sharedSource')
  }
}

const shouldSkipAuditsScroll = ref(false)

function initLoadMoreAudits() {
  shouldSkipAuditsScroll.value = true
  loadMoreAudits()

  // Restore focus to the modal container to ensure escape key handling works
  nextTick(() => {
    document.querySelector('.nc-drawer-expanded-form.active > div[tabindex="0"]')?.focus?.()
  })
}

watch(
  consolidatedAudits,
  () => {
    // Loading earlier pages keeps the reader's place; the next change scrolls again.
    if (shouldSkipAuditsScroll.value) {
      shouldSkipAuditsScroll.value = false
      return
    }
    nextTick(() => {
      setTimeout(() => {
        scrollToLastAudit()
      }, 500)
    })
  },
  {
    immediate: true,
  },
)

const meta = inject(MetaInj, ref())

const isSyncedTable = computed(() => !!(meta.value as TableType | undefined)?.synced)

function safeJsonParse(json: string) {
  try {
    return JSON.parse(json)
  } catch (e) {
    return {}
  }
}

// Op types whose audit detail is a per-field change set (DATA_UPDATE family).
const UPDATE_OP_TYPES = ['DATA_UPDATE', 'DATA_BULK_UPDATE', 'DATA_BULK_ALL_UPDATE', 'DATA_CASCADE_UPDATE']

const EVENT_OP_TYPES: Record<string, TimelineEventKind> = {
  DATA_INSERT: 'created',
  DATA_BULK_INSERT: 'created',
  DATA_SOFT_DELETE: 'trashed',
  DATA_BULK_SOFT_DELETE: 'trashed',
  DATA_RESTORE: 'restored',
  DATA_BULK_RESTORE: 'restored',
}

const EVENT_ICONS: Record<TimelineEventKind, IconMapKey> = {
  created: 'ncPlus',
  trashed: 'ncTrash',
  restored: 'ncRotateCcw',
}

// One person's edits within this many minutes share a header.
const GROUP_GAP_MINUTES = 10

// On synced tables, an update that touched ONLY sync bookkeeping fields
// (RemoteSyncedAt, SyncRunId, …) is pure sync noise — drop the whole entry so
// the revision history only surfaces real data changes. Mixed entries still
// render; AuditMiniItem hides their sync-system rows individually.
const visibleAudits = computed(() => {
  if (!isSyncedTable.value) return consolidatedAudits.value

  return consolidatedAudits.value.filter((audit) => {
    if (!UPDATE_OP_TYPES.includes(audit?.op_type)) return true

    const changedKeys = Object.keys(safeJsonParse(audit.details as string)?.data ?? {})
    if (!changedKeys.length) return true

    return changedKeys.some((key) => !isSyncSystemColumnTitle(key))
  })
})

function isV0Audit(audit: AuditType) {
  if (audit.version === 0) {
    return true
  }

  if (['LINK_RECORD', 'UNLINK_RECORD'].includes(audit?.op_sub_type || '') && audit.details?.startsWith('<span')) {
    return true
  }

  return false
}

function dayLabel(at: dayjs.Dayjs) {
  const today = dayjs()
  if (at.isSame(today, 'day')) return t('labels.today')
  if (at.isSame(today.subtract(1, 'day'), 'day')) return t('labels.chatYesterday')
  return at.format(at.isSame(today, 'year') ? 'D MMM' : 'D MMM YYYY')
}

function timeLabel(audit: AuditType) {
  return dayjs(audit.created_at).format('h:mm A')
}

const timeline = computed(() => {
  const items: TimelineItem[] = []
  let lastDay = ''
  let group: Extract<TimelineItem, { type: 'group' }> | undefined

  for (const audit of visibleAudits.value) {
    const at = dayjs(audit.created_at)
    const day = at.format('YYYY-MM-DD')
    if (day !== lastDay) {
      items.push({ type: 'day', key: `day-${day}`, label: dayLabel(at) })
      lastDay = day
      group = undefined
    }

    const kind = EVENT_OP_TYPES[audit.op_type as string]
    if (kind && !isV0Audit(audit)) {
      items.push({ type: 'event', key: audit.id!, audit, kind })
      group = undefined
      continue
    }

    const last = group?.audits[group.audits.length - 1]
    if (group && last && last.user === audit.user && at.diff(dayjs(last.created_at), 'minute') <= GROUP_GAP_MINUTES) {
      group.audits.push(audit)
    } else {
      group = { type: 'group', key: audit.id!, audits: [audit] }
      items.push(group)
    }
  }

  return items
})

const expandedInserts = ref<Record<string, boolean>>({})

function initialValueCount(audit: AuditType) {
  return Object.keys(safeJsonParse(audit.details as string)?.column_meta || {}).length
}

function eventText(kind: TimelineEventKind) {
  if (kind === 'created') return t('activity.createdRecord')
  if (kind === 'trashed') return t('activity.movedRecordToTrash')
  return t('activity.restoredRecordFromTrash')
}

function linkChanges(audit: AuditType) {
  const details = safeJsonParse(audit.details as string)
  return {
    title: details.link_field_title,
    added: details.consolidated_ref_display_values_links ?? [],
    removed: details.consolidated_ref_display_values_unlinks ?? [],
  }
}
</script>

<template>
  <div class="h-full">
    <div v-if="isAuditLoading && consolidatedAudits.length === 0" class="flex flex-col items-center justify-center w-full h-full">
      <GeneralLoader size="xlarge" />
    </div>

    <div v-else ref="auditsWrapperEl" class="flex flex-col h-full nc-scrollbar-thin pb-1">
      <template v-if="visibleAudits.length === 0">
        <div class="flex flex-col text-center justify-center h-full">
          <div class="text-center text-3xl text-nc-content-gray-subtle2">
            <MdiHistory />
          </div>
          <div class="font-bold text-center my-1 text-nc-content-gray-subtle2">{{ $t('msg.info.seeChangesToRecord') }}</div>
          <i18n-t
            v-if="auditRetentionLimit"
            keypath="msg.info.planRevisionHistory"
            tag="div"
            scope="global"
            class="text-center text-nc-content-gray-subtle2"
          >
            <template #limit>
              <span class="font-bold">{{ auditRetentionLimit }}</span>
            </template>
          </i18n-t>
        </div>
      </template>
      <template v-else>
        <div class="mt-auto" />
        <div v-if="auditRetentionLimit && !isHigherActivePlan" class="flex flex-col items-center gap-2 my-2 mx-3">
          <i18n-t
            keypath="msg.info.revisionHistoryUpgrade"
            tag="div"
            scope="global"
            class="text-center text-nc-content-gray-subtle2 text-xs"
          >
            <template #limit>
              <span class="font-bold">{{ auditRetentionLimit }}</span>
            </template>
          </i18n-t>
          <NcButton
            v-if="isPaymentEnabled"
            v-e="['c:audit:retention:upgrade']"
            type="secondary"
            size="xs"
            @click="showAuditUpgradeModal"
          >
            <div class="flex items-center gap-1">
              <GeneralIcon icon="ncArrowUpCircle" class="h-3 w-3" />
              {{ $t('general.upgrade') }}
            </div>
          </NcButton>
        </div>
        <div v-if="hasMoreAudits" class="p-3 text-center">
          <NcButton size="small" type="secondary" class="!font-normal" @click="initLoadMoreAudits()">
            {{ $t('general.loadEarlier') }}
          </NcButton>
        </div>

        <div class="flex flex-col gap-3 px-3 py-2">
          <template v-for="item of timeline" :key="item.key">
            <!-- Day separator -->
            <div
              v-if="item.type === 'day'"
              class="nc-audit-day flex items-center gap-2.5 text-xs font-weight-600 text-nc-content-gray-subtle"
            >
              {{ item.label }}
            </div>

            <!-- Created / trashed / restored -->
            <div v-else-if="item.type === 'event'" :class="`${item.audit.id}`" class="nc-audit-item nc-audit-event">
              <div class="flex items-center gap-2 min-h-6 text-small1 text-nc-content-gray-subtle">
                <span
                  class="flex-none w-6 h-6 rounded-full border-1 border-nc-border-gray-medium bg-nc-bg-gray-light flex items-center justify-center"
                >
                  <GeneralIcon :icon="EVENT_ICONS[item.kind]" class="w-3 h-3 text-nc-content-gray-subtle" />
                </span>
                <span class="min-w-0">
                  <span class="font-weight-600 text-nc-content-gray">{{ createdByAudit(item.audit) }}</span>
                  {{ eventText(item.kind) }}
                  <NcTooltip class="inline text-xs text-nc-content-gray-muted">
                    <template #title>{{ parseStringDateTime(item.audit.created_at) }}</template>
                    {{ timeLabel(item.audit) }}
                  </NcTooltip>
                </span>
              </div>
              <template v-if="item.kind === 'created' && initialValueCount(item.audit)">
                <button
                  type="button"
                  class="nc-audit-link-btn ml-8 mt-1 text-xs font-weight-600 text-nc-content-brand hover:text-nc-content-brand-hover"
                  @click="expandedInserts[item.key] = !expandedInserts[item.key]"
                >
                  {{
                    expandedInserts[item.key]
                      ? $t('labels.audit.hideInitialValues')
                      : $t('labels.audit.showInitialValues', { count: initialValueCount(item.audit) })
                  }}
                </button>
                <div v-if="expandedInserts[item.key]" class="nc-audit-card ml-8 mt-1.5 flex flex-col gap-3">
                  <SmartsheetExpandedFormSidebarAuditMiniItem :audit="item.audit" />
                </div>
              </template>
            </div>

            <!-- One person's run of edits -->
            <div v-else class="nc-audit-item flex flex-col gap-1.5">
              <div class="flex items-center gap-2 h-6 min-w-0">
                <GeneralUserIcon
                  :user="{
                    email: item.audits[0]?.created_by_email || item.audits[0]?.user,
                    display_name: item.audits[0]?.created_display_name,
                    meta: item.audits[0]?.created_by_meta,
                  }"
                  size="medium"
                />
                <div class="truncate text-nc-content-gray font-weight-600 text-small1">
                  {{ createdByAudit(item.audits[0]!) }}
                  <span v-if="auditAgent(item.audits[0]!, agents)" class="font-weight-500 text-nc-content-gray-muted">
                    {{
                      auditAgent(item.audits[0]!, agents)?.title
                        ? $t('labels.agentPersonal.viaAgent', { agent: auditAgent(item.audits[0]!, agents)?.title })
                        : $t('labels.agentPersonal.viaAnAgent')
                    }}
                  </span>
                </div>
                <NcTooltip class="flex-none text-xs text-nc-content-gray-muted">
                  <template #title>{{ parseStringDateTime(item.audits[0]!.created_at) }}</template>
                  {{ timeLabel(item.audits[0]!) }}
                </NcTooltip>
              </div>

              <div class="nc-audit-card ml-8 flex flex-col gap-3">
                <template v-for="audit of item.audits" :key="audit.id">
                  <div v-if="isV0Audit(audit)" :class="`${audit.id}`">
                    <div v-if="audit.details" v-dompurify-html="audit.details" @click="handleDompurifyLinkClick"></div>
                    <div v-else>{{ audit.description }}</div>
                  </div>

                  <div
                    v-else-if="['DATA_LINK', 'DATA_UNLINK'].includes(audit?.op_type)"
                    :class="`${audit.id}`"
                    class="nc-audit-change"
                  >
                    <div
                      class="!text-nc-content-gray-subtle2 uppercase !text-[10px] tracking-wide font-weight-500 nc-audit-mini-item-header truncate"
                    >
                      {{ linkChanges(audit).title }}
                    </div>
                    <div class="mt-1 flex flex-wrap items-center gap-1.5 text-small1">
                      <span v-for="entry of linkChanges(audit).added" :key="`a-${entry.refRowId}`" class="nc-audit-record">
                        <span class="nc-audit-pm nc-audit-pm-plus">+</span>{{ entry.value }}
                      </span>
                      <span
                        v-for="entry of linkChanges(audit).removed"
                        :key="`r-${entry.refRowId}`"
                        class="nc-audit-record nc-audit-record-gone"
                      >
                        <span class="nc-audit-pm nc-audit-pm-minus">−</span><span class="line-through">{{ entry.value }}</span>
                      </span>
                    </div>
                  </div>

                  <template v-else-if="UPDATE_OP_TYPES.includes(audit?.op_type)">
                    <div v-if="audit?.op_type === 'DATA_CASCADE_UPDATE'" class="text-xs text-nc-content-gray-muted -mb-2">
                      {{ $t('labels.dateDependency.cascadeUpdateDescription') }}
                    </div>
                    <SmartsheetExpandedFormSidebarAuditMiniItem :audit="audit" />
                  </template>
                </template>
              </div>
            </div>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
:deep(.red.lighten-4) {
  @apply bg-nc-bg-red-dark rounded-md line-through;
}

:deep(.green.lighten-4) {
  @apply bg-nc-bg-green-dark rounded-md !mr-3;
}

.nc-audit-day {
  &::before,
  &::after {
    content: '';
    @apply flex-1 h-px bg-nc-border-gray-light;
  }
}

.nc-audit-card {
  @apply rounded-lg border-1 border-nc-border-gray-light bg-nc-bg-gray-extralight py-2.5 px-3 min-w-0;
}

.nc-audit-link-btn {
  background: transparent;
  border: 0;
  padding: 0;
  cursor: pointer;
}

.nc-audit-record {
  @apply inline-flex items-center gap-1 px-1.5 rounded-md border-1 border-nc-border-gray-medium bg-nc-bg-default text-nc-content-gray leading-5;
}
.nc-audit-record-gone {
  opacity: 0.55;
}

.nc-audit-pm {
  @apply flex-none text-xs font-bold;
}
.nc-audit-pm-plus {
  @apply text-nc-content-green-dark;
}
.nc-audit-pm-minus {
  @apply text-nc-content-red-dark;
}
</style>
