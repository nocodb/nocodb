<script setup lang="ts">
import type { ColumnType, GalleryType, KanbanType } from 'nocodb-sdk'
import { UITypes, ViewTypes, isVirtualCol } from 'nocodb-sdk'
import Draggable from 'vuedraggable'
import type { SelectProps } from 'ant-design-vue'
import type { CheckboxChangeEvent } from 'ant-design-vue/es/checkbox/interface'
import { active } from 'sortablejs'
import {
  ActiveViewInj,
  FieldsInj,
  IsLockedInj,
  IsPublicInj,
  MetaInj,
  ReloadViewDataHookInj,
  computed,
  iconMap,
  inject,
  ref,
  resolveComponent,
  useMenuCloseOnEsc,
  useNuxtApp,
  useSmartsheetStoreOrThrow,
  useUndoRedo,
  useViewColumns,
  watch,
} from '#imports'

import FieldIcon from '~icons/nc-icons/eye'

const meta = inject(MetaInj, ref())

const activeView = inject(ActiveViewInj, ref())

const reloadDataHook = inject(ReloadViewDataHookInj)!

const reloadViewMetaHook = inject(ReloadViewMetaHookInj, undefined)!

const rootFields = inject(FieldsInj)

const { isMobileMode } = useGlobal()

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
  loadViewColumns,
} = useViewColumns(activeView, meta, () => reloadDataHook.trigger())

const { eventBus } = useSmartsheetStoreOrThrow()

const { addUndo, defineViewScope } = useUndoRedo()

eventBus.on((event) => {
  if (event === SmartsheetStoreEvents.FIELD_RELOAD) {
    loadViewColumns()
  } else if (event === SmartsheetStoreEvents.MAPPED_BY_COLUMN_CHANGE) {
    loadViewColumns()
  }
})

watch(
  sortedAndFilteredFields,
  (v) => {
    if (rootFields) rootFields.value = v || []
  },
  { immediate: true },
)

const numberOfHiddenFields = computed(() => filteredFieldList.value?.filter((field) => !field.show)?.length)

const gridDisplayValueField = computed(() => {
  if (activeView.value?.type !== ViewTypes.GRID) return null
  const pvCol = Object.values(metaColumnById.value)?.find((col) => col?.pv)
  return filteredFieldList.value?.find((field) => field.fk_column_id === pvCol?.id)
})

const onMove = (_event: { moved: { newIndex: number; oldIndex: number } }, undo = false) => {
  // todo : sync with server
  if (!fields.value) return

  if (!undo) {
    addUndo({
      undo: {
        fn: () => {
          if (!fields.value) return
          const temp = fields.value[_event.moved.newIndex]
          fields.value[_event.moved.newIndex] = fields.value[_event.moved.oldIndex]
          fields.value[_event.moved.oldIndex] = temp
          onMove(
            {
              moved: {
                newIndex: _event.moved.oldIndex,
                oldIndex: _event.moved.newIndex,
              },
            },
            true,
          )
        },
        args: [],
      },
      redo: {
        fn: () => {
          if (!fields.value) return
          const temp = fields.value[_event.moved.oldIndex]
          fields.value[_event.moved.oldIndex] = fields.value[_event.moved.newIndex]
          fields.value[_event.moved.newIndex] = temp
          onMove(_event, true)
        },
        args: [],
      },
      scope: defineViewScope({ view: activeView.value }),
    })
  }

  if (fields.value.length < 2) return

  fields.value.forEach((field, index) => {
    if (field.order !== index + 1) {
      field.order = index + 1
      saveOrUpdate(field, index)
    }
  })

  $e('a:fields:reorder')
}

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

const updateCoverImage = async (val?: string | null) => {
  if (
    (activeView.value?.type === ViewTypes.GALLERY || activeView.value?.type === ViewTypes.KANBAN) &&
    activeView.value?.id &&
    activeView.value?.view
  ) {
    if (activeView.value?.type === ViewTypes.GALLERY) {
      await $api.dbView.galleryUpdate(activeView.value?.id, {
        fk_cover_image_col_id: val,
      })
      ;(activeView.value.view as GalleryType).fk_cover_image_col_id = val
    } else if (activeView.value?.type === ViewTypes.KANBAN) {
      await $api.dbView.kanbanUpdate(activeView.value?.id, {
        fk_cover_image_col_id: val,
      })
      ;(activeView.value.view as KanbanType).fk_cover_image_col_id = val
    }
    reloadViewMetaHook?.trigger()
  }
}

