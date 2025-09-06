<script setup lang="ts">
import GroupedSettings from '~/components/smartsheet/dashboard/widgets/common/GroupedSettings.vue'
import { isIframeUrlAllowed } from '~/components/smartsheet/dashboard/widgets/iframe/utils'

const emit = defineEmits<{
  'update:url': any
}>()

const { appInfo } = useGlobal()

const { selectedWidget } = storeToRefs(useWidgetStore())

const inputEl = ref(null)

const url = ref(selectedWidget.value?.config?.url || '')

const debouncedUrlUpdate = useDebounceFn(() => {
  emit('update:url', {
    url: url.value,
  })
}, 500)

watch(url, () => {
  debouncedUrlUpdate()
})
</script>

<template>
  <GroupedSettings title="Config">
    <div
      :class="{
        'ant-form-item-has-error': !isIframeUrlAllowed(url, appInfo.iframeWhitelistDomains),
      }"
      class="flex flex-col gap-2"
    >
      <label class="text-nc-content-gray-emphasis font-medium">URL</label>
      <label class="text-nc-content-gray-subtle2 text-bodySm">
        Important: Only embed URLs from sources you control or completely trust.
      </label>

      <a-textarea
        ref="inputEl"
        v-model:value="url"
        :rows="4"
        class="nc-input-sm nc-input-text-area widget-content-input nc-input-shadow px-3 !text-nc-content-gray"
        placeholder="https://example.com"
        size="small"
      />
    </div>
  </GroupedSettings>
</template>

<style scoped lang="scss"></style>
