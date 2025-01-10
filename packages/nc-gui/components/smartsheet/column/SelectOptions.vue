<script setup lang="ts">
import Draggable from 'vuedraggable'
import tinycolor from 'tinycolor2'
import { type SelectOptionsType, UITypes } from 'nocodb-sdk'
import InfiniteLoading from 'v3-infinite-loading'

interface Option {
  color: string
  title: string
  id?: string
  fk_colum_id?: string
  order?: number
  status?: 'remove' | 'new'
  index?: number
}

const props = defineProps<{
  value: any
  fromTableExplorer?: boolean
  isKanbanStack?: boolean
  optionId?: string
  isNewStack?: boolean
}>()

const emit = defineEmits(['update:value', 'saveChanges'])

const vModel = useVModel(props, 'value', emit)

const { isKanbanStack, optionId, isNewStack } = toRefs(props)

const { $e } = useNuxtApp()

const { setAdditionalValidations, validateInfos, column } = useColumnCreateStoreOrThrow()

// const { base } = storeToRefs(useBase())

const { aiIntegrationAvailable, predictSelectOptions } = useNocoAi()

const { isFeatureEnabled } = useBetaFeatureToggle()

const { isAiModeFieldModal } = usePredictFields()

const meta = inject(MetaInj, ref())

const optionsWrapperDomRef = ref<HTMLElement>()

const options = ref<Option[]>([])

const isAddingOption = ref(false)

// TODO: Implement proper top and bottom virtual scrolling
const OPTIONS_PAGE_COUNT = 20
const loadedOptionAnchor = ref(OPTIONS_PAGE_COUNT)
const isReverseLazyLoad = ref(false)

const renderedOptions = ref<Option[]>([])
const savedDefaultOption = ref<Option[]>([])

const colorMenus = ref<any>({})

const colors = ref(enumColor.light)

const defaultOption = ref<Option[]>([])

const isKanban = inject(IsKanbanInj, ref(false))

const { t } = useI18n()

const isLoadingPredictOptions = ref<boolean>(false)

const validators = {
  colOptions: [
    {
      type: 'object',
      fields: {
        options: {
          validator: (_: any, _opt: any) => {
            return new Promise<void>((resolve, reject) => {
              for (const opt of options.value) {
                if ((opt as any).status === 'remove' || (opt as any).status === 'new') continue

                if (!opt.title.length) {
                  return reject(new Error(t('msg.selectOption.cantBeNull')))
                }
                if (vModel.value.uidt === UITypes.MultiSelect && opt.title.includes(',')) {
                  return reject(new Error(t('msg.selectOption.multiSelectCantHaveCommas')))
                }
                if (options.value.filter((el) => el.title === opt.title && (el as any).status !== 'remove').length > 1) {
                  return reject(new Error(t('msg.selectOption.cantHaveDuplicates')))
                }
              }
              resolve()
            })
          },
        },
      },
    },
  ],
}

// we use a correct syntax from async-validator but causes a type mismatch on antdv so we cast any
setAdditionalValidations({
  ...validators,
} as any)

const kanbanStackOption = computed(() => {
  if (isNewStack.value) {
    return renderedOptions.value[renderedOptions.value.length - 1]
  } else if (optionId.value) {
    return renderedOptions.value.find((o) => o.id === optionId.value)
  }
  return null
})

const getNextColor = () => {
  let tempColor = colors.value[0]
  if (options.value.length && options.value[options.value.length - 1].color) {
    const lastColor = colors.value.indexOf(options.value[options.value.length - 1].color)
    tempColor = colors.value[(lastColor + 1) % colors.value.length]
  }
  return tempColor
}

