<script lang="ts" setup>
import { AbuseReportStatus } from 'nocodb-sdk'
import type { AbuseReportBlockCandidate, AbuseReportDetailType } from 'nocodb-sdk'

const props = defineProps<{
  reportId: string
}>()

const emits = defineEmits(['close'])

const { $e } = useNuxtApp()

const { t } = useI18n()

const { copy } = useCopy()

const { showWarningModal } = useNcConfirmModal()

const { fetchReport, updateStatus, disableResource, blockUser, unblockUser } = useAbuseReports()

const isOpen = ref(true)

const report = ref<AbuseReportDetailType | null>(null)

const busyAction = ref<string | null>(null)

const isActive = computed(() => report.value?.status === AbuseReportStatus.OPEN)

async function load() {
  try {
    report.value = await fetchReport(props.reportId)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
    isOpen.value = false
  }
}

async function run(action: string, fn: () => Promise<unknown>, successMsg: string) {
  busyAction.value = action
  try {
    await fn()
    message.success(successMsg)
    await load()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    busyAction.value = null
  }
}

function setStatus(status: AbuseReportStatus) {
  run(status, () => updateStatus(props.reportId, status), t('msg.success.abuseReportUpdated'))
  $e('a:admin:abuse-report:update', { status })
}

function confirmDisable() {
  showWarningModal({
    title: t('title.disablePublicLink'),
    content: t('msg.info.abuseReport.disableConfirm'),
    okText: t('labels.abuseReport.disableLink'),
    showCancelBtn: true,
    okCallback: async () => {
      await run('disable', () => disableResource(props.reportId), t('msg.success.publicLinkDisabled'))
      $e('a:admin:abuse-report:disable', { type: report.value?.resource_type })
    },
  })
}

function confirmBlock(candidate: AbuseReportBlockCandidate) {
  showWarningModal({
    title: t('title.blockUser'),
    content: t('msg.info.abuseReport.blockConfirm', { email: candidate.email }),
    okText: t('activity.blockUser'),
    showCancelBtn: true,
    okCallback: async () => {
      const reason = `Abuse report ${props.reportId}`
      await run(`block:${candidate.id}`, () => blockUser(candidate.id, reason), t('msg.success.userBlocked'))
      $e('a:admin:abuse-report:user:block', { roles: candidate.roles.join(',') })
    },
  })
}

function unblock(candidate: AbuseReportBlockCandidate) {
  run(`block:${candidate.id}`, () => unblockUser(candidate.id), t('msg.success.userUnblocked'))
  $e('a:admin:user:unblock')
}

watch(isOpen, (open) => {
  if (!open) emits('close')
})

onMounted(load)
</script>

