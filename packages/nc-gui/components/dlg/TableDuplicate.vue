<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'
import { useVModel } from '#imports'

const props = defineProps<{
  modelValue: boolean
  table: TableType
  onOk: (jobData: { name: string; id: string }) => Promise<void>
}>()

const emit = defineEmits(['update:modelValue'])

const { api } = useApi()

const dialogShow = useVModel(props, 'modelValue', emit)

const options = ref({
  includeData: true,
  includeViews: true,
  includeHooks: true,
})

const optionsToExclude = computed(() => {
  const { includeData, includeViews, includeHooks } = options.value
  return {
    excludeData: !includeData,
    excludeViews: !includeViews,
    excludeHooks: !includeHooks,
  }
})

const isLoading = ref(false)

const _duplicate = async () => {
  isLoading.value = true
  try {
    const jobData = await api.dbTable.duplicate(props.table.project_id!, props.table.id!, { options: optionsToExclude.value })
    props.onOk(jobData as any)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
  isLoading.value = false
  dialogShow.value = false
}

const isEaster = ref(false)
</script>

<template>
  <a-modal
    v-model:visible="dialogShow"
    :class="{ active: dialogShow }"
    centered
    wrap-class-name="nc-modal-table-duplicate"
    :footer="null"
    :closable="false"
    @keydown.esc="dialogShow = false"
  >
    <div>
      <div class="text-base font-medium self-center mb-4" @dblclick="isEaster = !isEaster">
        {{ $t('general.duplicate') }} {{ table.title }}
      </div>

      <div class="flex flex-col gap-y-2">
        <div class="flex flex-row gap-x-2 items-center">
          <a-switch v-model:checked="options.includeData" />
          Include Data
        </div>
        <div class="flex flex-row gap-x-2 items-center">
          <a-switch v-model:checked="options.includeViews" />
          Include Views
        </div>
        <a-checkbox v-show="isEaster" v-model:checked="options.includeHooks">Include hooks</a-checkbox>
      </div>
    </div>
    <div class="flex flex-row justify-end gap-x-2 mt-8">
      <a-button key="back" size="middle" class="!rounded-md" @click="dialogShow = false">{{ $t('general.cancel') }}</a-button>

      <a-button key="submit" size="middle" type="primary" class="!rounded-md" :loading="isLoading" @click="_duplicate"
        >{{ $t('general.duplicate') }}
      </a-button>
    </div>
  </a-modal>
</template>

<style scoped lang="scss"></style>