const addNewOption = () => {
  isAddingOption.value = true

  const tempOption = {
    title: '',
    color: getNextColor(),
    index: options.value.length,
    ...(isKanbanStack.value ? { status: 'new' } : {}),
  }
  options.value.push(tempOption as Option)

  if (isKanbanStack.value) {
    renderedOptions.value = options.value
  } else {
    isReverseLazyLoad.value = true

    loadedOptionAnchor.value = options.value.length - OPTIONS_PAGE_COUNT
    loadedOptionAnchor.value = Math.max(loadedOptionAnchor.value, 0)

    renderedOptions.value = options.value.slice(loadedOptionAnchor.value, options.value.length)
  }

  optionsWrapperDomRef.value!.scrollTop = optionsWrapperDomRef.value!.scrollHeight

  nextTick(() => {
    // Last child doesnt work for query selector
    setTimeout(() => {
      const doms = document.querySelectorAll(`.nc-col-option-select-option .nc-select-col-option-select-option`)
      const dom = doms[doms.length - 1] as HTMLInputElement

      if (dom) {
        dom.focus()
      }
    }, 150)

    optionsWrapperDomRef.value!.scrollTop = optionsWrapperDomRef.value!.scrollHeight
    isAddingOption.value = false
  })
}

const syncOptions = (saveChanges = false, submit = false, payload?: Option) => {
  // set initial colOptions if not set
  vModel.value.colOptions = vModel.value.colOptions || {}
  vModel.value.colOptions.options = options.value
    .filter((op) => op.status !== 'remove')
    .sort((a, b) => {
      const renderA = renderedOptions.value.findIndex((el) => a.index !== undefined && el.index === a.index)
      const renderB = renderedOptions.value.findIndex((el) => a.index !== undefined && el.index === b.index)
      if (renderA === -1 || renderB === -1) return 0
      return renderA - renderB
    })
    .map((op) => {
      const { status: _s, ...rest } = op
      return rest
    })

  if (saveChanges) {
    emit('saveChanges', submit, true, payload)
  }
}

const removeRenderedOption = (index: number) => {
  const renderedOption = renderedOptions.value[index]

  if (renderedOption.index === undefined || isNaN(renderedOption.index)) return

  const option = options.value[renderedOption.index]

  renderedOption.status = 'remove'
  option.status = 'remove'

  syncOptions()

  const optionId = renderedOptions.value[index]?.id

  const removedDefaultOption = defaultOption.value.find((o) => o.id === optionId)

  if (removedDefaultOption) {
    if (vModel.value.uidt === UITypes.SingleSelect) {
      savedDefaultOption.value = [removedDefaultOption]
      defaultOption.value = []
      vModel.value.cdf = null
    } else {
      savedDefaultOption.value = [...savedDefaultOption.value, removedDefaultOption]
      defaultOption.value = defaultOption.value.filter((o) => o.id !== optionId)
      vModel.value.cdf = defaultOption.value.map((o) => o.title).join(',')
    }
  }
}

const optionChanged = (changedElement: Option, saveChanges = false) => {
  const changedDefaultOptionIndex = defaultOption.value.findIndex((o) => {
    if (o.id !== undefined && changedElement.id !== undefined) {
      return o.id === changedElement.id
    } else {
      return o.index === changedElement.index
    }
  })

  if (changedDefaultOptionIndex !== -1) {
    if (vModel.value.uidt === UITypes.SingleSelect) {
      defaultOption.value[changedDefaultOptionIndex].title = changedElement.title
      vModel.value.cdf = changedElement.title
    } else {
      defaultOption.value[changedDefaultOptionIndex].title = changedElement.title
      vModel.value.cdf = defaultOption.value.map((o) => o.title).join(',')
    }
  }
  syncOptions(saveChanges)
}

