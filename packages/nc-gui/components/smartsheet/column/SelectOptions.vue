<script setup lang="ts">
import Draggable from 'vuedraggable'
import { UITypes } from 'nocodb-sdk'
import {
  IsKanbanInj,
  enumColor,
  iconMap,
  isEeUI,
  onMounted,
  storeToRefs,
  useColumnCreateStoreOrThrow,
  useVModel,
  watch,
} from '#imports'

interface Option {
  color: string
  title: string
  id?: string
  fk_colum_id?: string
  order?: number
}

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const { formState, setAdditionalValidations, validateInfos, isMysql } = useColumnCreateStoreOrThrow()

const { base } = storeToRefs(useBase())

const { loadMagic, optionsMagic: _optionsMagic } = useNocoEe()

const options = ref<(Option & { status?: 'remove' })[]>([])
const renderedOptions = ref<(Option & { status?: 'remove' })[]>([])
const savedDefaultOption = ref<Option | null>(null)
const savedCdf = ref<string | null>(null)

const colorMenus = ref<any>({})

const colors = ref(enumColor.light)

const inputs = ref()
const defaultOption = ref()

const isKanban = inject(IsKanbanInj, ref(false))

const { t } = useI18n()

const validators = {
  colOptions: [
    {
      type: 'object',
      fields: {
        options: {
          validator: (_: any, _opt: any) => {
            return new Promise<void>((resolve, reject) => {
              for (const opt of options.value) {
                if ((opt as any).status === 'remove') continue

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

onMounted(() => {
  if (!vModel.value.colOptions?.options) {
    vModel.value.colOptions = {
      options: [],
    }
  }

  options.value = vModel.value.colOptions.options

  renderedOptions.value = [...options.value]

  // Support for older options
  for (const op of options.value.filter((el) => el.order === null)) {
    op.title = op.title.replace(/^'/, '').replace(/'$/, '')
  }

  if (vModel.value.cdf) {
    // Mysql escapes single quotes with backslash so we keep quotes but others have to unescaped
    if (!isMysql.value) {
      vModel.value.cdf = vModel.value.cdf.replace(/''/g, "'")
    }
  }

  const fndDefaultOption = options.value.find((el) => el.title === vModel.value.cdf)
  if (fndDefaultOption) {
    defaultOption.value = fndDefaultOption
  }
})

const optionChanged = (changedId: string) => {
  if (changedId && changedId === defaultOption.value?.id) {
    vModel.value.cdf = defaultOption.value.title
  }
}

const getNextColor = () => {
  let tempColor = colors.value[0]
  if (options.value.length && options.value[options.value.length - 1].color) {
    const lastColor = colors.value.indexOf(options.value[options.value.length - 1].color)
    tempColor = colors.value[(lastColor + 1) % colors.value.length]
  }
  return tempColor
}

const addNewOption = () => {
  const tempOption = {
    title: '',
    color: getNextColor(),
  }
  renderedOptions.value.push(tempOption)
  options.value.push(tempOption)
}

const optionsMagic = async () => {
  await _optionsMagic(base, formState, getNextColor, options.value, renderedOptions.value)
}

const syncOptions = () => {
  vModel.value.colOptions.options = renderedOptions.value.filter((op) => op.status !== 'remove')
}

const removeRenderedOption = (index: number) => {
  renderedOptions.value[index].status = 'remove'
  syncOptions()

  const optionId = renderedOptions.value[index]?.id

  if (optionId === defaultOption.value?.id) {
    savedDefaultOption.value = { ...defaultOption.value }
    savedCdf.value = vModel.value.cdf
    defaultOption.value = null
    vModel.value.cdf = null
  }
}

const undoRemoveRenderedOption = (index: number) => {
  renderedOptions.value[index].status = undefined
  syncOptions()

  const optionId = renderedOptions.value[index]?.id

  if (optionId === savedDefaultOption.value?.id) {
    defaultOption.value = { ...savedDefaultOption.value }
    vModel.value.cdf = savedCdf.value
    savedDefaultOption.value = null
    savedCdf.value = null
  }
}

// focus last created input
watch(inputs, () => {
  if (inputs.value?.$el) {
    inputs.value.$el.focus()
  }
})

// Removes the Select Option from cdf if the option is removed
watch(vModel.value, (next) => {
  const cdfs = (next.cdf ?? '').split(',')
  const values = (next.colOptions.options ?? []).map((col) => {
    return col.title.replace(/^'/, '').replace(/'$/, '')
  })
  const newCdf = cdfs.filter((c: string) => values.includes(c)).join(',')
  next.cdf = newCdf.length === 0 ? null : newCdf
})
</script>

<template>
  <div class="w-full">
    <div class="max-h-[250px] overflow-x-auto scrollbar-thin-dull">
      <Draggable :list="renderedOptions" item-key="id" handle=".nc-child-draggable-icon" @change="syncOptions">
        <template #item="{ element, index }">
          <div class="flex py-1 items-center nc-select-option">
            <div
              class="flex items-center w-full"
              :data-testid="`select-column-option-${index}`"
              :class="{ removed: element.status === 'remove' }"
            >
              <component
                :is="iconMap.dragVertical"
                v-if="!isKanban"
                small
                class="nc-child-draggable-icon handle"
                :data-testid="`select-option-column-handle-icon-${element.title}`"
              />
              <a-dropdown
                v-model:visible="colorMenus[index]"
                :trigger="['click']"
                overlay-class-name="nc-dropdown-select-color-options"
              >
                <template #overlay>
                  <LazyGeneralColorPicker
                    v-model="element.color"
                    :pick-button="true"
                    @close-modal="colorMenus[index] = false"
                    @input="(el:string) => (element.color = el)"
                  />
                </template>
                <MdiArrowDownDropCircle
                  class="mr-2 text-[1.5em] outline-0 hover:!text-[1.75em] cursor-pointer"
                  :class="{ 'text-[1.75em]': colorMenus[index] }"
                  :style="{ color: element.color }"
                />
              </a-dropdown>

              <a-input
                ref="inputs"
                v-model:value="element.title"
                class="caption !rounded-lg"
                :data-testid="`select-column-option-input-${index}`"
                :disabled="element.status === 'remove'"
                @keydown.enter.prevent="element.title?.trim() && addNewOption()"
                @change="optionChanged(element.id)"
              />
            </div>

            <div
              v-if="element.status !== 'remove'"
              :data-testid="`select-column-option-remove-${index}`"
              class="ml-1 hover:!text-black-500 text-gray-500 cursor-pointer hover:bg-gray-50 py-1 px-1.5 rounded-md"
              @click="removeRenderedOption(index)"
            >
              <component :is="iconMap.close" class="-mt-0.25" />
            </div>

            <MdiArrowULeftBottom
              v-else
              class="ml-2 hover:!text-black-500 text-gray-500 cursor-pointer"
              :data-testid="`select-column-option-remove-undo-${index}`"
              @click="undoRemoveRenderedOption(index)"
            />
          </div>
        </template>
      </Draggable>
    </div>

    <div v-if="validateInfos?.colOptions?.help?.[0]?.[0]" class="text-error text-[10px] mb-1 mt-2">
      {{ validateInfos.colOptions.help[0][0] }}
    </div>
    <a-button type="dashed" class="w-full caption mt-2" @click="addNewOption()">
      <div class="flex items-center">
        <component :is="iconMap.plus" />
        <span class="flex-auto">Add option</span>
      </div>
    </a-button>
    <div v-if="isEeUI" class="w-full cursor-pointer" @click="optionsMagic()">
      <GeneralIcon icon="magic" :class="{ 'nc-animation-pulse': loadMagic }" class="w-full flex mt-2 text-orange-400" />
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
</style>
