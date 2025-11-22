<script setup lang="ts">
import { SyncCategory } from 'nocodb-sdk'
import { useSyncFormOrThrow } from '../useSyncForm'

const props = defineProps<{
  modelValue: string
}>()

const modelValue = useVModel(props, 'modelValue')

const { t } = useI18n()

const { syncConfigForm } = useSyncFormOrThrow()

const tabs = computed(() => {
  const baseTabs = [
    {
      title: t('general.general'),
      value: 'general',
    },
    {
      title: t('labels.sources'),
      value: 'sources',
    },
  ]

  // Only show Schema Mapping tab for CUSTOM category
  if (syncConfigForm.value.sync_category === SyncCategory.CUSTOM) {
    baseTabs.push({
      title: t('labels.schema'),
      value: 'schema',
    })
  }

  return baseTabs
})
</script>

<template>
  <div class="p-1 rounded-lg flex bg-nc-bg-gray-medium items-center">
    <div
      v-for="item in tabs"
      :key="item.value"
      :class="{
        'bg-nc-bg-default text-captionBold font-semibold text-nc-content-gray-emphasis': modelValue === item.value,
        'text-nc-content-gray-subtle2 text-caption': modelValue !== item.value,
      }"
      class="px-2 py-1 cursor-pointer rounded-[6px] cursor-pointer"
      @click="modelValue = item.value"
    >
      {{ item.title }}
    </div>
  </div>
</template>
