<script setup lang="ts">
import { ExportTypes } from 'nocodb-sdk'

const { $api, $poller } = useNuxtApp()

const { appInfo } = useGlobal()

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
const { isUIAllowed } = useRoles()

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
            sortArrJson: stringifyFilterOrSortArr(sorts.value.filter((s: any) => !s.id)),
          }
        : {}),
      ...(!isUIAllowed('filterSync') || isLocked.value
        ? {
            filterArrJson: stringifyFilterOrSortArr(nestedFilters.value.filter((f: any) => !f.id)),
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

    message.toast(`Preparing ${exportType.toUpperCase()} for download...`)

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
            message.toast('Successfully exported data!')

            handleDownload(data.data?.result?.url)

            activeExportType.value = null
          } else if (data.status === JobStatus.FAILED) {
            message.error('Failed to export data!')

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
      <component :is="iconMap.ncFileTypeCsvSmall" v-else class="w-4" />
      <!-- Download as CSV -->
      CSV
    </div>
  </NcMenuItem>

  <NcMenuItem v-e="['a:download:json']" @click.stop="exportFile(ExportTypes.JSON)">
    <div class="flex flex-row items-center nc-base-menu-item !py-0 children:flex-none">
      <GeneralLoader v-if="activeExportType === ExportTypes.JSON" size="regular" />
      <svg 
        v-else 
        xmlns="http://www.w3.org/2000/svg" 
        width="16" 
        height="16" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="#0b48c1" 
        stroke-width="2" 
        stroke-linecap="round" 
        stroke-linejoin="round" 
        class="lucide lucide-file-braces-icon lucide-file-braces w-4"
      >
        <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/>
        <path d="M14 2v5a1 1 0 0 0 1 1h5"/>
        <path d="M10 12a1 1 0 0 0-1 1v1a1 1 0 0 1-1 1 1 1 0 0 1 1 1v1a1 1 0 0 0 1 1"/>
        <path d="M14 18a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1 1 1 0 0 1-1-1v-1a1 1 0 0 0-1-1"/>
      </svg>
      <!-- Download as JSON -->
      JSON
    </div>
  </NcMenuItem>
  <NcMenuItem v-e="['a:download:excel']" @click.stop="exportFile(ExportTypes.EXCEL)">
    <div class="flex flex-row items-center nc-base-menu-item !py-0 children:flex-none">
      <GeneralLoader v-if="activeExportType === ExportTypes.EXCEL" size="regular" />
      <component :is="iconMap.ncFileTypeExcel" v-else class="w-4" />
      <!-- Download as Excel -->
      Excel
    </div>
  </NcMenuItem>
</template>