const coverImageColumnId = computed({
  get: () => {
    const fk_cover_image_col_id =
      (activeView.value?.type === ViewTypes.GALLERY || activeView.value?.type === ViewTypes.KANBAN) && activeView.value?.view
        ? (activeView.value?.view as GalleryType).fk_cover_image_col_id
        : undefined
    // check if `fk_cover_image_col_id` is in `coverOptions`
    // e.g. in share view, users may not share the cover image column
    if (coverOptions.value?.find((o) => o.value === fk_cover_image_col_id)) return fk_cover_image_col_id
    // set to `No Image`
    return null
  },
  set: async (val) => {
    if (val !== coverImageColumnId.value) {
      addUndo({
        undo: {
          fn: await updateCoverImage,
          args: [coverImageColumnId.value],
        },
        redo: {
          fn: await updateCoverImage,
          args: [val],
        },
        scope: defineViewScope({ view: activeView.value }),
      })

      await updateCoverImage(val)
    }
  },
})

const showAllColumns = computed({
  get: () => {
    return filteredFieldList.value?.every((field) => field.show)
  },
  set: async (val) => {
    if (val) {
      await showAll()
    } else {
      await hideAll()
    }
  },
})

const getIcon = (c: ColumnType) =>
  h(isVirtualCol(c) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: c,
  })

const open = ref(false)

const toggleFieldVisibility = (e: CheckboxChangeEvent, field: any, index: number) => {
  addUndo({
    undo: {
      fn: (v: boolean) => {
        field.show = !v
        saveOrUpdate(field, index)
      },
      args: [e.target.checked],
    },
    redo: {
      fn: (v: boolean) => {
        field.show = v
        saveOrUpdate(field, index)
      },
      args: [e.target.checked],
    },
    scope: defineViewScope({ view: activeView.value }),
  })
  saveOrUpdate(field, index)
}

const toggleSystemFields = (e: CheckboxChangeEvent) => {
  addUndo({
    undo: {
      fn: (v: boolean) => {
        showSystemFields.value = !v
      },
      args: [e.target.checked],
    },
    redo: {
      fn: (v: boolean) => {
        showSystemFields.value = v
      },
      args: [e.target.checked],
    },
    scope: defineViewScope({ view: activeView.value }),
  })
}

const onShowAll = () => {
  addUndo({
    undo: {
      fn: async () => {
        await hideAll()
      },
      args: [],
    },
    redo: {
      fn: async () => {
        await showAll()
      },
      args: [],
    },
    scope: defineViewScope({ view: activeView.value }),
  })
  showAll()
}

const onHideAll = () => {
  addUndo({
    undo: {
      fn: async () => {
        await showAll()
      },
      args: [],
    },
    redo: {
      fn: async () => {
        await hideAll()
      },
      args: [],
    },
    scope: defineViewScope({ view: activeView.value }),
  })
  hideAll()
}

useMenuCloseOnEsc(open)
</script>

