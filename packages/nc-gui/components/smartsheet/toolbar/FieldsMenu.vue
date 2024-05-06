<script lang="ts" setup>
import type { CalendarType, ColumnType, GalleryType, KanbanType } from 'nocodb-sdk'
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
  toggleFieldStyles,
  toggleFieldVisibility,
} = useViewColumnsOrThrow()

const { eventBus, isDefaultView } = useSmartsheetStoreOrThrow()

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
  if (activeView.value?.type !== ViewTypes.GRID && activeView.value?.type !== ViewTypes.CALENDAR) return null
  const pvCol = Object.values(metaColumnById.value)?.find((col) => col?.pv)
  return filteredFieldList.value?.find((field) => field.fk_column_id === pvCol?.id)
})

const onMove = async (_event: { moved: { newIndex: number; oldIndex: number } }, undo = false) => {
  try {
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
          await saveOrUpdate(field, index, true, !!isDefaultView.value)
        }
      }),
    )

    await loadViewColumns()
    await reloadViewDataHook?.trigger({
      shouldShowLoading: false,
    })

    $e('a:fields:reorder')
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
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
    (activeView.value?.type === ViewTypes.GALLERY ||
      activeView.value?.type === ViewTypes.KANBAN ||
      activeView.value?.type === ViewTypes.CALENDAR) &&
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
    } else if (activeView.value?.type === ViewTypes.CALENDAR) {
      await $api.dbView.calendarUpdate(activeView.value?.id, {
        fk_cover_image_col_id: val,
      })
      ;(activeView.value.view as CalendarType).fk_cover_image_col_id = val
    }

    await reloadViewMetaHook?.trigger()

    // Load data only if the view column is hidden to fetch cover image column data in records.
    if (val && !fields.value?.find((f) => f.fk_column_id === val)?.show) {
      await reloadViewDataHook?.trigger({
        shouldShowLoading: false,
      })
    }
  }
}

