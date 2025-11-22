<script lang="ts" setup>
import type { DashboardType } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  dashboard: DashboardType
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

const dashboard = toRef(props, 'dashboard')

const { deleteDashboard } = useDashboardStore()

const { $e } = useNuxtApp()

const isLoading = ref(false)

const onDelete = async () => {
  if (!dashboard.value) return

  isLoading.value = true
  try {
    await deleteDashboard(dashboard.value.base_id, dashboard.value.id as string)

    $e('a:dashboard:delete')

    visible.value = false
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <GeneralDeleteModal v-model:visible="visible" :entity-name="$t('labels.dashboard')" :on-delete="onDelete">
    <template #entity-preview>
      <div
        v-if="dashboard"
        class="flex flex-row items-center py-2.25 px-2.5 bg-nc-bg-gray-extralight rounded-lg text-nc-content-gray-subtle"
      >
        <GeneralIcon class="nc-view-icon" icon="dashboards" />
        <div
          class="capitalize text-ellipsis overflow-hidden select-none w-full pl-1.75"
          :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
        >
          {{ dashboard.title }}
        </div>
      </div>
    </template>
  </GeneralDeleteModal>
</template>
