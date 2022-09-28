<script setup lang="ts">
import Draggable from 'vuedraggable'
import { UITypes } from 'nocodb-sdk'
import { enumColor, onMounted, useColumnCreateStoreOrThrow, useVModel, watch } from '#imports'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const { setAdditionalValidations, validateInfos } = useColumnCreateStoreOrThrow()

let options = $ref<any[]>([])
const colorMenus = $ref<any>({})
const colors = $ref(enumColor.light)
const inputs = ref()

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
  options.splice(index, 1)
}

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
})

// focus last created input
watch(inputs, () => {
  if (inputs.value?.$el) {
    inputs.value.$el.focus()
  }
})
</script>

<template>
  <div class="w-full">
    <Draggable :list="options" item-key="id" handle=".nc-child-draggable-icon">
      <template #item="{ element, index }">
        <div class="flex py-1 items-center">
          <MdiDragVertical small class="nc-child-draggable-icon handle" />

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
            <MdiArrowDownDropCircle :style="{ 'font-size': '1.5em', 'color': element.color }" class="mr-2" />
          </a-dropdown>

          <a-input ref="inputs" v-model:value="element.title" class="caption" />

          <MdiClose class="ml-2" :style="{ color: 'red' }" @click="removeOption(index)" />
        </div>
      </template>
      <template #footer>
        <div v-if="validateInfos?.['colOptions.options']?.help?.[0]?.[0]" class="text-error text-[10px] my-2">
          {{ validateInfos['colOptions.options'].help[0][0] }}
        </div>

        <a-button type="dashed" class="w-full caption mt-2" @click="addNewOption()">
          <div class="flex items-center">
            <MdiPlus />
            <span class="flex-auto">Add option</span>
          </div>
        </a-button>
      </template>
    </Draggable>
  </div>
</template>
