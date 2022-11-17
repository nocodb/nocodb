<script setup lang="ts">
import type { ColumnType, GalleryType, KanbanType } from 'nocodb-sdk'
import { UITypes, ViewTypes, isVirtualCol } from 'nocodb-sdk'
import Draggable from 'vuedraggable'
import type { SelectProps } from 'ant-design-vue'
import {
  ActiveViewInj,
  FieldsInj,
  IsLockedInj,
  IsPublicInj,
  MetaInj,
  ReloadViewDataHookInj,
  computed,
  inject,
  ref,
  resolveComponent,
  useNuxtApp,
  useViewColumns,
  watch,
} from '#imports'

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const reloadDataHook = inject(ReloadViewDataHookInj)!

const reloadViewMetaHook = inject(ReloadViewMetaHookInj)!

const rootFields = inject(FieldsInj)

const isLocked = inject(IsLockedInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const { $api, $e } = useNuxtApp()

const {
  showSystemFields,
  sortedAndFilteredFields,
  fields,
  filteredFieldList,
  filterQuery,
  showAll,
  hideAll,
  saveOrUpdate,
  metaColumnById,
} = useViewColumns(activeView, meta, () => reloadDataHook.trigger())

watch(
  sortedAndFilteredFields,
  (v) => {
    if (rootFields) rootFields.value = v || []
  },
  { immediate: true },
)

const isAnyFieldHidden = computed(() => filteredFieldList.value?.some((field) => !field.show))

const onMove = (_event: { moved: { newIndex: number } }) => {
  // todo : sync with server
  if (!fields.value) return

  if (fields.value.length < 2) return

  fields.value.forEach((field, index) => {
    if (field.order !== index + 1) {
      field.order = index + 1
      saveOrUpdate(field, index)
    }
  })

  $e('a:fields:reorder')
}

const coverImageColumnId = computed({
  get: () =>
    (activeView.value?.type === ViewTypes.GALLERY || activeView.value?.type === ViewTypes.KANBAN) && activeView.value?.view
      ? (activeView.value?.view as GalleryType).fk_cover_image_col_id
      : undefined,
  set: async (val) => {
    if (
      (activeView.value?.type === ViewTypes.GALLERY || activeView.value?.type === ViewTypes.KANBAN) &&
      activeView.value?.id &&
      activeView.value?.view
    ) {
      if (activeView.value?.type === ViewTypes.GALLERY) {
        await $api.dbView.galleryUpdate(activeView.value?.id, {
          ...activeView.value?.view,
          fk_cover_image_col_id: val,
        })
        ;(activeView.value.view as GalleryType).fk_cover_image_col_id = val
      } else if (activeView.value?.type === ViewTypes.KANBAN) {
        await $api.dbView.kanbanUpdate(activeView.value?.id, {
          ...activeView.value?.view,
          fk_cover_image_col_id: val,
        })
        ;(activeView.value.view as KanbanType).fk_cover_image_col_id = val
      }
      reloadViewMetaHook.trigger()
    }
  },
})

const coverOptions = computed<SelectProps['options']>(() => {
  const filterFields =
    fields.value
      ?.filter((el) => el.fk_column_id && metaColumnById.value[el.fk_column_id].uidt === UITypes.Attachment)
      .map((field) => {
        return {
          value: field.fk_column_id,
          label: field.title,
        }
      }) ?? []
  return [{ value: null, label: 'No Image' }, ...filterFields]
})

const getIcon = (c: ColumnType) =>
  h(isVirtualCol(c) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: c,
  })
</script>

<template>
  <a-dropdown :trigger="['click']" overlay-class-name="nc-dropdown-fields-menu">
    <div :class="{ 'nc-badge nc-active-btn': isAnyFieldHidden }">
      <a-button v-e="['c:fields']" class="nc-fields-menu-btn nc-toolbar-btn" :disabled="isLocked">
        <div class="flex items-center gap-1">
          <MdiEyeOffOutline />

          <!-- Fields -->
          <span class="text-capitalize !text-sm font-weight-normal">{{ $t('objects.fields') }}</span>

          <MdiMenuDown class="text-grey" />
        </div>
      </a-button>
    </div>

    <template #overlay>
      <div
        class="p-3 min-w-[280px] bg-gray-50 shadow-lg nc-table-toolbar-menu max-h-[max(80vh,500px)] overflow-auto !border"
        data-testid="nc-fields-menu"
        @click.stop
      >
        <a-card
          v-if="activeView.type === ViewTypes.GALLERY || activeView.type === ViewTypes.KANBAN"
          size="small"
          title="Cover image"
        >
          <a-select
            v-model:value="coverImageColumnId"
            class="w-full"
            :options="coverOptions"
            dropdown-class-name="nc-dropdown-cover-image"
            @click.stop
          />
        </a-card>

        <div class="p-1" @click.stop>
          <a-input v-model:value="filterQuery" size="small" :placeholder="$t('placeholder.searchFields')" />
        </div>

        <div class="nc-fields-list py-1">
          <Draggable v-model="fields" item-key="id" @change="onMove($event)">
            <template #item="{ element: field, index: index }">
              <div
                v-show="filteredFieldList.includes(field)"
                :key="field.id"
                class="px-2 py-1 flex items-center"
                :data-testid="`nc-fields-menu-${field.title}`"
                @click.stop
              >
                <a-checkbox
                  v-model:checked="field.show"
                  v-e="['a:fields:show-hide']"
                  class="shrink"
                  @change="saveOrUpdate(field, index)"
                >
                  <div class="flex items-center">
                    <component :is="getIcon(metaColumnById[field.fk_column_id])" />

                    <span>{{ field.title }}</span>
                  </div>
                </a-checkbox>

                <div class="flex-1" />

                <MdiDrag class="cursor-move" />
              </div>
            </template>
          </Draggable>
        </div>

        <a-divider class="!my-2" />

        <div v-if="!isPublic" class="p-2 py-1 flex nc-fields-show-system-fields" @click.stop>
          <a-checkbox v-model:checked="showSystemFields" class="!items-center">
            <span class="text-xs"> {{ $t('activity.showSystemFields') }}</span>
          </a-checkbox>
        </div>

        <div class="p-2 flex gap-2" @click.stop>
          <a-button size="small" class="!text-xs text-gray-500 text-capitalize" @click.stop="showAll()">
            <!-- Show All -->
            {{ $t('general.showAll') }}
          </a-button>

          <a-button size="small" class="!text-xs text-gray-500 text-capitalize" @click.stop="hideAll()">
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

:deep(.ant-checkbox) {
  @apply top-auto;
}
</style>