const coverImageColumnId = computed({
  get: () => {
    const fk_cover_image_col_id =
      (activeView.value?.type === ViewTypes.GALLERY ||
        activeView.value?.type === ViewTypes.KANBAN ||
        activeView.value?.type === ViewTypes.CALENDAR) &&
      activeView.value?.view
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

const isDragging = ref<boolean>(false)

const fieldsMenuSearchRef = ref<HTMLInputElement>()

watch(open, (value) => {
  if (!value) return

  filterQuery.value = ''
  setTimeout(() => {
    fieldsMenuSearchRef.value?.focus()
  }, 100)
})

useMenuCloseOnEsc(open)
</script>

<template>
  <NcDropdown
    v-model:visible="open"
    :trigger="['click']"
    class="!xs:hidden"
    overlay-class-name="nc-dropdown-fields-menu nc-toolbar-dropdown"
  >
    <div :class="{ 'nc-active-btn': numberOfHiddenFields }">
      <a-button v-e="['c:fields']" :disabled="isLocked" class="nc-fields-menu-btn nc-toolbar-btn">
        <div class="flex items-center gap-2">
          <GeneralIcon
            v-if="activeView?.type === ViewTypes.KANBAN || activeView?.type === ViewTypes.GALLERY"
            class="h-4 w-4"
            icon="creditCard"
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
      <div
        class="pt-2 bg-white w-full min-w-72 max-w-80 rounded-lg nc-table-toolbar-menu"
        data-testid="nc-fields-menu"
        @click.stop
      >
        <div
          v-if="!isPublic && (activeView?.type === ViewTypes.GALLERY || activeView?.type === ViewTypes.KANBAN)"
          class="flex flex-col gap-y-2 px-2 mb-6"
        >
          <div class="flex text-sm select-none">Select cover image field</div>
          <a-select
            v-model:value="coverImageColumnId"
            :options="coverOptions"
            class="w-full"
            dropdown-class-name="nc-dropdown-cover-image !rounded-lg"
            @click.stop
          >
            <template #suffixIcon><GeneralIcon class="text-gray-700" icon="arrowDown" /></template>
          </a-select>
        </div>

        <div class="px-2" @click.stop>
          <a-input
            ref="fieldsMenuSearchRef"
            v-model:value="filterQuery"
            :placeholder="$t('placeholder.searchFields')"
            class="nc-toolbar-dropdown-search-field-input"
          >
            <template #prefix> <GeneralIcon icon="search" class="nc-search-icon h-3.5 w-3.5 mr-1" /> </template
          ></a-input>
        </div>

        <div class="flex flex-col mt-2 pb-2 nc-scrollbar-thin max-h-[47vh] px-2">
          <div class="nc-fields-list">
            <div
              v-if="!fields?.filter((el) => el.title.toLowerCase().includes(filterQuery.toLowerCase())).length"
              class="px-2 py-6 text-gray-500 flex flex-col items-center gap-6 text-center"
            >
              <img
                src="~assets/img/placeholder/no-search-result-found.png"
                class="!w-[164px] flex-none"
                alt="No search results found"
              />

              {{ $t('title.noResultsMatchedYourSearch') }}
            </div>
            <Draggable
              v-model="fields"
              item-key="id"
              ghost-class="nc-fields-menu-items-ghost"
              @change="onMove($event)"
              @start="isDragging = true"
              @end="isDragging = false"
            >
              <template #item="{ element: field }">
                <div
                  v-if="
                    filteredFieldList
                      .filter((el) => (activeView.type !== ViewTypes.CALENDAR ? el !== gridDisplayValueField : true))
                      .includes(field)
                  "
                  :key="field.id"
                  :data-testid="`nc-fields-menu-${field.title}`"
                  class="pl-2 flex flex-row items-center rounded-md hover:bg-gray-100"
                  @click.stop
                >
                  <component :is="iconMap.drag" class="cursor-move !h-3.75 text-gray-600 mr-1" />
                  <div
                    v-e="['a:fields:show-hide']"
                    class="flex flex-row items-center w-full truncate cursor-pointer ml-1 py-[5px] pr-2"
                    @click="
                      () => {
                        field.show = !field.show
                        toggleFieldVisibility(field.show, field)
                      }
                    "
                  >
                    <component :is="getIcon(metaColumnById[field.fk_column_id])" class="!w-3.5 !h-3.5 !text-gray-500" />
                    <NcTooltip class="flex-1 pl-1 pr-2 truncate" show-on-truncate-only :disabled="isDragging">
                      <template #title>
                        {{ field.title }}
                      </template>
                      <template #default>{{ field.title }}</template>
                    </NcTooltip>
                    <div v-if="activeView.type === ViewTypes.CALENDAR" class="flex mr-2">
                      <NcButton
                        :class="{
                          '!bg-gray-800 !text-white': field.bold,
                        }"
                        class="!rounded-r-none !w-5 !h-5"
                        size="xxsmall"
                        type="secondary"
                        @click.stop="toggleFieldStyles(field, 'bold', !field.bold)"
                      >
                        <component :is="iconMap.bold" class="!w-3 !h-3" />
                      </NcButton>
                      <NcButton
                        :class="{
                          '!bg-gray-800 !text-white': field.italic,
                        }"
                        class="!rounded-x-none !border-x-0 !w-5 !h-5"
                        size="xxsmall"
                        type="secondary"
                        @click.stop="toggleFieldStyles(field, 'italic', !field.italic)"
                      >
                        <component :is="iconMap.italic" class="!w-3 !h-3" />
                      </NcButton>
                      <NcButton
                        :class="{
                          '!bg-gray-800 !text-white': field.underline,
                        }"
                        class="!rounded-l-none !w-5 !h-5"
                        size="xxsmall"
                        type="secondary"
                        @click.stop="toggleFieldStyles(field, 'underline', !field.underline)"
                      >
                        <component :is="iconMap.underline" class="!w-3 !h-3" />
                      </NcButton>
                    </div>
                    <NcSwitch
                      :checked="field.show"
                      :disabled="field.isViewEssentialField"
                      size="xsmall"
                      @change="$t('a:fields:show-hide')"
                    />
                  </div>

                  <div class="flex-1" />
                </div>
              </template>
            </Draggable>
          </div>
        </div>
        <div v-if="!filterQuery" class="flex px-2 gap-2 py-2">
          <NcButton class="nc-fields-show-all-fields" size="small" type="ghost" @click="showAllColumns = !showAllColumns">
            {{ showAllColumns ? 'Hide all' : 'Show all' }} fields
          </NcButton>
          <NcButton
            v-if="!isPublic"
            class="nc-fields-show-system-fields"
            size="small"
            type="ghost"
            @click="showSystemField = !showSystemField"
          >
            {{ showSystemField ? 'Hide system fields' : 'Show system fields' }}
          </NcButton>
        </div>
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss" scoped>
:deep(.xxsmall) {
  @apply !min-w-0;
}

.nc-fields-menu-items-ghost {
  @apply bg-gray-50;
}

.nc-fields-show-all-fields,
.nc-fields-show-system-fields {
  @apply !text-xs !w-1/2 !text-gray-500 !border-none bg-gray-100 hover:(!text-gray-600 bg-gray-200);
}
</style>
