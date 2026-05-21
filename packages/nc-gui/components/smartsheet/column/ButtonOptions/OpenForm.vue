<script setup lang="ts">
import { ViewTypes } from 'nocodb-sdk'
import type { ViewType } from 'nocodb-sdk'
import { NcListViewSelector } from '#components'

const props = defineProps<{
  modelValue: any
}>()

const emits = defineEmits<{
  'update:modelValue': (value: any) => void
}>()

const vModel = useVModel(props, 'modelValue', emits)

const { t } = useI18n()

const meta = inject(MetaInj, ref())

const viewSelectorRef = ref<InstanceType<typeof NcListViewSelector>>()

const filterFormViews = (view: ViewType) => view.type === ViewTypes.FORM

const selectedFormViewId = computed({
  get: () => vModel.value.fk_form_view_id,
  set: (val: string | undefined) => {
    vModel.value.fk_form_view_id = val
  },
})

const isSelectedViewShared = computed(() => {
  return !!viewSelectorRef.value?.selectedView?.uuid
})
</script>

<template>
  <div>
    <NcListViewSelector
      ref="viewSelectorRef"
      v-model:value="selectedFormViewId"
      :table-id="meta?.id"
      :filter-view="filterFormViews"
      force-fetch-views
    >
      <template #label>
        {{ t('labels.formView') }}
      </template>
    </NcListViewSelector>
    <div v-if="selectedFormViewId && !isSelectedViewShared" class="mt-2 text-xs text-nc-content-orange-dark">
      {{ $t('msg.info.formNotSharedEditNote') }}
    </div>
  </div>
</template>
