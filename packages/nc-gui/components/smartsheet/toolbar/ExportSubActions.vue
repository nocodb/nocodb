<script setup lang="ts">
import { ExportTypes, ViewTypes } from 'nocodb-sdk'

const { $api, $poller } = useNuxtApp()

const { appInfo } = useGlobal()

const { t } = useI18n()

const meta = inject(MetaInj)!

const isPublicView = inject(IsPublicInj, ref(false))

const selectedView = inject(ActiveViewInj)!

// Get the shared view password from the injected value
const sharedViewPassword = inject(SharedViewPasswordInj, ref<string | null>(null))

const urlHelper = (url: string) => {
  if (url.startsWith('http')) {
    return url
  } else {
    return `${appInfo.value.ncSiteUrl || BASE_FALLBACK_URL}/${url}`
  }
}

const handleDownload = async (url: string) => {
  url = urlHelper(url)

  const isExpired = await isLinkExpired(url)

  if (isExpired) {
    navigateTo(url, {
      open: navigateToBlankTargetOpenOption,
    })
    return
  }

  const link = document.createElement('a')
  link.href = url
  link.style.display = 'none' // Hide the link

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const activeExportType = ref<ExportTypes | null>(null)

/**
 * This component is lazy loaded and might be initialized after the view is effectively unmounted.
 * In that case, the store is not available anymore, so we need to provide a fallback to avoid a crash.
 */
const { sorts, nestedFilters, isLocked } = useSmartsheetStore() || {
  sorts: ref([]),
  nestedFilters: ref([]),
  isLocked: ref(false),
}

// In a shared view the top-bar Download button lives outside the grid's smartsheet store tree
// (it has its own provider via ExportWithProvider), so `nestedFilters`/`sorts` above stay empty.
// The grid mirrors the viewer-applied filters/sorts to these global refs, so read from them for
// public views to ensure the export honours the currently configured filters and sorts.
const { activeNestedFilters, activeSorts } = storeToRefs(useViewsStore())

const effectiveSorts = computed(() => (isPublicView.value ? activeSorts.value : sorts.value))

const effectiveNestedFilters = computed(() => (isPublicView.value ? activeNestedFilters.value : nestedFilters.value))

const { isUIAllowed } = useRoles()

// `.ics` export only makes sense for calendar views, which carry the date range
// fields used to build the calendar events.
const isCalendarView = computed(() => selectedView.value?.type === ViewTypes.CALENDAR)

const exportFile = async (exportType: ExportTypes) => {
  try {
    if (activeExportType.value || !selectedView.value.id) return

    activeExportType.value = exportType

    const filenameTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

    // Construct extra params for sort and filter
    // Construct extra params for sort and filter
    const extraParams = {
      ...(!isUIAllowed('sortSync') || isLocked.value
        ? {
            sortArrJson: stringifyFilterOrSortArr(effectiveSorts.value.filter((s: any) => !s.id)),
          }
        : {}),
      ...(!isUIAllowed('filterSync') || isLocked.value
        ? {
            filterArrJson: stringifyFilterOrSortArr(effectiveNestedFilters.value.filter((f: any) => !f.id)),
          }
        : {}),
    }

    const options = { filenameTimeZone, ...extraParams }

    let jobData: { id: string }

    if (isPublicView.value) {
      if (!selectedView.value.uuid) return

      // Pass the password in the params object
      const params = {
        headers: {
          'xc-password': sharedViewPassword.value || '',
        },
      }

      jobData = await $api.public.exportData(selectedView.value.uuid, exportType, options, params)
    } else {
      jobData = await $api.internal.postOperation(
        meta.value!.fk_workspace_id!,
        meta.value!.base_id!,
        {
          operation: 'dataExport',
          viewId: selectedView.value.id as string,
        },
        {
          options,
          exportAs: exportType,
        },
      )
    }

    message.toast(t('msg.info.preparingForDownload', { type: exportType.toUpperCase() }))

    $poller.subscribe(
      { id: jobData.id },
      async (data: {
        id: string
        status?: string
        data?: {
          error?: {
            message: string
          }
          message?: string
          result?: any
        }
      }) => {
        if (data.status !== 'close') {
          if (data.status === JobStatus.COMPLETED) {
            // Export completed successfully
            message.toast(t('msg.success.dataExported'))

            handleDownload(data.data?.result?.url)

            activeExportType.value = null
          } else if (data.status === JobStatus.FAILED) {
            message.error(t('msg.error.dataExportFailed'))

            activeExportType.value = null
          }
        }
      },
    )
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
    activeExportType.value = null
  }
}
</script>

<template>
  <NcMenuItemLabel>
    {{ $t('labels.downloadData') }}
  </NcMenuItemLabel>

  <NcMenuItem v-e="['a:download:csv']" @click.stop="exportFile(ExportTypes.CSV)">
    <div class="flex flex-row items-center nc-base-menu-item !py-0 children:flex-none">
      <GeneralLoader v-if="activeExportType === ExportTypes.CSV" size="regular" />
      <GeneralIcon v-else icon="ncFileTypeCsvSmall" class="w-4" />
      <!-- Download as CSV -->
      CSV
    </div>
  </NcMenuItem>

  <NcMenuItem v-e="['a:download:json']" @click.stop="exportFile(ExportTypes.JSON)">
    <div class="flex flex-row items-center nc-base-menu-item !py-0 children:flex-none">
      <GeneralLoader v-if="activeExportType === ExportTypes.JSON" size="regular" />
      <GeneralIcon v-else icon="ncFileTypeJson" class="w-4" />
      <!-- Download as JSON -->
      JSON
    </div>
  </NcMenuItem>

  <NcMenuItem v-e="['a:download:excel']" @click.stop="exportFile(ExportTypes.EXCEL)">
    <div class="flex flex-row items-center nc-base-menu-item !py-0 children:flex-none">
      <GeneralLoader v-if="activeExportType === ExportTypes.EXCEL" size="regular" />
      <GeneralIcon v-else icon="ncFileTypeExcel" class="w-4" />
      <!-- Download as Excel -->
      {{ $t('labels.excel') }}
    </div>
  </NcMenuItem>

  <NcMenuItem
    v-if="isCalendarView"
    v-e="['a:download:ics']"
    data-testid="nc-export-ics"
    @click.stop="exportFile(ExportTypes.ICS)"
  >
    <div class="flex flex-row items-center nc-base-menu-item !py-0 children:flex-none">
      <GeneralLoader v-if="activeExportType === ExportTypes.ICS" size="regular" />
      <GeneralIcon v-else icon="calendar" class="w-4" />
      <!-- Download as iCalendar (.ics) -->
      {{ $t('labels.icsCalendar') }}
    </div>
  </NcMenuItem>
</template>