const undoRemoveRenderedOption = (index: number) => {
  const renderedOption = renderedOptions.value[index]

  if (renderedOption.index === undefined || isNaN(renderedOption.index)) return

  const option = options.value[renderedOption.index]

  renderedOption.status = undefined
  option.status = undefined

  syncOptions()

  const optionId = renderedOptions.value[index]?.id

  const addedDefaultOption = savedDefaultOption.value.find((o) => o.id === optionId)

  if (addedDefaultOption) {
    if (vModel.value.uidt === UITypes.SingleSelect) {
      defaultOption.value = [addedDefaultOption]
      vModel.value.cdf = addedDefaultOption.title
      savedDefaultOption.value = []
    } else {
      defaultOption.value = [...defaultOption.value, addedDefaultOption]
      vModel.value.cdf = defaultOption.value.map((o) => o.title).join(',')
      savedDefaultOption.value = savedDefaultOption.value.filter((o) => o.id !== optionId)
    }
  }
}

// focus last created input
// watch(inputs, () => {
//   if (inputs.value?.$el) {
//     inputs.value.$el.focus()
//   }
// })

// Removes the Select Option from cdf if the option is removed
watch(vModel, (next) => {
  const cdfs = (next.cdf ?? '').toString().split(',')

  const valuesMap = (next.colOptions?.options ?? []).reduce((acc, c) => {
    acc[c.title.replace(/^'|'$/g, '')] = c
    return acc
  }, {})

  defaultOption.value = []

  const newCdf = cdfs
    .filter((c: string) => {
      if (valuesMap[c]) {
        defaultOption.value.push(valuesMap[c])
        return true
      }
      return false
    })
    .join(',')

  next.cdf = newCdf.length === 0 ? null : newCdf
})

const loadListDataReverse = async ($state: any) => {
  if (isAddingOption.value) return

  if (loadedOptionAnchor.value === 0) {
    $state.complete()
    return
  }
  $state.loading()

  loadedOptionAnchor.value -= OPTIONS_PAGE_COUNT
  loadedOptionAnchor.value = Math.max(loadedOptionAnchor.value, 0)

  renderedOptions.value = options.value.slice(loadedOptionAnchor.value, options.value.length)

  optionsWrapperDomRef.value!.scrollTop = optionsWrapperDomRef.value!.scrollTop + 100

  if (loadedOptionAnchor.value === 0) {
    $state.complete()
    return
  }
  $state.loaded()
}

const loadListData = async ($state: any) => {
  if (isAddingOption.value) return

  if (loadedOptionAnchor.value === options.value.length) {
    return $state.complete()
  }

  $state.loading()

  loadedOptionAnchor.value += OPTIONS_PAGE_COUNT
  loadedOptionAnchor.value = Math.min(loadedOptionAnchor.value, options.value.length)

  renderedOptions.value = options.value.slice(0, loadedOptionAnchor.value)

  if (loadedOptionAnchor.value === options.value.length) {
    return $state.complete()
  }

  $state.loaded()
}

const predictOptions = async () => {
  if (!vModel.value?.title || !meta.value?.id) return

  $e('a:column:ai:select:predict-options')

  isLoadingPredictOptions.value = true

  const history = options.value.map((o) => o.title).filter((o) => !!o.trim())

  const predictedOptions = await predictSelectOptions(vModel.value?.title, meta.value?.id, history, meta.value?.base_id)

  isLoadingPredictOptions.value = false

  if (predictedOptions) {
    for (const option of predictedOptions) {
      // skip if option already exists
      if (!option?.trim() || options.value.find((el) => el.title === option)) continue

      if (isKanbanStack.value) {
        const oldOption = options.value.find((el) => el.status === 'new')
        if (oldOption) {
          oldOption.title = option
        } else {
          options.value.push({
            title: option,
            color: getNextColor(),
            index: options.value.length,
            ...(isKanbanStack.value ? { status: 'new' } : {}),
          })
        }
        break
      } else {
        options.value.push({
          title: option,
          color: getNextColor(),
          index: options.value.length,
          ...(isKanbanStack.value ? { status: 'new' } : {}),
        })
      }
    }

    if (isKanbanStack.value) {
      renderedOptions.value = options.value
    } else {
      isReverseLazyLoad.value = true

      loadedOptionAnchor.value = options.value.length - OPTIONS_PAGE_COUNT
      loadedOptionAnchor.value = Math.max(loadedOptionAnchor.value, 0)

      renderedOptions.value = options.value.slice(loadedOptionAnchor.value, options.value.length)
      syncOptions()
    }

    optionsWrapperDomRef.value!.scrollTop = optionsWrapperDomRef.value!.scrollHeight
  }
}

