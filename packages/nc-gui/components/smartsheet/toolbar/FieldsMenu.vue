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
  computed,
  iconMap,
  inject,
  ref,
  resolveComponent,
  useMenuCloseOnEsc,
  useNuxtApp,
  useSmartsheetStoreOrThrow,
  useUndoRedo,
  useViewColumnsOrThrow,
  watch,
} from '#imports'

const activeView = inject(ActiveViewInj, ref())

const reloadViewMetaHook = inject(ReloadViewMetaHookInj, undefined)!

const reloadViewDataHook = inject(ReloadViewDataHookInj, undefined)!

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
  toggleFieldVisibility,
} = useViewColumnsOrThrow()

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

const onMove = async (_event: { moved: { newIndex: number; oldIndex: number } }, undo = false) => {
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

  await Promise.all(
    fields.value.map(async (field, index) => {
      if (field.order !== index + 1) {
        field.order = index + 1
        await saveOrUpdate(field, index, true)
      }
    }),
  )

  await loadViewColumns()
  reloadViewDataHook?.trigger()

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

const showAllColumns = computed({
  get: () => {
    return filteredFieldList.value?.every((field) => field.show)
  },
  set: async (val) => {
    if (val) {
      await onShowAll()
    } else {
      await onHideAll()
    }
  },
})

const getIcon = (c: ColumnType) =>
  h(isVirtualCol(c) ? resolveComponent('SmartsheetHeaderVirtualCellIcon') : resolveComponent('SmartsheetHeaderCellIcon'), {
    columnMeta: c,
  })

const open = ref(false)

const showSystemField = computed({
  get: () => {
    return showSystemFields.value
  },
  set: (val) => {
    addUndo({
      undo: {
        fn: (v: boolean) => {
          showSystemFields.value = !v
        },
        args: [val],
      },
      redo: {
        fn: (v: boolean) => {
          showSystemFields.value = v
        },
        args: [val],
      },
      scope: defineViewScope({ view: activeView.value }),
    })
    showSystemFields.value = val
  },
})

useMenuCloseOnEsc(open)
</script>

<template>
  <NcDropdown
    v-model:visible="open"
    :trigger="['click']"
    overlay-class-name="nc-dropdown-fields-menu nc-toolbar-dropdown"
    class="!xs:hidden"
  >
    <div :class="{ 'nc-active-btn': numberOfHiddenFields }">
      <a-button v-e="['c:fields']" class="nc-fields-menu-btn nc-toolbar-btn" :disabled="isLocked">
        <div class="flex items-center gap-2">
          <GeneralIcon
            v-if="activeView?.type === ViewTypes.KANBAN || activeView?.type === ViewTypes.GALLERY"
            icon="creditCard"
            class="h-4 w-4"
          />
          <component :is="iconMap.fields" v-else class="h-4 w-4" />

          <!-- Fields -->
          <span v-if="!isMobileMode" class="text-capitalize text-sm font-medium">
            <template v-if="activeView?.type === ViewTypes.KANBAN || activeView?.type === ViewTypes.GALLERY">
              {{ $t('title.editCards') }}
            </template>
            <template v-else>
              {{ $t('objects.fields') }}
            </template>
          </span>
          <span v-if="numberOfHiddenFields" class="bg-brand-50 text-brand-500 py-1 px-2 text-md rounded-md">
            {{ numberOfHiddenFields }}
          </span>
        </div>
      </a-button>
    </div>

    <template #overlay>
      <div class="p-4 pr-0 bg-white w-90 rounded-2xl nc-table-toolbar-menu" data-testid="nc-fields-menu" @click.stop>
        <div
          v-if="!filterQuery && !isPublic && (activeView?.type === ViewTypes.GALLERY || activeView?.type === ViewTypes.KANBAN)"
          class="flex flex-col gap-y-2 pr-4 mb-6"
        >
          <div class="flex text-sm select-none">Select cover image field</div>
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

        <div class="pr-4" @click.stop>
          <a-input v-model:value="filterQuery" :placeholder="$t('placeholder.searchFields')" class="!rounded-lg">
            <template #prefix> <img src="~/assets/nc-icons/search.svg" class="h-3.5 w-3.5 mr-1" /> </template
          ></a-input>
        </div>

        <div v-if="!filterQuery" class="pr-4">
          <div class="pt-0.25 w-full bg-gray-50"></div>
        </div>

        <div class="flex flex-col my-1.5 nc-scrollbar-md max-h-[47.5vh] pr-3">
          <div class="nc-fields-list">
            <div
              v-if="!fields?.filter((el) => el.title.toLowerCase().includes(filterQuery.toLowerCase())).length"
              class="px-0.5 py-2 text-gray-500"
            >
              {{ $t('title.noFieldsFound') }}
            </div>
            <Draggable v-model="fields" item-key="id" @change="onMove($event)">
              <template #item="{ element: field }">
                <div
                  v-if="
                    filteredFieldList
                      .filter((el) => el !== gridDisplayValueField && el.title.toLowerCase().includes(filterQuery.toLowerCase()))
                      .includes(field)
                  "
                  :key="field.id"
                  class="px-2 py-2 flex flex-row items-center first:border-t-1 border-b-1 border-x-1 first:rounded-t-lg last:rounded-b-lg border-gray-200"
                  :data-testid="`nc-fields-menu-${field.title}`"
                  @click.stop
                >
                  <component :is="iconMap.drag" class="cursor-move !h-3.75 text-gray-600 mr-1" />
                  <div
                    v-e="['a:fields:show-hide']"
                    class="flex flex-row items-center justify-between w-full cursor-pointer ml-1"
                    @click="
                      () => {
                        field.show = !field.show
                        toggleFieldVisibility(field.show, field)
                      }
                    "
                  >
                    <div class="flex items-center -ml-0.75">
                      <component :is="getIcon(metaColumnById[field.fk_column_id])" />
                      <NcTooltip :disabled="field.title.length < 30">
                        <template #title>
                          {{ field.title }}
                        </template>
                        <span class="mx-0.65 break-all line-clamp-1">{{ field.title }}</span>
                      </NcTooltip>
                    </div>

                    <NcSwitch v-e="['a:fields:show-hide']" :checked="field.show" :disabled="field.isViewEssentialField" />
                  </div>

                  <div class="flex-1" />
                </div>
              </template>
              <template v-if="activeView?.type === ViewTypes.GRID" #header>
                <div
                  v-if="gridDisplayValueField && filteredFieldList[0].title.toLowerCase().includes(filterQuery.toLowerCase())"
                  :key="`pv-${gridDisplayValueField.id}`"
                  class="pl-7.5 pr-2.1 py-2 flex flex-row items-center border-1 border-gray-200"
                  :class="{
                    'rounded-t-lg': filteredFieldList.length > 1,
                    'rounded-lg': filteredFieldList.length === 1,
                  }"
                  :data-testid="`nc-fields-menu-${gridDisplayValueField.title}`"
                  @click.stop
                >
                  <div class="flex flex-row items-center justify-between w-full">
                    <div class="flex items">
                      <a-tooltip placement="bottom">
                        <template #title>
                          <span class="text-sm">$t('title.displayValue') </span>
                        </template>
                      </a-tooltip>

                      <div class="flex items-center">
                        <component :is="getIcon(metaColumnById[filteredFieldList[0].fk_column_id as string])" />

                        <span>{{ filteredFieldList[0].title }}</span>
                      </div>
                    </div>
                    <NcSwitch v-e="['a:fields:show-hide']" :checked="true" :disabled="true" />
                  </div>
                </div>
              </template>
            </Draggable>
          </div>
        </div>
        <div class="flex pr-4 mt-1 gap-2">
          <NcButton
            v-if="!filterQuery"
            type="ghost"
            size="sm"
            class="nc-fields-show-all-fields !text-gray-500 !w-1/2"
            @click="showAllColumns = !showAllColumns"
          >
            {{ showAllColumns ? $t('title.hideAll') : $t('general.showAll') }} {{ $t('objects.fields').toLowerCase() }}
          </NcButton>
          <NcButton
            v-if="!isPublic && !filterQuery"
            type="ghost"
            size="sm"
            class="nc-fields-show-system-fields !text-gray-500 !w-1/2"
            @click="showSystemField = !showSystemField"
          >
            {{ showSystemField ? $t('title.hideSystemFields') : $t('activity.showSystemFields') }}
          </NcButton>
        </div>
      </div>
    </template>
  </NcDropdown>
</template>

<style scoped lang="scss">
// :deep(.ant-checkbox-inner) {
//   @apply transform scale-60;
// }

// :deep(.ant-checkbox) {
//   @apply top-auto;
// }
</style>
