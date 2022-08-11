<script setup lang="ts">
import Draggable from 'vuedraggable'
import { ActiveViewInj, FieldsInj, IsLockedInj, MetaInj, ReloadViewDataHookInj } from '~/context'
import { computed, inject, useNuxtApp, useViewColumns, watch } from '#imports'

const meta = inject(MetaInj)!
const activeView = inject(ActiveViewInj)!
const reloadDataHook = inject(ReloadViewDataHookInj)!
const rootFields = inject(FieldsInj)
const isLocked = inject(IsLockedInj)

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
} = useViewColumns(activeView, meta, false, () => reloadDataHook.trigger())

watch(
  () => (activeView.value as any)?.id,
  async (newVal, oldVal) => {
    if (newVal !== oldVal && meta.value) {
      await loadViewColumns()
    }
  },
  { immediate: true },
)

watch(
  sortedAndFilteredFields,
  (v) => {
    if (rootFields) rootFields.value = v || []
  },
  { immediate: true },
)

const isAnyFieldHidden = computed(() => fields.value?.some((field) => !(!showSystemFields && field.system) && !field.show))

const onMove = (event: { moved: { newIndex: number } }) => {
  // todo : sync with server
  if (!fields.value) return

  if (fields.value.length < 2) return

  if (fields.value.length - 1 === event.moved.newIndex) {
    fields.value[event.moved.newIndex].order = (fields.value[event.moved.newIndex - 1].order || 1) + 1
  } else if (event.moved.newIndex === 0) {
    fields.value[event.moved.newIndex].order = (fields.value[1].order || 1) / 2
  } else {
    fields.value[event.moved.newIndex].order =
      ((fields.value[event.moved.newIndex - 1].order || 1) + (fields.value[event.moved.newIndex + 1].order || 1)) / 2
  }

  saveOrUpdate(fields.value[event.moved.newIndex], event.moved.newIndex)

  $e('a:fields:reorder')
}
</script>

<template>
  <a-dropdown :trigger="['click']">
    <div :class="{ 'nc-badge nc-active-btn': isAnyFieldHidden }">
      <a-button v-t="['c:fields']" class="nc-fields-menu-btn nc-toolbar-btn" :disabled="isLocked">
        <div class="flex align-center gap-1">
          <MdiEyeOffOutline class="text-grey" />

          <!-- Fields -->
          <span class="text-capitalize !text-sm font-weight-regular">{{ $t('objects.fields') }}</span>

          <MdiMenuDown class="text-grey" />
        </div>
      </a-button>
    </div>
    <template #overlay>
      <div class="p-3 min-w-[280px] bg-gray-50 shadow-lg nc-table-toolbar-menu max-h-[max(80vh,500px)] overflow-auto" @click.stop>
        <div class="p-1" @click.stop>
          <a-input v-model:value="filterQuery" size="small" :placeholder="$t('placeholder.searchFields')" />
        </div>
        <div class="nc-fields-list py-1">
          <Draggable :list="fields" item-key="id" @change="onMove($event)">
            <template #item="{ element: field }">
              <div v-show="filteredFieldList.includes(field)" :key="field.id" class="px-2 py-1 flex" @click.stop>
                <a-checkbox v-model:checked="field.show" class="flex-shrink" @change="saveOrUpdate(field, i)">
                  <span class="">{{ field.title }}</span>
                </a-checkbox>
                <div class="flex-1" />
                <MdiDrag class="cursor-move" />
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
          <a-button size="small" class="!text-xs text-gray-500 text-capitalize" @click.stop="showAll">
            <!-- Show All -->
            {{ $t('general.showAll') }}
          </a-button>
          <a-button size="small" class="!text-xs text-gray-500 text-capitalize" @click.stop="hideAll">
            <!-- Hide All -->
            {{ $t('general.hideAll') }}
          </a-button>
        </div>
      </div>
    </template>
  </a-dropdown>
</template>

<style scoped lang="scss">
:deep(.ant-checkbox-inner) {
  @apply transform scale-60;
}
:deep(::placeholder) {
  //@apply !text-xs;
}
</style>