onMounted(() => {
  if (!vModel.value.colOptions?.options) {
    vModel.value.colOptions = {
      options: [],
    }
  }

  isReverseLazyLoad.value = false

  options.value = vModel.value.colOptions.options

  let indexCounter = 0
  options.value = options.value.map((el) => {
    el.index = indexCounter++
    return el
  })

  if (isKanbanStack.value) {
    renderedOptions.value = options.value
  } else {
    loadedOptionAnchor.value = Math.min(loadedOptionAnchor.value, options.value.length)

    renderedOptions.value = [...options.value].slice(0, loadedOptionAnchor.value)
  }

  // Support for older options
  for (const op of options.value.filter((el) => el.order === null)) {
    op.title = op.title.replace(/^'/, '').replace(/'$/, '')
  }

  if (vModel.value.cdf && typeof vModel.value.cdf === 'string') {
    const fndDefaultOption = options.value.filter((el) => el.title === vModel.value.cdf)
    if (!fndDefaultOption.length) {
      vModel.value.cdf = vModel.value.cdf.replace(/^'/, '').replace(/'$/, '')
    }
  }

  const fndDefaultOption = options.value.filter((el) => el.title === vModel.value.cdf)
  if (fndDefaultOption.length) {
    defaultOption.value = vModel.value.uidt === UITypes.SingleSelect ? [fndDefaultOption[0]] : fndDefaultOption
  }
  if (isKanbanStack.value && isNewStack.value) {
    addNewOption()
  } else if (isKanbanStack.value) {
    nextTick(() => {
      setTimeout(() => {
        const doms = document.querySelectorAll(`.nc-col-option-select-option .nc-select-col-option-select-option`)
        const dom = doms[doms.length - 1] as HTMLInputElement

        if (dom) {
          dom.focus()
        }
      }, 150)
    })
  }
})

if (isKanbanStack.value) {
  onClickOutside(optionsWrapperDomRef, (e) => {
    const option = (column.value?.colOptions as SelectOptionsType)?.options?.find(
      (o) => o?.id && o.id === kanbanStackOption.value?.id,
    )

    if (
      (e.target as HTMLElement)?.closest(
        `.nc-select-option-color-picker, .nc-add-select-option-auto-suggest, .nc-kanban-stack-header-${
          option?.id || 'new-stack'
        }`,
      )
    ) {
      return
    }

    if (
      kanbanStackOption.value?.title &&
      (option?.title !== kanbanStackOption.value?.title || option?.color !== kanbanStackOption.value?.color)
    ) {
      syncOptions(true, true, kanbanStackOption.value)
    } else {
      emit('saveChanges', true, false)
    }
  })
}

if (!isKanbanStack.value) {
  watch(isLoadingPredictOptions, (newValue) => {
    if (!newValue) return
    nextTick(() => {
      optionsWrapperDomRef.value!.scrollTop = optionsWrapperDomRef.value!.scrollHeight
    })
  })
}
</script>

