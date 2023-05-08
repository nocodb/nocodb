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
    const jobData = await api.dbTable.duplicate(props.table.project_id!, props.table.id!, optionsToExclude.value)
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
    width="max(30vw, 600px)"
    centered
    wrap-class-name="nc-modal-table-duplicate"
    @keydown.esc="dialogShow = false"
  >
    <template #footer>
      <a-button key="back" size="large" @click="dialogShow = false">{{ $t('general.cancel') }}</a-button>

      <a-button key="submit" size="large" type="primary" :loading="isLoading" @click="_duplicate"
        >{{ $t('general.confirm') }}
      </a-button>
    </template>

    <div class="pl-10 pr-10 pt-5">
      <div class="prose-xl font-bold self-center my-4" @dblclick="isEaster = !isEaster">{{ $t('general.duplicate') }}</div>

      <div class="mb-2">Are you sure you want to duplicate the `{{ table.title }}` table?</div>

      <div class="prose-md self-center text-gray-500 mt-4">{{ $t('title.advancedSettings') }}</div>

      <a-divider class="!m-0 !p-0 !my-2" />

      <div class="text-xs p-2">
        <a-checkbox v-model:checked="options.includeData">Include data</a-checkbox>
        <a-checkbox v-model:checked="options.includeViews">Include views</a-checkbox>
        <a-checkbox v-show="isEaster" v-model:checked="options.includeHooks">Include hooks</a-checkbox>
      </div>
    </div>
  </a-modal>
</template>

<style scoped lang="scss"></style>
