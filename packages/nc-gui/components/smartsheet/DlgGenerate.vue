<script setup lang="ts">
import type { ColumnType, TableType } from 'nocodb-sdk'
import { UITypes, isSystemColumn } from 'nocodb-sdk'
import { ref, useNuxtApp, useVModel } from '#imports'

const props = defineProps<{
  modelValue: boolean
  target: { row: number; col: number }
  meta: any
  fields: any
  view: any
  data: any
  xWhere: any
}>()

const emit = defineEmits(['update:modelValue'])

const target = props.target
const meta = props.meta
const fields = props.fields
const view = props.view
const xWhere = props.xWhere
const data = props.data

const dialogShow = useVModel(props, 'modelValue', emit)

const { updateOrSaveRow } = useViewData(ref(meta), ref(view), ref(xWhere))

const { $api } = useNuxtApp()

const unsupportedColumnTypes: string[] = [UITypes.Rollup, UITypes.Lookup, UITypes.Formula, UITypes.QrCode, UITypes.SpecificDBType]

const supportedColumns = computed(
  () =>
    ((meta as TableType)?.columns || [])
      .filter((c: ColumnType) => !unsupportedColumnTypes.includes(c.uidt) && !isSystemColumn(c))
      .sort((a, b) => a.order! - b.order!) || [],
)

const suggestionsList = computed(() => {
  return [
    ...supportedColumns.value
      .filter((c: ColumnType) => {
        // skip system LTAR columns & system columns
        return !(c.uidt === UITypes.LinkToAnotherRecord && c.system)
      })
      .map((c: any) => ({
        text: c.title,
        type: 'column',
        icon: getUIDTIcon(c.uidt),
        uidt: c.uidt,
      })),
  ]
})

// set default suggestion list
const suggestion: Record<string, any> = ref(suggestionsList.value)

const prompt = ref('')

function getCurlyBracket() {
  const arr = prompt.value.match(/(?<=\{\{).*?(?=\}\})/g) || []
  if (arr.every((e) => supportedColumns.value.find((c) => c.title === e.trim()))) {
    return arr
  } else {
    const fl = arr.filter((e) => !supportedColumns.value.find((c) => c.title === e.trim()))
    message.warning(`Some of the columns are not supported/present: ${fl.join(', ')}`)
  }
}

function generateFullPrompt(rowObj: any) {
  let fullPrompt = prompt.value
  const arr = getCurlyBracket()
  if (arr) {
    arr.forEach((e) => {
      const column = supportedColumns.value.find((c) => c.title === e.trim())
      const row = rowObj
      const value = row.row[column.title]
      fullPrompt = fullPrompt.replace(`{{${e}}}`, value)
    })
  }
  return fullPrompt
}

async function save() {
  const rowObj = data[target.row]
  const columnObj = target.col !== undefined ? fields[target.col] : null

  const res: { data: string } = await $api.utils.magic({
    operation: 'generateSinglePrompt',
    data: {
      prompt: generateFullPrompt(rowObj),
    },
  })

  rowObj.row[columnObj.title] = res.data
  // update/save cell value
  await updateOrSaveRow(rowObj, columnObj.title)
  dialogShow.value = false
}

async function saveAll() {
  for (const rowObj of data) {
    const columnObj = target.col !== undefined ? fields[target.col] : null

    const res: { data: string } = await $api.utils.magic({
      operation: 'generateSinglePrompt',
      data: {
        prompt: generateFullPrompt(rowObj),
      },
    })

    rowObj.row[columnObj.title] = res.data
    // update/save cell value
    await updateOrSaveRow(rowObj, columnObj.title)
  }

  dialogShow.value = false
}

const loadMagic = ref(false)
</script>

<template>
  <a-modal
    v-model:visible="dialogShow"
    :class="{ active: dialogShow }"
    width="max(30vw, 600px)"
    centered
    wrap-class-name="nc-modal-table-create"
    @keydown.esc="dialogShow = false"
  >
    <template #footer>
      <a-button key="back" size="large" @click="dialogShow = false">{{ $t('general.cancel') }}</a-button>

      <a-button key="submit" size="large" type="primary" @click="saveAll()">Generate All</a-button>

      <a-button key="submit" size="large" type="primary" @click="save()">Generate</a-button>
    </template>

    <div class="flex prose-xl font-bold self-center items-center my-4">
      Generate Data Using NocoAI
      <GeneralIcon icon="magic" :class="{ 'nc-animation-pulse': loadMagic }" class="ml-2 text-orange-400" />
    </div>

    <div class="pl-2 pr-2">
      <a-textarea v-model:value="prompt" placeholder="Prompt using {{ column }}" :auto-size="{ minRows: 2, maxRows: 5 }" />
    </div>
  </a-modal>
</template>

<style scoped lang="scss">
.nc-table-advanced-options {
  max-height: 0;
  transition: 0.3s max-height;
  overflow: hidden;

  &.active {
    max-height: 200px;
  }
}
</style>
