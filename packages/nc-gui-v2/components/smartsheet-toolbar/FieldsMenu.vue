<script setup lang="ts">
import type { TableType } from 'nocodb-sdk'
import type { ComputedRef } from 'vue'
import { computed, inject } from 'vue'
import Draggable from 'vuedraggable'
import { ActiveViewInj, FieldsInj, IsLockedInj, MetaInj, ReloadViewDataHookInj } from '~/context'
import useViewColumns from '~/composables/useViewColumns'
import MdiMenuDownIcon from '~icons/mdi/menu-down'
import MdiEyeIcon from '~icons/mdi/eye-off-outline'
import MdiDragIcon from '~icons/mdi/drag'

const { fieldsOrder, coverImageField, modelValue } = defineProps<{
  coverImageField?: string
  fieldsOrder?: string[]
  modelValue?: Record<string, boolean>
}>()

const meta = inject(MetaInj)
const activeView = inject(ActiveViewInj)
const reloadDataHook = inject(ReloadViewDataHookInj)
const isLocked = inject(IsLockedInj)
const rootFields = inject(FieldsInj)

const isAnyFieldHidden = computed(() => {
  return false
  // todo: implement
  // return meta?.fields?.some(field => field.hidden)
})

const { $e } = useNuxtApp()

const {
  showSystemFields,
  sortedAndFilteredFields,
  fields,
  loadViewColumns,
  filteredFieldList,
  filterQuery,
  showAll,
  hideAll,
  saveOrUpdate,
  sortedFields,
} = useViewColumns(activeView, meta as ComputedRef<TableType>, false, () => reloadDataHook?.trigger())

watch(
  () => activeView?.value?.id,
  async (newVal, oldVal) => {
    if (newVal !== oldVal && meta?.value) {
      await loadViewColumns()
    }
  },
  { immediate: true },
)
watch(
  () => sortedAndFilteredFields.value,
  (v) => {
    if (rootFields) rootFields.value = v || []
  },
  { immediate: true },
)

const onMove = (event) => {
  // todo : sync with server
  // if (!sortedFields?.value) return
  // if (sortedFields?.value.length - 1 === event.moved.newIndex) {
  //   sortedFields.value[event.moved.newIndex].order = sortedFields.value[event.moved.newIndex - 1].order + 1
  // } else if (event.moved.newIndex === 0) {
  //   sortedFields.value[event.moved.newIndex].order = sortedFields.value[1].order / 2
  // } else {
  //   sortedFields.value[event.moved.newIndex].order =
  //     (sortedFields?.value[event.moved.newIndex - 1].order + sortedFields?.value[event.moved.newIndex + 1].order) / 2
  //   // );
  // }
  // saveOrUpdate(sortedFields[event.moved.newIndex], event.moved.newIndex);
  $e('a:fields:reorder')
}
</script>

<template>
  <a-dropdown :trigger="['click']">
    <v-badge :value="isAnyFieldHidden" color="primary" dot overlap>
      <a-button v-t="['c:fields']" class="nc-fields-menu-btn nc-toolbar-btn" :disabled="isLocked" size="small">
        <div class="flex align-center gap-1">
          <!--          <v-icon small class="mr-1" color="#777"> mdi-eye-off-outline </v-icon> -->
          <MdiEyeIcon class="text-grey"></MdiEyeIcon>
          <!-- Fields -->
          <span class="text-sm text-capitalize nc-fields-menu-btn">{{ $t('objects.fields') }}</span>
          <MdiMenuDownIcon class="text-grey"></MdiMenuDownIcon>
        </div>
      </a-button>
    </v-badge>

    <template #overlay>
      <div class="pt-0 min-w-[280px] bg-white shadow" @click.stop>
        <div class="nc-fields-list py-1">
          <Draggable :list="sortedFields" @change="onMove($event)">
            <template #item="{ element: field }">
              <div :key="field.id" class="px-2 py-1 flex" @click.stop>
                <a-checkbox v-model:checked="field.show" class="flex-shrink" @change="saveOrUpdate(field, i)">
                  <span class="text-xs">{{ field.title }}</span>
                </a-checkbox>
                <div class="flex-1" />
                <MdiDragIcon class="cursor-move" />
              </div>
            </template>
          </Draggable>
        </div>
        <v-divider class="my-2" />

        <div class="p-2 py-1 flex" @click.stop>
          <a-checkbox v-model:checked="showSystemFields">
            <span class="text-xs"> {{ $t('activity.showSystemFields') }}</span>
          </a-checkbox>
        </div>
        <div class="p-2 flex gap-2" @click.stop>
          <a-button size="small" class="text-gray-500 text-sm text-capitalize" @click.stop="showAll">
            <!-- Show All -->
            {{ $t('general.showAll') }}
          </a-button>
          <a-button size="small" class="text-gray-500 text-sm text-capitalize" @click.stop="hideAll">
            <!-- Hide All -->
            {{ $t('general.hideAll') }}
          </a-button>
        </div>
      </div>
    </template>
  </a-dropdown>
</template>

<style scoped lang="scss">
:deep(.ant-checkbox-input) {
  transform: scale(0.7);
}
</style>
