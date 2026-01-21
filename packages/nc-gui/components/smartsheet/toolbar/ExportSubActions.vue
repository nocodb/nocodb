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

const isExporting = ref(false)

const { sorts, nestedFilters, isLocked } = useSmartsheetStoreOrThrow()
const { isUIAllowed } = useRoles()

const exportFile = async (exportType: ExportTypes) => {
  try {
    if (isExporting.value || !selectedView.value.id) return

    isExporting.value = true

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

    message.info('Preparing CSV for download...')

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
            message.info('Successfully exported data!')

            handleDownload(data.data?.result?.url)

            isExporting.value = false
          } else if (data.status === JobStatus.FAILED) {
            message.error('Failed to export data!')

            isExporting.value = false
          }
        }
      },
    )
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
    isExporting.value = false
  }
}
</script>

<template>
  <NcMenuItemLabel>
    {{ $t('labels.downloadData') }}
  </NcMenuItemLabel>

  <NcMenuItem v-e="['a:download:csv']" @click.stop="exportFile(ExportTypes.CSV)">
    <div class="flex flex-row items-center nc-base-menu-item !py-0 children:flex-none">
      <GeneralLoader v-if="isExporting" size="regular" />
      <component :is="iconMap.ncFileTypeCsvSmall" v-else class="w-4" />
      <!-- Download as CSV -->
      CSV
    </div>
  </NcMenuItem>
</template>
