<script setup lang="ts">
import { parse } from 'papaparse'
import { ScriptInputType } from '~/lib/enum'
import { type DynamicInputProps } from '~/lib/types'

const props = defineProps<DynamicInputProps>()

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
  if (content.value.type === ScriptInputType.SELECT && newValue) {
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
    if (props.content.type !== ScriptInputType.FILE) {
      return false
    }

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
            return false
          }

          parsedContents = results.data

          if (props.content?.hasHeaderRow) {
            // Extract headers from the first row
            const headers = results.data[0]
            // Transform remaining rows into array of key-value pairs
            parsedContents = results.data.slice(1).map((row) => {
              const rowObj = {}
              headers.forEach((header, index) => {
                if (header) {
                  // Only use non-empty headers
                  rowObj[header] = row[index]
                }
              })
              return rowObj
            })
          } else {
            // If no header row, keep as array of arrays
            parsedContents = results.data
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
        parsedContents: null,
        errorMessage: 'This file type is not supported',
      })
    }
    return false
  } catch (e) {
    console.error(e)
    resolveInput({ file, parsedContents: null })
  }
}

const rowInput = ref()

watch(
  rowInput,
  (newValue) => {
    if (newValue) {
      resolveInput(newValue)
    }
  },
  { immediate: true },
)
</script>

<template>
  <template v-if="content.type === ScriptInputType.TEXT">
    <div class="flex flex-col gap-2">
      <label class="text-caption text-nc-content-gray-subtle2">{{ content.label }}</label>
      <a-input
        v-model:value="inputValue"
        type="text"
        :disabled="isResolved"
        class="nc-input-sm nc-input-shadow"
        @keydown.enter="onChange"
      />
      <NcButton v-if="!isResolved" type="primary" size="small" :disabled="!inputValue" @click="onChange">
        <div class="flex gap-2 items-center">
          Next
          <div
            :class="{
              '!bg-nc-bg-gray-extralight': !inputValue,
            }"
            class="px-1 py-0.5 bg-brand-600 transition-all rounded-md"
          >
            <GeneralIcon
              :class="{
                '!text-gray-300': !inputValue,
              }"
              class="transition-all"
              icon="ncEnter"
            />
          </div>
        </div>
      </NcButton>
    </div>
  </template>

  <template v-else-if="content.type === ScriptInputType.SELECT">
    <div class="flex flex-col gap-2">
      <label class="text-caption text-nc-content-gray-subtle2">{{ content.label }}</label>
      <a-select v-model:value="inputValue" :disabled="isResolved" class="nc-select-shadow" show-search @change="onChange">
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

  <template v-else-if="content.type === ScriptInputType.BUTTONS">
    <div class="flex flex-col gap-2">
      <label class="text-caption text-nc-content-gray-subtle2">{{ content.label }}</label>
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

  <template v-else-if="content.type === ScriptInputType.FILE">
    <div class="flex flex-col gap-2">
      <label class="text-caption text-nc-content-gray-subtle2">
        {{ content.label }}
      </label>
      <a-upload :accept="content.accept" :disabled="isResolved" :multiple="false" :before-upload="handleFileUpload">
        <NcButton v-if="!isResolved" size="small" :disabled="isResolved" type="secondary">Click to Upload</NcButton>
        <template #itemRender="{ file }">
          <div v-if="file" class="border-1 border-nc-border-gray-medium bg-white flex items-center pl-1 py-2 pr-4 rounded-xl">
            <CellAttachmentIconView class="w-10 h-10" :item="{ title: file.name, mimetype: file.type }" />
            <div class="flex flex-col flex-1">
              <div class="text-caption text-nc-content-gray">
                <NcTooltip class="!max-w-[200px] truncate" show-on-truncate-only>
                  {{ file.name }}
                  <template #title>
                    {{ file.name }}
                  </template>
                </NcTooltip>
              </div>
              <div class="text-caption text-nc-content-gray-muted">
                {{ formatBytes(file.size) }}
              </div>
            </div>
          </div>
        </template>
      </a-upload>
    </div>
  </template>

  <template v-else-if="content.type === ScriptInputType.TABLE">
    <div class="flex flex-col gap-2">
      <label class="text-caption text-nc-content-gray-subtle2">{{ content.label }}</label>
      <NcListTableSelector v-model:value="inputValue" disable-label :disabled="isResolved" @update:value="resolveInput" />
    </div>
  </template>
  <template v-else-if="content.type === ScriptInputType.VIEW">
    <div class="flex flex-col gap-2">
      <label class="text-caption text-nc-content-gray-subtle2">{{ content.label }}</label>
      <NcListViewSelector
        v-model:value="inputValue"
        disable-label
        :table-id="content.tableId"
        :disabled="isResolved"
        @update:value="resolveInput"
      />
    </div>
  </template>
  <template v-else-if="content.type === ScriptInputType.FIELD">
    <div class="flex flex-col gap-2">
      <label class="text-caption text-nc-content-gray-subtle2">{{ content.label }}</label>
      <NcListColumnSelector
        v-model:value="inputValue"
        disable-label
        :table-id="content.tableId"
        :disabled="isResolved"
        @update:value="resolveInput"
      />
    </div>
  </template>
  <template v-else-if="content.type === ScriptInputType.RECORD">
    <div class="flex flex-col gap-2">
      <label class="text-caption text-nc-content-gray-subtle2">{{ content.label }}</label>
      <NRecordPicker
        v-model:model-value="rowInput"
        :fields="content.options.fields"
        version="v3"
        :disabled="isResolved"
        :records="content.records"
        :table-id="content.tableId"
        :view-id="content.viewId"
      />
    </div>
  </template>
</template>