<template>
  <div class="w-full">
    <div
      ref="optionsWrapperDomRef"
      class="nc-col-option-select-option"
      :class="{
        'overflow-x-auto scrollbar-thin-dull rounded-lg': !isKanbanStack,
        'border-1 border-gray-200': renderedOptions.length && !isKanbanStack,
        'bg-white': isAiModeFieldModal,
      }"
      :style="{
        maxHeight: props.fromTableExplorer ? 'calc(100vh - (var(--topbar-height) * 3.6) - 320px)' : 'calc(min(30vh, 250px))',
      }"
    >
      <template v-if="isKanbanStack">
        <div v-if="kanbanStackOption" class="flex items-center nc-select-option">
          <div class="flex items-center w-full">
            <NcDropdown
              v-model:visible="colorMenus[kanbanStackOption.index!]"
              :auto-close="false"
              overlay-class-name="nc-select-option-color-picker"
              :disabled="isLoadingPredictOptions"
            >
              <div class="flex-none h-6 w-6 flex cursor-pointer mx-1">
                <div
                  class="h-6 w-6 rounded flex items-center"
                  :class="{
                    'justify-center': isLoadingPredictOptions,
                  }"
                  :style="{
                    backgroundColor: kanbanStackOption.color,
                    color: tinycolor.isReadable(kanbanStackOption.color || '#ccc', '#fff', { level: 'AA', size: 'large' })
                      ? '#fff'
                      : tinycolor.mostReadable(kanbanStackOption.color || '#ccc', ['#0b1d05', '#fff']).toHex8String(),
                  }"
                >
                  <GeneralLoader v-if="isLoadingPredictOptions" size="regular" class="!text-current" />
                  <GeneralIcon v-else icon="arrowDown" class="flex-none h-4 w-4 m-auto !text-current" />
                </div>
              </div>

              <template #overlay>
                <div>
                  <LazyGeneralAdvanceColorPicker
                    v-model="kanbanStackOption.color"
                    :is-open="colorMenus[kanbanStackOption.index!]"
                    @input="(el:string) => {
                      kanbanStackOption!.color = el
                      optionChanged(kanbanStackOption!)
                    }"
                  ></LazyGeneralAdvanceColorPicker>
                </div>
              </template>
            </NcDropdown>

            <a-input
              v-model:value="kanbanStackOption.title"
              placeholder="Enter option name..."
              class="caption !rounded-lg nc-select-col-option-select-option nc-kanban-stack-input !bg-transparent"
              data-testid="nc-kanban-stack-title-input"
              :disabled="isLoadingPredictOptions"
              @keydown.enter.prevent.stop="syncOptions(true, true, kanbanStackOption!)"
              @change="() => {
                  kanbanStackOption!.status = undefined
                  optionChanged(kanbanStackOption!)
              }"
            />
          </div>

          <div
            v-if="isNewStack"
            class="ml-1 hover:!text-black-500 text-gray-500 cursor-pointer hover:bg-gray-200 py-1 px-1.5 rounded-md h-7 flex items-center"
            @click="emit('saveChanges', true, false)"
          >
            <component :is="iconMap.close" class="-mt-0.25 w-4 h-4" />
          </div>
        </div>
      </template>
      <template v-else>
        <InfiniteLoading v-if="isReverseLazyLoad" v-bind="$attrs" @infinite="loadListDataReverse">
          <template #spinner>
            <div class="flex flex-row w-full justify-center mt-2">
              <GeneralLoader />
            </div>
          </template>
          <template #complete>
            <span></span>
          </template>
        </InfiniteLoading>
        <Draggable :list="renderedOptions" item-key="id" handle=".nc-child-draggable-icon" @change="syncOptions">
          <template #item="{ element, index }">
            <div class="flex py-1 items-center nc-select-option hover:bg-gray-100 group">
              <div
                class="flex items-center w-full"
                :data-testid="`select-column-option-${index}`"
                :class="{ removed: element.status === 'remove' }"
              >
                <div
                  v-if="!isKanban"
                  class="nc-child-draggable-icon p-2 flex cursor-pointer"
                  :data-testid="`select-option-column-handle-icon-${element.title}`"
                >
                  <component :is="iconMap.dragVertical" small class="handle" />
                </div>

                <NcDropdown v-model:visible="colorMenus[index]" :auto-close="false">
                  <div class="flex-none h-6 w-6 flex cursor-pointer mx-1">
                    <div
                      class="h-6 w-6 rounded flex items-center"
                      :style="{
                        backgroundColor: element.color,
                        color: tinycolor.isReadable(element.color || '#ccc', '#fff', { level: 'AA', size: 'large' })
                          ? '#fff'
                          : tinycolor.mostReadable(element.color || '#ccc', ['#0b1d05', '#fff']).toHex8String(),
                      }"
                    >
                      <GeneralIcon icon="arrowDown" class="flex-none h-4 w-4 m-auto !text-current" />
                    </div>
                  </div>

                  <template #overlay>
                    <div>
                      <LazyGeneralAdvanceColorPicker
                        v-model="element.color"
                        :is-open="colorMenus[index]"
                        @input="(el:string) => {
                          element.color = el
                          optionChanged(element)
                        }"
                      ></LazyGeneralAdvanceColorPicker>
                    </div>
                  </template>
                </NcDropdown>

                <a-input
                  v-model:value="element.title"
                  class="caption !rounded-lg nc-select-col-option-select-option !bg-transparent"
                  :data-testid="`select-column-option-input-${index}`"
                  :disabled="element.status === 'remove'"
                  @keydown.enter.prevent="element.title?.trim() && addNewOption()"
                  @change="optionChanged(element)"
                />
              </div>

              <div
                v-if="element.status !== 'remove'"
                :data-testid="`select-column-option-remove-${index}`"
                class="mx-1 hover:!text-black-500 text-gray-500 cursor-pointer hover:bg-gray-200 py-1 px-1.5 rounded-md h-7 flex items-center invisible group-hover:visible"
                @click="removeRenderedOption(index)"
              >
                <component :is="iconMap.close" class="-mt-0.25 w-4 h-4" />
              </div>
              <div
                v-else
                :data-testid="`select-column-option-remove-undo-${index}`"
                class="mx-1 hover:!text-black-500 text-gray-500 cursor-pointer hover:bg-gray-200 py-1 px-1.5 rounded-md h-7 flex items-center invisible group-hover:visible"
                @click="undoRemoveRenderedOption(index)"
              >
                <MdiArrowULeftBottom
                  class="hover:!text-black-500 text-gray-500 cursor-pointer w-4 h-4"
                  @click="undoRemoveRenderedOption(index)"
                />
              </div>
            </div>
          </template>
          <template v-if="isLoadingPredictOptions" #footer>
            <div class="flex py-1 items-center nc-select-option hover:bg-gray-100 group">
              <div class="flex items-center w-full">
                <div class="p-2 flex !cursor-disabled">
                  <component :is="iconMap.dragVertical" small class="handle opacity-75" />
                </div>
                <div class="flex-none h-6 w-6 flex cursor-pointer mx-1">
                  <div
                    class="h-6 w-6 rounded flex items-center justify-center"
                    :style="{
                      backgroundColor: getNextColor(),
                      color: tinycolor.isReadable(getNextColor() || '#ccc', '#fff', { level: 'AA', size: 'large' })
                        ? '#fff'
                        : tinycolor.mostReadable(getNextColor() || '#ccc', ['#0b1d05', '#fff']).toHex8String(),
                    }"
                  >
                    <GeneralLoader size="regular" class="!text-current" />
                  </div>
                </div>

                <div class="caption px-3">...</div>
              </div>
            </div>
          </template>
        </Draggable>
        <InfiniteLoading v-if="!isReverseLazyLoad" v-bind="$attrs" @infinite="loadListData">
          <template #spinner>
            <div class="flex flex-row w-full justify-center mt-2">
              <GeneralLoader />
            </div>
          </template>
          <template #complete>
            <span></span>
          </template>
        </InfiniteLoading>
      </template>
    </div>

    <div
      v-if="validateInfos?.colOptions?.help?.[0]?.[0]"
      class="text-error text-[10px] mb-1 mt-2"
      :class="{
        'pl-1': isKanbanStack,
      }"
    >
      {{ validateInfos.colOptions.help[0][0] }}
    </div>
    <div
      v-if="!isKanbanStack"
      class="nc-add-select-option-btn-wrapper flex shadow-sm"
      :class="{
        'mt-2': renderedOptions.length,
        'bg-white': isAiModeFieldModal,
      }"
    >
      <NcButton
        type="text"
        class="nc-add-select-option-btn flex-1 caption"
        size="small"
        data-testid="nc-add-select-option-btn"
        @click.stop="addNewOption()"
      >
        <template #icon>
          <component :is="iconMap.plus" />
        </template>

        {{ $t('labels.addOption') }}
      </NcButton>
      <NcTooltip v-if="isFeatureEnabled(FEATURE_FLAG.AI_FEATURES)" class="w-1/2">
        <template #title>
          {{
            aiIntegrationAvailable
              ? !vModel.title?.trim()
                ? $t('tooltip.fieldNameIsRequriedToAutoSuggestOptions')
                : $t('tooltip.autoSuggestSelectOptions')
              : $t('title.noAiIntegrationAvailable')
          }}
        </template>

        <NcButton
          type="secondary"
          theme="ai"
          class="nc-add-select-option-auto-suggest w-full caption"
          size="small"
          :bordered="false"
          :disabled="isLoadingPredictOptions || !vModel.title?.trim() || !aiIntegrationAvailable"
          :loading="isLoadingPredictOptions"
          @click.stop="predictOptions()"
        >
          <template #icon>
            <GeneralIcon icon="ncAutoAwesome" class="h-4 w-4" />
          </template>
          <template #loading> {{ $t('labels.suggesting') }} </template>
          {{ $t('labels.autoSuggest') }}
        </NcButton>
      </NcTooltip>
    </div>
    <div v-else-if="!kanbanStackOption?.id" class="mt-2 pl-1">
      <NcTooltip v-if="isFeatureEnabled(FEATURE_FLAG.AI_FEATURES)" class="w-full" placement="bottom">
        <template #title>
          {{ aiIntegrationAvailable ? $t('tooltip.autoSuggestSelectOptions') : $t('title.noAiIntegrationAvailable') }}
        </template>

        <NcButton
          type="secondary"
          theme="ai"
          class="nc-add-select-option-auto-suggest caption w-full"
          size="small"
          :disabled="isLoadingPredictOptions || !aiIntegrationAvailable"
          :loading="isLoadingPredictOptions"
          @click.stop="predictOptions()"
        >
          <template #icon>
            <GeneralIcon icon="ncAutoAwesome" class="h-4 w-4" />
          </template>
          <template #loading> {{ $t('labels.suggesting') }} </template>
          {{ $t('labels.autoSuggest') }}
        </NcButton>
      </NcTooltip>
    </div>
  </div>
</template>

<style scoped>
.removed {
  position: relative;
}
.removed:after {
  position: absolute;
  left: 0;
  top: 50%;
  height: 1px;
  background: #ccc;
  content: '';
  width: calc(100% + 5px);
  display: block;
}

:deep(.nc-select-col-option-select-option) {
  @apply !truncate;

  &:not(.nc-kanban-stack-input):not(:focus):hover {
    @apply !border-transparent;
  }

  &:not(.nc-kanban-stack-input):not(:focus) {
    @apply !border-transparent;
  }

  &:focus,
  &:focus-visible {
    @apply !border-[var(--ant-primary-color-hover)];
  }
}

.nc-add-select-option-btn-wrapper {
  @apply border-1 border-nc-border-gray-medium rounded-lg overflow-hidden;

  .nc-add-select-option-btn {
    @apply rounded-none;
  }
  .nc-add-select-option-auto-suggest {
    @apply -my-[1px] h-[34px] rounded-none !border-l-1 !border-l-nc-border-gray-medium;
  }
}
</style>