<template>
  <a-dropdown v-model:visible="open" :trigger="['click']" overlay-class-name="nc-dropdown-fields-menu">
    <div :class="{ 'nc-active-btn': numberOfHiddenFields }">
      <a-button v-e="['c:fields']" class="nc-fields-menu-btn nc-toolbar-btn" :disabled="isLocked">
        <div class="flex items-center gap-2">
          <GeneralIcon
            v-if="activeView?.type === ViewTypes.KANBAN || activeView?.type === ViewTypes.GALLERY"
            icon="creditCard"
            class="h-4 w-4"
          />
          <GeneralIcon v-else icon="eye" class="h-4 w-4" />

          <!-- Fields -->
          <span v-if="!isMobileMode" class="text-capitalize text-sm font-medium">
            <template v-if="activeView?.type === ViewTypes.KANBAN || activeView?.type === ViewTypes.GALLERY">
              Edit Cards
            </template>
            <template v-else>
              {{ $t('objects.fields') }}
            </template>
          </span>

          <span v-if="numberOfHiddenFields" class="nc-count-badge">{{ numberOfHiddenFields }}</span>
        </div>
      </a-button>
    </div>

    <template #overlay>
      <div
        class="p-6 pr-0 bg-white min-w-96 rounded-2xl nc-table-toolbar-menu border-1 border-gray-50 shadow-lg"
        data-testid="nc-fields-menu"
        @click.stop
      >
        <div class="text-lg font-medium mb-4">
          <template v-if="activeView?.type === ViewTypes.KANBAN || activeView?.type === ViewTypes.GALLERY">
            Edit Cards (Fields)
          </template>
          <template v-else>
            {{ $t('objects.fields') }}
          </template>
        </div>

        <div class="pr-6" @click.stop>
          <a-input v-model:value="filterQuery" :placeholder="$t('placeholder.searchFields')" class="!rounded-lg">
            <template #prefix> <img src="~/assets/nc-icons/search.svg" class="h-3.5 w-3.5 mr-1" /> </template
          ></a-input>
        </div>

        <div
          v-if="!filterQuery && (activeView?.type === ViewTypes.GALLERY || activeView?.type === ViewTypes.KANBAN)"
          class="flex flex-col gap-y-2 pr-6 mt-4"
        >
          <div class="flex text-sm">Select cover image field</div>
          <a-select
            v-model:value="coverImageColumnId"
            class="w-full"
            :options="coverOptions"
            dropdown-class-name="nc-dropdown-cover-image"
            @click.stop
          >
            <template #suffixIcon><GeneralIcon icon="arrowDown" class="text-gray-700" /></template>
          </a-select>
        </div>

        <div
          v-if="!filterQuery"
          class="pl-8 pr-2 mr-6 mt-8 py-2 flex flex-row items-center border-1 rounded-lg mb-2 border-gray-75 bg-gray-50"
        >
          <NcCheckbox v-model:checked="showAllColumns">
            <div class="ml-0.75">All fields</div>
          </NcCheckbox>
        </div>

        <div v-if="!filterQuery" class="pr-6">
          <div class="pt-0.25 w-full bg-gray-50"></div>
        </div>

        <div class="flex flex-col nc-scrollbar-md max-h-[40vh] pt-1 pr-5">
          <div class="nc-fields-list py-1">
            <div v-if="!fields?.filter((el) => el.title.includes(filterQuery)).length" class="px-3 py-2 text-gray-500">Empty</div>
            <Draggable v-model="fields" item-key="id" @change="onMove($event)">
              <template #item="{ element: field, index: index }">
                <div
                  v-if="
                    filteredFieldList
                      .filter((el) => el !== gridDisplayValueField && el.title.includes(filterQuery))
                      .includes(field)
                  "
                  :key="field.id"
                  class="px-2 py-2 flex flex-row items-center border-1 rounded-lg mb-2 border-gray-75"
                  :data-testid="`nc-fields-menu-${field.title}`"
                  @click.stop
                >
                  <component :is="iconMap.drag" class="cursor-move !h-3.75 text-gray-600 mr-1" />
                  <div class="flex flex-row items-center ml-1">
                    <NcCheckbox
                      v-model:checked="field.show"
                      v-e="['a:fields:show-hide']"
                      :disabled="field.isViewEssentialField"
                      @change="toggleFieldVisibility($event, field, index)"
                    >
                      <div class="flex items-center -ml-0.75">
                        <component :is="getIcon(metaColumnById[field.fk_column_id])" />
                        <div>{{ field.title }}</div>
                      </div>
                    </NcCheckbox>
                  </div>

                  <div class="flex-1" />
                </div>
              </template>
              <template v-if="activeView?.type === ViewTypes.GRID" #header>
                <div
                  v-if="gridDisplayValueField && filteredFieldList[0].title.includes(filterQuery)"
                  :key="`pv-${gridDisplayValueField.id}`"
                  class="pl-8 pr-2 py-2 flex flex-row items-center border-1 rounded-lg mb-2 border-gray-75"
                  :data-testid="`nc-fields-menu-${gridDisplayValueField.title}`"
                  @click.stop
                >
                  <NcCheckbox v-e="['a:fields:show-hide']" :disabled="true" :checked="true"> </NcCheckbox>
                  <div class="flex flex-row items-center ml-1.75">
                    <a-tooltip placement="bottom">
                      <template #title>
                        <span class="text-sm">Display Value</span>
                      </template>
                    </a-tooltip>

                    <div class="flex items-center">
                      <component :is="getIcon(metaColumnById[filteredFieldList[0].fk_column_id as string])" />

                      <span>{{ filteredFieldList[0].title }}</span>
                    </div>
                  </div>
                </div>
              </template>
            </Draggable>
            <div v-if="!isPublic && !filterQuery" class="mt-4 p-2 py-1 flex nc-fields-show-system-fields !text-base" @click.stop>
              <NcCheckbox v-model:checked="showSystemFields" @change="toggleSystemFields">
                <span> {{ $t('activity.showSystemFields') }}</span>
              </NcCheckbox>
            </div>
          </div>
        </div>
      </div>
    </template>
  </a-dropdown>
</template>

<style scoped lang="scss">
// :deep(.ant-checkbox-inner) {
//   @apply transform scale-60;
// }

// :deep(.ant-checkbox) {
//   @apply top-auto;
// }
</style>
