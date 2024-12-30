<script lang="ts" setup>
import type { CalendarType, ColumnType, GalleryType, KanbanType, LookupType } from 'nocodb-sdk'
import { UITypes, ViewTypes, isVirtualCol } from 'nocodb-sdk'
import Draggable from 'vuedraggable'

import type { SelectProps } from 'ant-design-vue'

const activeView = inject(ActiveViewInj, ref())

const meta = inject(MetaInj, ref())

const reloadViewMetaHook = inject(ReloadViewMetaHookInj, undefined)!

const reloadViewDataHook = inject(ReloadViewDataHookInj, undefined)!

const { isMobileMode } = useGlobal()

const isLocked = inject(IsLockedInj, ref(false))

const isPublic = inject(IsPublicInj, ref(false))

const isToolbarIconMode = inject(
  IsToolbarIconMode,
  computed(() => false),
)

const { $api, $e } = useNuxtApp()

const { t } = useI18n()

const { metas, getMeta } = useMetas()

const {
  showSystemFields,
  fields,
  filteredFieldList,
  numberOfHiddenFields,
  filterQuery,
  showAll,
  hideAll,
  saveOrUpdate,
  metaColumnById,
  loadViewColumns,
  toggleFieldStyles,
  toggleFieldVisibility,
  isLocalMode,
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

    $e('a:fields:reorder')
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const coverOptions = ref<SelectProps['options']>([])

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
      (activeView.value?.type === ViewTypes.GALLERY || activeView.value?.type === ViewTypes.KANBAN) && activeView.value?.view
        ? (activeView.value?.view as GalleryType | KanbanType).fk_cover_image_col_id
        : undefined

    // check if `fk_cover_image_col_id` is in `coverOptions`
    // e.g. in share view, users may not share the cover image column
    if (coverOptions.value?.find((o) => o.value === fk_cover_image_col_id)) return fk_cover_image_col_id
    // set to `No Image` if fk_cover_image_col_id is null else undefiend (This will help to change value to no image for user)
    return fk_cover_image_col_id === null ? null : undefined
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

const updateCoverImageObjectFit = async (val: string) => {
  if (
    ![ViewTypes.GALLERY, ViewTypes.KANBAN].includes(activeView.value?.type as ViewTypes) ||
    !activeView.value?.id ||
    !activeView.value?.view
  ) {
    return
  }

  if (activeView.value?.type === ViewTypes.GALLERY) {
    const payload = {
      ...parseProp((activeView.value?.view as GalleryType)?.meta),
      fk_cover_image_object_fit: val,
    }
    await $api.dbView.galleryUpdate(activeView.value?.id, {
      meta: payload,
    })
    ;(activeView.value.view as GalleryType).meta = payload
  } else if (activeView.value?.type === ViewTypes.KANBAN) {
    const payload = {
      ...parseProp((activeView.value?.view as KanbanType)?.meta),
      fk_cover_image_object_fit: val,
    }
    await $api.dbView.kanbanUpdate(activeView.value?.id, {
      meta: payload,
    })
    ;(activeView.value.view as KanbanType).meta = payload
  }

  await reloadViewMetaHook?.trigger()
}

const coverImageObjectFitOptions = [
  { value: CoverImageObjectFit.FIT, label: t('labels.fitImage') },
  { value: CoverImageObjectFit.COVER, label: t('labels.coverImageArea') },
]

const coverImageObjectFitDropdown = ref<{
  isOpen: boolean
  isSaving: keyof typeof CoverImageObjectFit | null
}>({
  isOpen: false,
  isSaving: null,
})

const coverImageObjectFit = computed({
  get: () => {
    return [ViewTypes.GALLERY, ViewTypes.KANBAN].includes(activeView.value?.type as ViewTypes) && activeView.value?.view
      ? parseProp(activeView.value?.view?.meta)?.fk_cover_image_object_fit || CoverImageObjectFit.FIT
      : undefined
  },
  set: async (val) => {
    if (val !== coverImageObjectFit.value) {
      coverImageObjectFitDropdown.value.isSaving = val

      addUndo({
        undo: {
          fn: updateCoverImageObjectFit,
          args: [coverImageObjectFit.value],
        },
        redo: {
          fn: updateCoverImageObjectFit,
          args: [val],
        },
        scope: defineViewScope({ view: activeView.value }),
      })

      await updateCoverImageObjectFit(val)
    }
    coverImageObjectFitDropdown.value.isSaving = null
    coverImageObjectFitDropdown.value.isOpen = false
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

watch(
  fields,
  async (newValue) => {
    if (!newValue || isPublic.value || ![ViewTypes.GALLERY, ViewTypes.KANBAN].includes(activeView.value?.type as ViewTypes))
      return

    const filterFields =
      newValue
        .filter((el) => el.fk_column_id && metaColumnById.value[el.fk_column_id].uidt === UITypes.Attachment)
        .map((field) => {
          return {
            value: field.fk_column_id,
            label: field.title,
          }
        }) ?? []

    coverOptions.value = [{ value: null, label: 'No Image' }, ...filterFields]

    const lookupColumns = newValue
      .filter((f) => f.fk_column_id && metaColumnById.value[f.fk_column_id].uidt === UITypes.Lookup)
      .map((f) => metaColumnById.value[f.fk_column_id!])

    const attLookupColumnIds: Set<string> = new Set()

    const loadLookupMeta = async (originalCol: ColumnType, column: ColumnType, metaId?: string): Promise<void> => {
      const relationColumn =
        metaId || meta.value?.id
          ? metas.value[metaId || meta.value?.id]?.columns?.find(
              (c: ColumnType) => c.id === (column?.colOptions as LookupType)?.fk_relation_column_id,
            )
          : undefined

      if (relationColumn?.colOptions?.fk_related_model_id) {
        await getMeta(relationColumn.colOptions.fk_related_model_id!)

        const lookupColumn = metas.value[relationColumn.colOptions.fk_related_model_id]?.columns?.find(
          (c: any) => c.id === (column?.colOptions as LookupType)?.fk_lookup_column_id,
        ) as ColumnType | undefined

        if (lookupColumn && isAttachment(lookupColumn)) {
          attLookupColumnIds.add(originalCol.id)
        } else if (lookupColumn && lookupColumn?.uidt === UITypes.Lookup) {
          await loadLookupMeta(originalCol, lookupColumn, relationColumn.colOptions.fk_related_model_id)
        }
      }
    }

    await Promise.allSettled(lookupColumns.map((col) => loadLookupMeta(col, col)))

    const lookupAttColumns = lookupColumns
      .filter((column) => attLookupColumnIds.has(column?.id))
      .map((c) => {
        return {
          value: c.id,
          label: c.title,
        }
      })

    coverOptions.value = [...coverOptions.value, ...lookupAttColumns]
  },
  {
    immediate: true,
  },
)

const addColumnDropdown = ref(false)

function getColumnOfField(field: Field) {
  return meta.value?.columns?.find((it) => it.id === field.fk_column_id)
}

const openSubmenusCount = ref(0);
const lookupDropdownsTickle = ref(0);

function scrollToLatestField() {
  setTimeout(() => {
    document.querySelector('.nc-fields-menu-item:last-child')?.scrollIntoView({ behavior: 'smooth' })
  }, 500);
}
</script>

<template>
  <NcDropdown
    v-model:visible="open"
    :trigger="['click']"
    class="!xs:hidden"
    overlay-class-name="nc-dropdown-fields-menu nc-toolbar-dropdown overflow-hidden"
    :auto-close="openSubmenusCount === 0"
  >
    <NcTooltip :disabled="!isMobileMode && !isToolbarIconMode" :class="{ 'nc-active-btn': numberOfHiddenFields }">
      <template #title>
        {{
          activeView?.type === ViewTypes.KANBAN || activeView?.type === ViewTypes.GALLERY
            ? $t('title.editCards')
            : $t('objects.fields')
        }}
      </template>

      <NcButton
        v-e="['c:fields']"
        class="nc-fields-menu-btn nc-toolbar-btn !h-7 !border-0"
        size="small"
        type="secondary"
        :show-as-disabled="isLocked"
      >
        <div class="flex items-center gap-1">
          <div class="flex items-center gap-2 min-h-5">
            <GeneralIcon
              v-if="activeView?.type === ViewTypes.KANBAN || activeView?.type === ViewTypes.GALLERY"
              class="h-4 w-4"
              icon="creditCard"
            />
            <component :is="iconMap.fields" v-else class="h-4 w-4" />

            <!-- Fields -->
            <span v-if="!isMobileMode && !isToolbarIconMode" class="text-capitalize !text-[13px] font-medium">
              <template v-if="activeView?.type === ViewTypes.KANBAN || activeView?.type === ViewTypes.GALLERY">
                {{ $t('title.editCards') }}
              </template>
              <template v-else>
                {{ $t('objects.fields') }}
              </template>
            </span>
          </div>
          <span v-if="numberOfHiddenFields" class="bg-brand-50 text-brand-500 py-1 px-2 text-md rounded-md">
            {{ numberOfHiddenFields }}
          </span>
        </div>
      </NcButton>
    </NcTooltip>

    <template #overlay>
      <div
        class="pt-1 bg-white w-[320px] rounded-lg nc-table-toolbar-menu"
        data-testid="nc-fields-menu"
        @click.stop
      >
        <div
          v-if="!isPublic && (activeView?.type === ViewTypes.GALLERY || activeView?.type === ViewTypes.KANBAN)"
          class="flex items-center gap-2 px-2 mb-2 w-80 border-b-1 border-gray-100 pb-2"
        >
          <div class="pl-2 flex text-sm select-none text-gray-600">{{ $t('labels.coverImageField') }}</div>

          <div
            class="flex-1 nc-dropdown-cover-image-wrapper flex items-stretch border-1 border-gray-200 rounded-lg transition-all duration-0.3s max-w-[206px]"
            :class="{
              'nc-disabled': isLocked,
            }"
          >
            <a-select
              v-model:value="coverImageColumnId"
              class="flex-1 max-w-[calc(100%_-_33px)]"
              dropdown-class-name="nc-dropdown-cover-image !rounded-lg"
              :bordered="false"
              :disabled="isLocked"
              @click.stop
            >
              <template #suffixIcon><GeneralIcon class="text-gray-700" icon="arrowDown" /></template>

              <a-select-option v-for="option of coverOptions" :key="option.value" :value="option.value">
                <div class="w-full flex gap-2 items-center justify-between max-w-[400px]">
                  <div
                    class="flex-1 flex items-center gap-1"
                    :class="{
                      'max-w-[calc(100%_-_20px)]': coverImageColumnId === option.value,
                      'max-w-full': coverImageColumnId !== option.value,
                    }"
                  >
                    <component
                      :is="getIcon(metaColumnById[option.value])"
                      v-if="option.value"
                      class="!w-3.5 !h-3.5 !text-gray-700 !ml-0"
                    />

                    <NcTooltip class="flex-1 max-w-[calc(100%_-_20px)] truncate" show-on-truncate-only>
                      <template #title>
                        {{ option.label }}
                      </template>
                      <template #default>{{ option.label }}</template>
                    </NcTooltip>
                  </div>
                  <GeneralIcon
                    v-if="coverImageColumnId === option.value"
                    id="nc-selected-item-icon"
                    icon="check"
                    class="flex-none text-primary w-4 h-4"
                  />
                </div>
              </a-select-option>
            </a-select>
            <NcDropdown
              v-if="coverImageObjectFit"
              v-model:visible="coverImageObjectFitDropdown.isOpen"
              :disabled="isLocked"
              placement="bottomRight"
            >
              <button
                class="flex items-center px-2 border-l-1 border-gray-200 disabled:(cursor-not-allowed opacity-80)"
                :disabled="isLocked"
              >
                <GeneralIcon
                  icon="settings"
                  class="h-4 w-4"
                  :class="{
                    '!text-brand-500': coverImageObjectFitDropdown.isOpen,
                  }"
                />
              </button>
              <template #overlay>
                <NcMenu class="nc-cover-image-object-fit-dropdown-menu min-w-[168px]">
                  <NcMenuItem
                    v-for="option in coverImageObjectFitOptions"
                    :key="option.value"
                    class="!children:w-full"
                    @click.stop="coverImageObjectFit = option.value"
                  >
                    <span>
                      {{ option.label }}
                    </span>

                    <GeneralLoader
                      v-if="option.value === coverImageObjectFitDropdown.isSaving"
                      size="regular"
                      class="flex-none"
                    />

                    <GeneralIcon
                      v-else-if="option.value === coverImageObjectFit"
                      icon="check"
                      class="flex-none text-primary w-4 h-4"
                    />
                  </NcMenuItem>
                </NcMenu>
              </template>
            </NcDropdown>
          </div>
        </div>

        <div @click.stop>
          <a-input
            ref="fieldsMenuSearchRef"
            v-model:value="filterQuery"
            :placeholder="$t('placeholder.searchFields')"
            class="nc-toolbar-dropdown-search-field-input !border-none !shadow-none !pb-1.5 !pt-2.5"
          >
            <template #prefix> <GeneralIcon icon="search" class="nc-search-icon h-3.5 w-3.5 mr-1 ml-2" /> </template>
            <template #suffix>
              <div class="nc-scrollbar-thin" style="scrollbar-gutter: stable;">
                <NcSwitch v-model:checked="showAllColumns" size="xsmall" class="!mr-1" />
              </div>
            </template>
          </a-input>
        </div>

        <div
          class="flex flex-col mt-1 nc-scrollbar-thin max-h-[315px] min-h-[240px] p-2 overflow-y-auto border-t-1 border-gray-100"
          style="scrollbar-gutter: stable;"
        >
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
              :disabled="isLocked"
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
                  class="nc-fields-menu-item pl-2 flex flex-row items-center rounded-md"
                  :class="{
                    'hover:bg-gray-100': !isLocked,
                  }"
                  @click.stop
                >
                  <component
                    :is="iconMap.drag"
                    class="!h-3.75 text-gray-600 mr-1"
                    :class="{
                      'cursor-not-allowed': isLocked,
                      'cursor-move': !isLocked,
                    }"
                  />
                  <div
                    v-e="['a:fields:show-hide']"
                    class="flex flex-row items-center w-full truncate ml-1 py-[5px] pr-2"
                    :class="{
                      'cursor-pointer': !isLocked,
                    }"
                    @click="
                      () => {
                        if (isLocked || (getColumnOfField(field)?.uidt === 'Links' && !isLocalMode)) return

                        field.show = !field.show
                        toggleFieldVisibility(field.show, field)
                      }
                    "
                  >
                    <component :is="getIcon(metaColumnById[field.fk_column_id])" class="!w-3.5 !h-3.5" />
                    <SmartsheetToolbarAddLookupsDropdown
                      v-if="metas"
                      :key="lookupDropdownsTickle"
                      :column="getColumnOfField(field)!"
                      :disabled="isLocalMode"
                      @created="lookupDropdownsTickle++"
                      @update:is-opened="openSubmenusCount += $event === true ? 1 : -1">
                      <div class="inline-flex items-center w-full">
                        <NcTooltip class="w-0 flex-1 pl-1 pr-2 truncate" show-on-truncate-only :disabled="isDragging">
                          <template #title>
                            {{ field.title }}
                          </template>
                          <template #default>
                            <span class="truncate">
                              {{ field.title }}
                              <GeneralIcon v-if="!isLocalMode && getColumnOfField(field)?.uidt === 'Links'" icon="chevronRight" class="ml-1 relative top-1" />
                            </span>
                          </template>
                        </NcTooltip>
                      </div>
                    </SmartsheetToolbarAddLookupsDropdown>
                    <div v-if="activeView.type === ViewTypes.CALENDAR" class="flex mr-2">
                      <NcButton
                        :class="{
                          '!text-primary': field.bold,
                        }"
                        class="!w-5 !h-5 hover:!bg-gray-200 active:!bg-gray-300 relative"
                        size="xsmall"
                        type="text"
                        :disabled="isLocked"
                        @click.stop="toggleFieldStyles(field, 'bold', !field.bold)"
                      >
                        <component :is="iconMap.bold" class="!w-3.5 !h-3.5" />
                        <div v-if="field.bold" class="bg-primary w-1 h-1 rounded-full absolute top-0 right-0" />
                      </NcButton>
                      <NcButton
                        :class="{
                          '!text-primary': field.italic,
                        }"
                        class="!w-5 !h-5 hover:!bg-gray-200 active:!bg-gray-300 relative"
                        size="xsmall"
                        type="text"
                        :disabled="isLocked"
                        @click.stop="toggleFieldStyles(field, 'italic', !field.italic)"
                      >
                        <component :is="iconMap.italic" class="!w-3.5 !h-3.5" />
                        <div v-if="field.italic" class="bg-primary w-1 h-1 rounded-full absolute top-0 right-0" />
                      </NcButton>
                      <NcButton
                        :class="{
                          '!text-primary': field.underline,
                        }"
                        class="!w-5 !h-5 hover:!bg-gray-200 active:!bg-gray-300 relative"
                        size="xsmall"
                        type="text"
                        :disabled="isLocked"
                        @click.stop="toggleFieldStyles(field, 'underline', !field.underline)"
                      >
                        <component :is="iconMap.underline" class="!w-3.5 !h-3.5" />
                        <div v-if="field.underline" class="bg-primary w-1 h-1 rounded-full absolute top-0 right-0" />
                      </NcButton>
                    </div>
                    <NcSwitch
                      :checked="field.show"
                      :disabled="field.isViewEssentialField || isLocked"
                      size="xxsmall"
                      @change="$e('a:fields:show-hide')"
                      @click="
                        () => {
                          if (getColumnOfField(field)?.uidt === 'Links') {
                            field.show = !field.show
                            toggleFieldVisibility(field.show, field)
                          }
                        }
                      "
                    />
                  </div>

                  <div class="flex-1" />
                </div>
              </template>
            </Draggable>
          </div>
        </div>

        <div v-if="!filterQuery && !isLocalMode" class="flex px-2 gap-1 py-2 border-t-1 justify-between border-gray-100">
          <NcButton
            class="nc-fields-show-system-fields !px-2"
            size="xsmall"
            type="text"
            :disabled="isLocked"
            @click="showSystemField = !showSystemField"
          >
            <template v-if="showSystemField">
              <GeneralIcon icon="eyeSlash" class="!w-3 !h-3 mr-2" />
              System fields
            </template>
            <template v-else>
              <GeneralIcon icon="eye" class="!w-3 !h-3 mr-2" />
              System fields
            </template>
          </NcButton>
          <a-dropdown
            v-model:visible="addColumnDropdown"
            :trigger="['click']"
            overlay-class-name="nc-dropdown-grid-add-column"
            placement="right"
          >
            <NcButton class="nc-fields-show-all-fields !px-2" size="xsmall" type="ghost" :shadow="false">
              <GeneralIcon icon="plus" class="!w-3 !h-3 mr-2 mb-1 text-primary" />
              <span class="text-primary">New Field</span>
            </NcButton>
            <template #overlay>
              <div class="nc-edit-or-add-provider-wrapper">
                <LazySmartsheetColumnEditOrAddProvider
                  v-if="addColumnDropdown"
                  ref="editOrAddProviderRef"
                  @submit="addColumnDropdown = false; scrollToLatestField();"
                  @cancel="addColumnDropdown = false"
                  @click.stop
                  @keydown.stop
                />
              </div>
            </template>
          </a-dropdown>
        </div>

        <GeneralLockedViewFooter v-if="isLocked" @on-open="open = false" />
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
  @apply !text-xs !text-gray-700 !border-none bg-transparent;

  &:not(:disabled) {
    @apply hover:(!text-gray-800 bg-gray-200);
  }
}

.nc-cover-image-object-fit-dropdown-menu {
  :deep(.nc-menu-item-inner) {
    @apply !w-full flex items-center justify-between;
  }
}
.nc-dropdown-cover-image-wrapper {
  @apply h-8;
  &:not(.nc-disabled):not(:focus-within) {
    @apply shadow-default hover:shadow-hover;
  }
  &:not(.nc-disabled):focus-within {
    @apply shadow-selected border-brand-500;
  }
}

:deep(.ant-input-affix-wrapper) {
  &:not(.ant-input-affix-wrapper-disabled):not(.ant-input-affix-wrapper-focused):not(:focus) {
    @apply shadow-default hover:(shadow-hover border-gray-200);
  }
  &.ant-input-affix-wrapper-focused,
  &:focus {
    @apply border-brand-500 shadow-selected;
  }
}
</style>
