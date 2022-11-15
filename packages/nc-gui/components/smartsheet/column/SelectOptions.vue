<script setup lang="ts">
import Draggable from 'vuedraggable'
import { UITypes } from 'nocodb-sdk'
import { IsKanbanInj, enumColor, onMounted, useColumnCreateStoreOrThrow, useVModel, watch } from '#imports'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const { isPg, isMysql } = useProject()

const { setAdditionalValidations, validateInfos } = useColumnCreateStoreOrThrow()

let options = $ref<any[]>([])

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
            if (!opt.title.length) {
              return reject(new Error("Select options can't be null"))
            }
            if (vModel.value.uidt === UITypes.MultiSelect && opt.title.includes(',')) {
              return reject(new Error("MultiSelect columns can't have commas(',')"))
            }
            if (options.filter((el) => el.title === opt.title).length !== 1) {
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

const optionDropped = (changedId: string) => {
  if (changedId && changedId === defaultOption.value?.id) {
    vModel.value.cdf = null
    defaultOption.value = null
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
  options.push(tempOption)
}

const removeOption = (index: number) => {
  const optionId = options[index]?.id
  options.splice(index, 1)
  optionDropped(optionId)
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
      <Draggable :list="options" item-key="id" handle=".nc-child-draggable-icon">
        <template #item="{ element, index }">
          <div class="flex py-1 items-center nc-select-option">
            <MdiDragVertical
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
              @change="optionChanged(element.id)"
            />

            <MdiClose
              class="ml-2 hover:!text-black"
              :style="{ color: 'red' }"
              :data-testid="`select-column-option-remove-${index}`"
              @click="removeOption(index)"
            />
          </div>
        </template>
        <template #footer>
          <div v-if="validateInfos?.['colOptions.options']?.help?.[0]?.[0]" class="text-error text-[10px] my-2">
            {{ validateInfos['colOptions.options'].help[0][0] }}
          </div>
        </template>
      </Draggable>
    </div>
    <a-button type="dashed" class="w-full caption mt-2" @click="addNewOption()">
      <div class="flex items-center">
        <MdiPlus />
        <span class="flex-auto">Add option</span>
      </div>
    </a-button>
  </div>
</template>
