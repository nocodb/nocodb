<script lang="ts" setup>
import type { StringOrNullType } from 'nocodb-sdk'

interface Props {
  /**
   * The unique identifier for the custom URL.
   */
  id?: StringOrNullType
  /**
   * The base URL of the dashboard.
   */
  dashboardUrl: string
  /**
   * The search query to be appended to the custom URL.
   */
  searchQuery?: string
  /**
   * The tooltip text to be displayed.
   */
  tooltip?: string
  /**
   * A function to copy the custom URL to the clipboard.
   *
   * @param customUrl The custom URL to be copied.
   * @returns A promise that resolves to a boolean indicating whether the copy operation was successful.
   */
  copyCustomUrl: (customUrl: string) => Promise<boolean>
}

defineProps<Props>()
</script>

<template>
  <div class="flex flex-col justify-between mt-1 py-2 px-3 bg-gray-50 rounded-md">
    <div class="flex flex-row items-center justify-between">
      <div class="flex text-black items-center gap-1">
        {{ $t('title.customUrl') }}
      </div>
      <NcTooltip>
        <template #title>
          <div class="text-center">
            {{ $t('msg.info.thisFeatureIsOnlyAvailableInEnterpriseEdition') }}
          </div>
        </template>
        <a-switch
          :checked="false"
          disabled
          class="share-custom-url-toggle !mt-0.25"
          data-testid="share-custom-url-toggle"
          size="small"
        />
      </NcTooltip>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
