<script lang="ts" setup>
import { PlanLimitTypes } from 'nocodb-sdk'
import { type GroupEmits, type StatefulGroupProps } from './types'

const props = defineProps<StatefulGroupProps>()
const emits = defineEmits<GroupEmits>()
const { getMeta } = useMetas()

const meta = inject(MetaInj, ref())

const columns = computedAsync(async () => {
  if (!meta.value) {
    return []
  }
  return await composeColumnsForFilter({
    rootMeta: meta.value,
    getMeta: (metaIdOrTitle: string) => getMeta(metaIdOrTitle),
  })
})

const { getPlanLimit } = useWorkspace()
const filtersCount = computed(() => {
  return getFilterCount(props.modelValue)
})
</script>

<template>
  <SmartsheetToolbarFilterGroup
    v-bind="props"
    :index="0"
    :nested-level="0"
    :columns="columns"
    :disabled="disabled"
    :is-locked-view="isLockedView"
    :is-logical-op-change-allowed="false"
    :action-btn-type="actionBtnType"
    :web-hook="webHook"
    :link="link"
    :is-form="isForm"
    :is-public="isPublic"
    :filter-per-view-limit="getPlanLimit(PlanLimitTypes.LIMIT_FILTER_PER_VIEW)"
    :disable-add-new-filter="disableAddNewFilter"
    :filters-count="filtersCount"
    :query-filter="queryFilter"
    @change="emits('change', $event)"
    @row-change="emits('row-change', $event)"
  >
    <template #root-header>
      <div>Hello</div>
    </template>
  </SmartsheetToolbarFilterGroup>
</template>
