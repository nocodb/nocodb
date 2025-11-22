<script setup lang="ts">
import type { DashboardType } from 'nocodb-sdk'

const props = defineProps<{
  modelValue: boolean
  dashboard: DashboardType
  extra: any
}>()

const emit = defineEmits(['update:modelValue'])

const dialogShow = useVModel(props, 'modelValue', emit)

const { duplicateDashboard } = useDashboardStore()

const isLoading = ref(false)

const duplicate = async () => {
  try {
    isLoading.value = true

    await duplicateDashboard(props.dashboard.base_id!, props.dashboard.id!, props.extra, () => {})

    dialogShow.value = false
  } catch (error) {
    console.error('Duplicate failed:', error)
  } finally {
    isLoading.value = false
  }
}

onKeyStroke('Enter', () => {
  if (dialogShow.value) {
    duplicate()
  }
})

defineExpose({
  duplicate,
})
</script>

<template>
  <GeneralModal
    v-model:visible="dialogShow"
    :class="{ active: dialogShow }"
    :mask-closable="!isLoading"
    :keyboard="!isLoading"
    centered
    :mask-style="{
      'background-color': 'rgba(0, 0, 0, 0.08)',
    }"
    wrap-class-name="nc-modal-dashboard-duplicate"
    :footer="null"
    class="!w-[30rem]"
    @keydown.esc="dialogShow = false"
  >
    <div>
      <div class="text-base text-nc-content-gray-emphasis leading-6 font-bold self-center">
        {{ $t('general.duplicate') }} {{ $t('objects.dashboard') }}
      </div>
    </div>

    <div
      v-if="dashboard"
      class="flex flex-row items-center py-2.25 px-2.5 bg-nc-bg-gray-extralight mt-4 rounded-lg text-nc-content-gray-subtle"
    >
      <GeneralIcon class="nc-view-icon" icon="dashboards" />
      <div
        class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1.75"
        :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
      >
        {{ dashboard.title }}
      </div>
    </div>
    <div class="flex flex-row gap-x-2 mt-5 justify-end">
      <NcButton v-if="!isLoading" key="back" type="secondary" size="small" @click="dialogShow = false">
        {{ $t('general.cancel') }}
      </NcButton>
      <NcButton key="submit" type="primary" size="small" :loading="isLoading" @click="duplicate"> Duplicate </NcButton>
    </div>
  </GeneralModal>
</template>