<template>
  <NcModal v-model:visible="isOpen" size="md" height="auto" wrap-class-name="nc-admin-abuse-report-detail">
    <div class="flex flex-col gap-5 max-h-[80vh] overflow-y-auto nc-scrollbar-thin" data-testid="nc-admin-abuse-report-detail">
      <div class="flex items-start justify-between gap-3">
        <div class="flex flex-col gap-1 min-w-0">
          <div class="text-base font-bold text-nc-content-gray-emphasis truncate">
            {{ report?.resource_title || $t('labels.abuseReport.reportedItem') }}
          </div>
          <div v-if="report" class="flex items-center gap-2 text-xs text-nc-content-gray-muted">
            <span>{{ $t(`labels.abuseReport.resourceTypes.${report.resource_type}`) }}</span>
            <span v-if="report.workspace_title">· {{ report.workspace_title }}</span>
            <AdminAbuseReportStatus :status="report.status" />
          </div>
        </div>
        <NcButton type="text" size="small" @click="isOpen = false">
          <GeneralIcon icon="close" />
        </NcButton>
      </div>

      <GeneralLoader v-if="!report" size="large" class="self-center my-8" />

      <template v-else>
        <div class="nc-abuse-section">
          <div class="nc-abuse-label">{{ $t('labels.abuseReport.publicLink') }}</div>
          <div class="flex items-center gap-2 min-w-0">
            <span class="truncate text-sm font-mono text-nc-content-gray-subtle">{{ report.public_url }}</span>
            <NcButton size="xsmall" type="text" @click="copy(report.public_url)">
              <GeneralIcon icon="copy" />
            </NcButton>
            <NcBadge
              :color="report.resource_shared ? 'orange' : 'gray'"
              :border="false"
              class="!h-5 text-xs font-semibold px-2 flex-none"
              data-testid="nc-admin-abuse-report-link-state"
            >
              {{ report.resource_shared ? $t('labels.abuseReport.linkLive') : $t('labels.abuseReport.linkDisabled') }}
            </NcBadge>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="nc-abuse-section">
            <div class="nc-abuse-label">{{ $t('labels.abuseReport.reason') }}</div>
            <div class="text-sm">{{ $t(`labels.abuseReport.reasons.${report.reason}`) }}</div>
          </div>
          <div class="nc-abuse-section">
            <div class="nc-abuse-label">{{ $t('labels.abuseReport.received') }}</div>
            <div class="text-sm">{{ timeAgo(report.created_at!) }}</div>
          </div>
          <div class="nc-abuse-section col-span-2">
            <div class="nc-abuse-label">{{ $t('labels.abuseReport.reporter') }}</div>
            <div class="text-sm truncate">{{ report.reporter_name }} · {{ report.reporter_email }}</div>
          </div>
        </div>

        <div class="nc-abuse-section">
          <div class="nc-abuse-label">{{ $t('labels.abuseReport.reportDetails') }}</div>
          <div class="text-sm whitespace-pre-wrap break-words rounded-lg bg-nc-bg-gray-extralight p-3">
            {{ report.description }}
          </div>
        </div>

        <div class="nc-abuse-section">
          <div class="nc-abuse-label">{{ $t('labels.abuseReport.accounts') }}</div>
          <div v-if="!report.candidates.length" class="text-sm text-nc-content-gray-muted">
            {{ $t('msg.info.abuseReport.noAccounts') }}
          </div>
          <div
            v-for="candidate of report.candidates"
            :key="candidate.id"
            class="flex items-center gap-3 py-2 border-b-1 border-nc-border-gray-light last:border-b-0"
            data-testid="nc-admin-abuse-report-candidate"
          >
            <GeneralUserIcon size="base" :user="candidate" class="flex-none" />
            <div class="flex flex-col flex-1 min-w-0">
              <span class="truncate text-sm font-semibold">{{ candidate.display_name || candidate.email }}</span>
              <span class="truncate text-xs text-nc-content-gray-muted">
                {{ candidate.roles.map((role) => $t(`labels.abuseReport.candidateRoles.${role}`)).join(', ') }}
              </span>
            </div>
            <NcBadge v-if="candidate.blocked" color="red" :border="false" class="!h-5 text-xs font-semibold px-2">
              {{ $t('labels.blocked') }}
            </NcBadge>
            <NcTooltip :disabled="!candidate.is_super_admin" :title="$t('msg.info.abuseReport.superAdminNotBlockable')">
              <NcButton
                v-if="candidate.blocked"
                size="small"
                type="secondary"
                :loading="busyAction === `block:${candidate.id}`"
                @click="unblock(candidate)"
              >
                {{ $t('activity.unblockUser') }}
              </NcButton>
              <NcButton
                v-else
                size="small"
                type="danger"
                :disabled="candidate.is_super_admin"
                :loading="busyAction === `block:${candidate.id}`"
                data-testid="nc-admin-abuse-report-block"
                @click="confirmBlock(candidate)"
              >
                {{ $t('activity.blockUser') }}
              </NcButton>
            </NcTooltip>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2 pt-2">
          <NcButton
            type="danger"
            size="small"
            :disabled="!report.resource_shared"
            :loading="busyAction === 'disable'"
            data-testid="nc-admin-abuse-report-disable"
            @click="confirmDisable"
          >
            <div class="flex items-center gap-2">
              <GeneralIcon icon="ncEyeOff" />
              {{ $t('labels.abuseReport.disableLink') }}
            </div>
          </NcButton>

          <div class="flex items-center gap-2">
            <template v-if="isActive">
              <NcButton
                type="secondary"
                size="small"
                :loading="busyAction === AbuseReportStatus.DISMISSED"
                data-testid="nc-admin-abuse-report-dismiss"
                @click="setStatus(AbuseReportStatus.DISMISSED)"
              >
                {{ $t('labels.abuseReport.dismiss') }}
              </NcButton>
              <NcButton
                size="small"
                :loading="busyAction === AbuseReportStatus.RESOLVED"
                data-testid="nc-admin-abuse-report-resolve"
                @click="setStatus(AbuseReportStatus.RESOLVED)"
              >
                {{ $t('labels.abuseReport.markResolved') }}
              </NcButton>
            </template>
            <NcButton
              v-else
              type="secondary"
              size="small"
              :loading="busyAction === AbuseReportStatus.OPEN"
              data-testid="nc-admin-abuse-report-reopen"
              @click="setStatus(AbuseReportStatus.OPEN)"
            >
              {{ $t('labels.abuseReport.reopen') }}
            </NcButton>
          </div>
        </div>
      </template>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.nc-abuse-section {
  @apply flex flex-col gap-1.5 min-w-0;
}

.nc-abuse-label {
  @apply text-xs font-semibold text-nc-content-gray-subtle2 uppercase tracking-wide;
}
</style>
