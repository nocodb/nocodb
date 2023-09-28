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
  try {
    isLoading.value = true
    const jobData = await api.dbTable.duplicate(props.table.project_id!, props.table.id!, { options: optionsToExclude.value })
    props.onOk(jobData as any)
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isLoading.value = false
    dialogShow.value = false
  }
}

onKeyStroke('Enter', () => {
  // should only trigger this when our modal is open
  if (dialogShow.value) {
    _duplicate()
  }
})

const isEaster = ref(false)
</script>

<template>
  <GeneralModal
    v-model:visible="dialogShow"
    :class="{ active: dialogShow }"
    centered
    wrap-class-name="nc-modal-table-duplicate"
    :footer="null"
    :closable="false"
    class="!w-[30rem]"
    @keydown.esc="dialogShow = false"
  >
    <div>
      <div class="prose-xl font-bold self-center" @dblclick="isEaster = !isEaster">
        {{ $t('general.duplicate') }} {{ $t('objects.table') }}
      </div>

      <div class="mt-4">{{ $t('msg.warning.duplicateProject') }}</div>

      <div class="prose-md self-center text-gray-500 mt-4">{{ $t('title.advancedSettings') }}</div>

      <a-divider class="!m-0 !p-0 !my-2" />

      <div class="text-xs p-2">
        <a-checkbox v-model:checked="options.includeData">{{ $t('labels.includeData') }}a</a-checkbox>
        <a-checkbox v-model:checked="options.includeViews">{{ $t('labels.includeView') }}</a-checkbox>
        <a-checkbox v-show="isEaster" v-model:checked="options.includeHooks">{{ $t('labels.includeWebhook') }}</a-checkbox>
      </div>
    </div>
    <div class="flex flex-row gap-x-2 mt-2.5 pt-2.5 justify-end">
      <NcButton key="back" type="secondary" @click="dialogShow = false">{{ $t('general.cancel') }}</NcButton>
      <NcButton key="submit" type="primary" :loading="isLoading" @click="_duplicate">{{ $t('general.confirm') }} </NcButton>
    </div>
  </GeneralModal>
</template>
