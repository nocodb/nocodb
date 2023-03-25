<script setup lang="ts">
import Draggable from 'vuedraggable'
import { UITypes } from 'nocodb-sdk'
import { IsKanbanInj, enumColor, iconMap, onMounted, storeToRefs, useColumnCreateStoreOrThrow, useVModel, watch } from '#imports'

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

const { formState, setAdditionalValidations, validateInfos, isPg, isMysql } = useColumnCreateStoreOrThrow()

const { project } = storeToRefs(useProject())

const { $api } = useNuxtApp()

const loadMagic = ref(false)

let options = $ref<(Option & { status?: 'remove' })[]>([])
let renderedOptions = $ref<(Option & { status?: 'remove' })[]>([])
let savedDefaultOption = $ref<Option | null>(null)
let savedCdf = $ref<string | null>(null)

const colorMenus = $ref<any>({})

const colors = $ref(enumColor.light)

const inputs = ref()
const defaultOption = ref()

const isKanban = inject(IsKanbanInj, ref(false))

const validators = {
  'colOptions.options': [
    {
      validator: (_: any, _opt: any) => {
        return new Promise<void>((resolve, reject) => {
          for (const opt of options) {
            if ((opt as any).status === 'remove') continue

            if (!opt.title.length) {
              return reject(new Error("Select options can't be null"))
            }
            if (vModel.value.uidt === UITypes.MultiSelect && opt.title.includes(',')) {
              return reject(new Error("MultiSelect columns can't have commas(',')"))
            }
            if (options.filter((el) => el.title === opt.title && (el as any).status !== 'remove').length > 1) {
              return reject(new Error("Select options can't have duplicates"))
            }
          }
          resolve()
        })
      },
    },
  ],
}

setAdditionalValidations({
  ...validators,
})

onMounted(() => {
  if (!vModel.value.colOptions?.options) {
    vModel.value.colOptions = {
      options: [],
    }
  }
  options = vModel.value.colOptions.options

  renderedOptions = [...options]

  // Support for older options
  for (const op of options.filter((el) => el.order === null)) {
    op.title = op.title.replace(/^'/, '').replace(/'$/, '')
  }

  if (vModel.value.cdf) {
    // Postgres returns default value wrapped with single quotes & casted with type so we have to get value between single quotes to keep it unified for all databases
    if (isPg.value) {
      vModel.value.cdf = vModel.value.cdf.substring(vModel.value.cdf.indexOf(`'`) + 1, vModel.value.cdf.lastIndexOf(`'`))
    }

    // Mysql escapes single quotes with backslash so we keep quotes but others have to unescaped
    if (!isMysql.value) {
      vModel.value.cdf = vModel.value.cdf.replace(/''/g, "'")
    }
  }

  const fndDefaultOption = options.find((el) => el.title === vModel.value.cdf)
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
  let tempColor = colors[0]
  if (options.length && options[options.length - 1].color) {
    const lastColor = colors.indexOf(options[options.length - 1].color)
    tempColor = colors[(lastColor + 1) % colors.length]
  }
  return tempColor
}

const addNewOption = () => {
  const tempOption = {
    title: '',
    color: getNextColor(),
  }
  renderedOptions.push(tempOption)
  options.push(tempOption)
}

const optionsMagic = async () => {
  if (loadMagic.value) return
  try {
    loadMagic.value = true
    const res: Array<string> = await $api.utils.magic({
      operation: 'selectOptions',
      data: {
        schema: project.value?.title,
        title: formState.value?.title,
        table: formState.value?.table_name,
      },
    })

    if (res.length) {
      for (const op of res) {
        const option = {
          title: op,
          color: getNextColor(),
        }
        options.push(option)
        renderedOptions.push(option)
      }
    }
  } catch (e) {
    message.warning('NocoAI: Underlying GPT API are busy. Please try after sometime.')
  }
  loadMagic.value = false
}

const syncOptions = () => {
  vModel.value.colOptions.options = renderedOptions.filter((op) => op.status !== 'remove')
}

const removeRenderedOption = (index: number) => {
  renderedOptions[index].status = 'remove'
  syncOptions()

  const optionId = renderedOptions[index]?.id

  if (optionId === defaultOption.value?.id) {
    savedDefaultOption = { ...defaultOption.value }
    savedCdf = vModel.value.cdf
    defaultOption.value = null
    vModel.value.cdf = null
  }
}

const undoRemoveRenderedOption = (index: number) => {
  renderedOptions[index].status = undefined
  syncOptions()

  const optionId = renderedOptions[index]?.id

  if (optionId === savedDefaultOption?.id) {
    defaultOption.value = { ...savedDefaultOption }
    vModel.value.cdf = savedCdf
    savedDefaultOption = null
    savedCdf = null
  }
}

// focus last created input
watch(inputs, () => {
  if (inputs.value?.$el) {
    inputs.value.$el.focus()
  }
})
</script>

<template>
  <div class="w-full">
    <div class="max-h-[250px] overflow-x-auto scrollbar-thin-dull pr-3">
      <Draggable :list="renderedOptions" item-key="id" handle=".nc-child-draggable-icon" @change="syncOptions">
        <template #item="{ element, index }">
          <div class="flex p-1 items-center nc-select-option">
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
                    @update:model-value="colorMenus[index] = false"
                  />
                </template>
                <MdiArrowDownDropCircle
                  class="mr-2 text-[1.5em] outline-0 hover:!text-[1.75em]"
                  :class="{ 'text-[1.75em]': colorMenus[index] }"
                  :style="{ color: element.color }"
                />
              </a-dropdown>

              <a-input
                ref="inputs"
                v-model:value="element.title"
                class="caption"
                :data-testid="`select-column-option-input-${index}`"
                :disabled="element.status === 'remove'"
                @keydown.enter.prevent="element.title?.trim() && addNewOption()"
                @change="optionChanged(element.id)"
              />
            </div>

            <component
              :is="iconMap.close"
              v-if="element.status !== 'remove'"
              class="ml-2 hover:!text-black-500 text-gray-500 cursor-pointer"
              :data-testid="`select-column-option-remove-${index}`"
              @click="removeRenderedOption(index)"
            />

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

    <div v-if="validateInfos?.['colOptions.options']?.help?.[0]?.[0]" class="text-error text-[10px] mb-1 mt-2">
      {{ validateInfos['colOptions.options'].help[0][0] }}
    </div>
    <a-button type="dashed" class="w-full caption mt-2" @click="addNewOption()">
      <div class="flex items-center">
        <component :is="iconMap.plus" />
        <span class="flex-auto">Add option</span>
      </div>
    </a-button>
    <div class="w-full cursor-pointer" @click="optionsMagic()">
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
