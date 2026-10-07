<script setup lang="ts">
import { ViewLockType } from 'nocodb-sdk'
import type { ViewType } from 'nocodb-sdk'
import PgSection from '../../-components/PgSection.vue'
import PgDemo from '../../-components/PgDemo.vue'
import { JobStatus } from '#imports'

const { isLoading } = useGlobal()

type ProgressStatus = JobStatus | 'progress' | 'warning'

const progressRef = ref<{ pushProgress: (..._args: [string, ProgressStatus]) => void }>()

const loaderSizes = ['small', 'medium', 'regular', 'large', 'xlarge'] as const

const lockedViews = [
  {
    id: 'v1',
    title: 'Locked',
    type: 3,
    lock_type: ViewLockType.Locked,
    meta: { lockedViewDescription: 'Locked for the Q3 audit' },
  },
  { id: 'v2', title: 'Personal', type: 3, lock_type: ViewLockType.Personal },
  { id: 'v3', title: 'Collaborative', type: 3, lock_type: ViewLockType.Collaborative },
] as ViewType[]

const sampleLog: Array<[string, ProgressStatus]> = [
  ['Preparing import of 3 tables…', 'progress'],
  ['Creating table "Customers"', 'progress'],
  ['Inserted 1,240 records into "Customers"', 'progress'],
  ['WARNING: Column "Notes" truncated to 10,000 chars', 'progress'],
  ['Creating table "Orders"', 'progress'],
  ['Failed to resolve link "Orders → Invoices"', JobStatus.FAILED],
  ['Import completed with 1 error', JobStatus.COMPLETED],
]

function replayLog() {
  sampleLog.forEach(([msg, status], i) => setTimeout(() => progressRef.value?.pushProgress(msg, status), i * 250))
}

onMounted(replayLog)
</script>

<template>
  <PgSection id="loaders" title="Loaders" source="GeneralLoader · GeneralSpinner · GeneralApiLoader">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <PgDemo label="Loader" hint="all sizes + numeric">
        <div class="flex items-end gap-5 text-nc-content-brand">
          <NcTooltip v-for="s in loaderSizes" :key="s" :title="s" :arrow="false">
            <GeneralLoader :size="s" />
          </NcTooltip>
          <NcTooltip title="size=40" :arrow="false">
            <GeneralLoader :size="40" />
          </NcTooltip>
        </div>
      </PgDemo>
      <PgDemo label="Spinner" hint="stroke prop">
        <div class="flex items-end gap-5">
          <GeneralSpinner class="w-4 h-4" />
          <GeneralSpinner class="w-6 h-6" stroke="var(--nc-content-brand)" />
          <GeneralSpinner class="w-8 h-8" stroke="var(--nc-content-red-medium)" />
        </div>
      </PgDemo>
      <PgDemo label="ApiLoader" hint="driven by useGlobal().isLoading">
        <div class="flex items-center gap-3">
          <div>
            <NcSwitch v-model:checked="isLoading" size="small">
              <span class="text-caption text-nc-content-gray select-none">isLoading</span>
            </NcSwitch>
          </div>
          <!-- sits bare on the smartsheet topbar -->
          <GeneralApiLoader />
        </div>
      </PgDemo>
    </div>
  </PgSection>

  <PgSection
    id="progress"
    title="Progress panel"
    source="GeneralProgressPanel"
    description="Job log used by imports and duplicates."
  >
    <PgDemo>
      <template #actions>
        <NcButton size="xsmall" type="text" @click="replayLog">Replay</NcButton>
      </template>
      <div class="h-56">
        <GeneralProgressPanel ref="progressRef" class="h-full" />
      </div>
    </PgDemo>
  </PgSection>

  <PgSection id="locked-view" title="Locked view footer" source="GeneralLockedViewFooter">
    <PgDemo stage="canvas" hint="flush at the bottom of a toolbar menu (filter, group, fields)">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
        <div
          v-for="v in lockedViews"
          :key="v.id"
          class="rounded-lg border-1 border-nc-border-gray-medium shadow-lg bg-nc-bg-default overflow-hidden"
        >
          <div class="px-4 py-3 text-caption text-nc-content-gray-muted">No filters in this view</div>
          <GeneralLockedViewFooter :view="v" />
        </div>
      </div>
    </PgDemo>
  </PgSection>

  <PgSection
    id="alerts"
    title="System banners"
    source="GeneralMaintenanceAlert · GeneralReleaseInfo"
    description="Data-driven: these render only when the server reports a maintenance window or a newer release, so an empty card is expected."
  >
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <PgDemo label="MaintenanceAlert">
        <GeneralMaintenanceAlert />
      </PgDemo>
      <PgDemo label="ReleaseInfo">
        <GeneralReleaseInfo />
      </PgDemo>
    </div>
  </PgSection>

  <PgSection id="page-not-found" title="Page does not exist" source="GeneralPageDoesNotExist">
    <PgDemo :padded="false">
      <div class="h-[480px] overflow-hidden relative">
        <GeneralPageDoesNotExist class="!h-full !min-h-0" />
      </div>
    </PgDemo>
  </PgSection>
</template>
