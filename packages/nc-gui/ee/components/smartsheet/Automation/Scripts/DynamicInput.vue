<script setup lang="ts">
import { parse } from 'papaparse'
import { InputType } from './types'

const props = defineProps<{
  content: {
    type: InputType
    options:
      | { label: string; value: string; variant: string }[]
      | {
          fields: string[]
        }
    tableId?: string
    label?: string
    viewId?: string
    accept?: string
    records?: Record<string, any>[]
    hasHeaderRow?: boolean
    useRawValues?: boolean
  }
  onResolve: (
    value:
      | string
      | Record<string, any>
      | {
          file: File
          parsedContents: any
        },
  ) => void
}>()

const { content } = toRefs(props)

const inputValue = ref('')
const isResolved = ref(false)

const resolveInput = (value?: string | File) => {
  if (value !== undefined || inputValue.value) {
    isResolved.value = true
    props.onResolve(value !== undefined ? value : inputValue.value)
  }
}

watch(inputValue, (newValue) => {
  if (content.value.type === InputType.SELECT && newValue) {
    resolveInput()
  }
})

const onChange = () => {
  if (inputValue.value) {
    isResolved.value = true
    props.onResolve(inputValue.value)
  }
}

const handleFileUpload = async (file: File) => {
  try {
    let parsedContents = null

    if (file.name.endsWith('.csv')) {
      const text = await file.text()
      parse(text, {
        worker: true,
        dynamicTyping: !props.content?.useRawValues,
        complete: (results) => {
          if (results.errors.length) {
            console.error(results.errors)
            resolveInput({
              file,
              parsedContents: null,
            })
            return
          }

          parsedContents = results.data

          if (props.content?.hasHeaderRow) {
            parsedContents = parsedContents.slice(1)
          }
          resolveInput({
            file,
            parsedContents,
          })
        },
        error: (error) => {
          console.error(error)
          resolveInput({
            file,
            parsedContents: null,
          })
        },
      })
    } else if (file.type === 'application/json') {
      parsedContents = JSON.parse(await file.text())
      resolveInput({
        file,
        parsedContents,
      })
    } else if (file.type === 'text/plain') {
      parsedContents = await file.text()
      resolveInput({
        file,
        parsedContents,
      })
    } else {
      resolveInput({
        file,
        parsedContents,
      })
    }
  } catch (e) {
    console.error(e)
    resolveInput({ file, parsedContents: null })
  }
}

const rowInput = ref()

watch(rowInput, (newValue) => {
  if (newValue) {
    resolveInput(newValue)
  }
})
</script>

<template>
  <div class="dynamic-input mb-4">
    <template v-if="content.type === InputType.TEXT">
      <div class="flex flex-col gap-1">
        <label class="font-semibold text-nc-content-gray">{{ content.label }}</label>
        <a-input
          v-model:value="inputValue"
          type="text"
          :disabled="isResolved"
          class="nc-input-sm !w-96 nc-input-shadow"
          @keyup.enter="onChange"
        />
      </div>
    </template>

    <template v-else-if="content.type === InputType.SELECT">
      <div class="flex flex-col gap-1">
        <label class="font-semibold text-nc-content-gray">{{ content.label }}</label>
        <a-select v-model:value="inputValue" class="w-64" :disabled="isResolved" show-search @change="onChange">
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-700" />
          </template>

          <a-select-option v-for="option in content.options" :key="option" :value="option.value">
            <div class="flex gap-2 w-full justify-between items-center">
              {{ option.label }}
              <GeneralIcon
                v-if="inputValue === option.value"
                id="nc-selected-item-icon"
                icon="check"
                class="text-primary w-4 h-4"
              />
            </div>
          </a-select-option>
        </a-select>
      </div>
    </template>

    <template v-else-if="content.type === InputType.BUTTONS">
      <div class="flex flex-col gap-1">
        <label class="font-semibold text-nc-content-gray">{{ content.label }}</label>
        <div class="flex flex-wrap gap-2">
          <NcButton
            v-for="option in content.options"
            :key="option.value"
            :type="option.variant"
            size="small"
            :disabled="isResolved"
            @click="resolveInput(option.value ?? option.label)"
          >
            {{ option.label }}
          </NcButton>
        </div>
      </div>
    </template>

    <template v-else-if="content.type === InputType.FILE">
      <div class="flex flex-col gap-1">
        <label v-if="content?.label" class="font-semibold text-nc-content-gray">
          {{ content.label }}
        </label>
        <a-upload :accept="content.accept" :disabled="isResolved" :multiple="false" :before-upload="handleFileUpload">
          <NcButton :disabled="isResolved" type="secondary">Click to Upload</NcButton>
        </a-upload>
      </div>
    </template>

    <template v-else-if="content.type === InputType.TABLE">
      <div class="flex flex-col gap-1">
        <label v-if="content?.label" class="font-semibold text-nc-content-gray">
          {{ content.label }}
        </label>
        <NSelectTable class="w-64" :disabled="isResolved" @change="resolveInput" />
      </div>
    </template>
    <template v-else-if="content.type === InputType.VIEW">
      <div class="flex flex-col gap-2">
        <label v-if="content?.label" class="font-semibold text-nc-content-gray">
          {{ content.label }}
        </label>
        <NSelectView class="w-64" :table-id="content.tableId" :disabled="isResolved" @change="resolveInput" />
      </div>
    </template>
    <template v-else-if="content.type === InputType.FIELD">
      <div class="flex flex-col gap-2">
        <label v-if="content?.label" class="font-semibold text-nc-content-gray">
          {{ content.label }}
        </label>
        <NSelectField class="w-64" :table-id="content.tableId" :disabled="isResolved" @change="resolveInput" />
      </div>
    </template>
    <template v-else-if="content.type === InputType.RECORD">
      <div class="flex flex-col gap-2">
        <NRecordPicker
          v-model:model-value="rowInput"
          :fields="content.options.fields"
          class="w-64"
          :records="content.records"
          :table-id="content.tableId"
          :view-id="content.viewId"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.dynamic-input {
  @apply pl-1;
  display: flex;
  align-items: center;
}
</style>
