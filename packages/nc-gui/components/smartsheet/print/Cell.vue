<script setup lang="ts">
import DOMPurify from 'isomorphic-dompurify'
import {
  type ColumnType,
  type TableType,
  UITypes,
  isNumericFieldType,
  isRichText,
  isSmartText,
  isValidHexColour,
} from 'nocodb-sdk'
import { NcMarkdownParser } from '~/helpers/tiptap'

interface Props {
  column: ColumnType
  modelValue: any
}

const props = defineProps<Props>()

const { t } = useI18n()

const { metas } = useMetas()

const meta = inject(MetaInj, ref())

const baseStore = useBase()

const { basesUser } = storeToRefs(useBases())

const { getColor } = useTheme()

const sqlUi = computed(() => baseStore.getSqlUiBySourceId(props.column.source_id))

const columnMeta = computed(() => parseProp(props.column.meta))

const kind = computed(() => {
  const { uidt } = props.column

  if (isRichText(props.column) || isSmartText(props.column)) return 'richText'
  if (uidt === UITypes.SingleSelect || uidt === UITypes.MultiSelect) return 'select'
  if (uidt === UITypes.User || uidt === UITypes.CreatedBy || uidt === UITypes.LastModifiedBy) return 'user'
  if (uidt === UITypes.Checkbox) return 'checkbox'
  if (uidt === UITypes.Rating) return 'rating'
  if (uidt === UITypes.Email || uidt === UITypes.URL || uidt === UITypes.PhoneNumber) return 'link'
  if (uidt === UITypes.LinkToAnotherRecord) return 'records'
  if (uidt === UITypes.Button) return 'button'
  if (uidt === UITypes.Colour) return 'colour'

  return 'text'
})

const isNumeric = computed(
  () =>
    kind.value === 'text' &&
    ![UITypes.Year, UITypes.AutoNumber].includes(props.column.uidt as UITypes) &&
    (isNumericFieldType(props.column, sqlUi.value?.getAbstractType(props.column)) ||
      [UITypes.Rollup, UITypes.Count].includes(props.column.uidt as UITypes)),
)

const isEmpty = computed(() => props.modelValue === null || props.modelValue === undefined || props.modelValue === '')

const selectOptions = computed(() => {
  if (kind.value !== 'select' || isEmpty.value) return []

  const values = Array.isArray(props.modelValue) ? props.modelValue : String(props.modelValue).split(',')
  const options = (props.column.colOptions as { options?: { title?: string; color?: string }[] })?.options ?? []

  return values.map((value: string) => {
    const color = options.find((option) => option.title === value)?.color ?? '#e7e7e9'
    return { title: value, color, textColor: getSelectTypeOptionTextColor(color, getColor, true) }
  })
})

const users = computed(() => {
  if (kind.value !== 'user' || isEmpty.value) return []

  const baseUsers = basesUser.value.get(props.column.base_id!) ?? []
  const values = Array.isArray(props.modelValue)
    ? props.modelValue
    : typeof props.modelValue === 'string'
    ? props.modelValue.split(',').map((id) => ({ id, email: id }))
    : [props.modelValue]

  return values.map((value: { id?: string; email?: string }) => {
    const user = baseUsers.find((u: { id?: string; email?: string }) => u.id === value.id || u.email === value.email) ?? value
    return extractUserDisplayNameOrEmail(user)
  })
})

const records = computed(() => {
  if (kind.value !== 'records' || isEmpty.value) return []

  return (Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue])
    .map((record) => plainValue(record))
    .filter(Boolean)
})

const ratingIcons = computed(() => {
  const max = columnMeta.value.max ?? 5
  return Math.min(Math.max(0, Number(props.modelValue) || 0), max)
})

const richTextHtml = computed(() => {
  if (kind.value !== 'richText' || isEmpty.value) return ''

  return DOMPurify.sanitize(NcMarkdownParser.parse(String(props.modelValue), { enableMention: true }))
})

const linkHref = computed(() => {
  if (kind.value !== 'link' || isEmpty.value) return undefined

  const value = String(props.modelValue).trim()
  if (props.column.uidt === UITypes.Email) return `mailto:${value}`
  if (props.column.uidt === UITypes.PhoneNumber) return `tel:${value.replace(/[^\d+]/g, '')}`

  // As in the grid: a value without a scheme (even with a port, `example.com:8080`) links over https.
  const url = addMissingUrlSchma(value)
  return /^https?:/i.test(url) ? url : undefined
})

// Like the grid: a swatch and the hex code, unless the field shows only one of them.
const colour = computed(() => {
  if (kind.value !== 'colour' || isEmpty.value) return null

  const hex = String(props.modelValue).trim()
  const format = columnMeta.value.displayFormat
  return {
    hex: hex.toUpperCase(),
    showSwatch: format !== 'hex_only' && isValidHexColour(hex),
    showHex: format !== 'swatch_only',
    radius: columnMeta.value.swatchStyle === 'square' ? '3px' : '50%',
  }
})

const button = computed(() => {
  if (kind.value !== 'button') return null

  const options = (props.column.colOptions ?? {}) as { label?: string; theme?: string; color?: string }
  const theme = options.theme || 'solid'
  const url = typeof props.modelValue?.url === 'string' ? addMissingUrlSchma(props.modelValue.url) : ''
  const href = /^https?:/i.test(url) ? url : undefined

  // The field's colour, as the grid paints it. Entries that are theme variables (brand, gray) would
  // resolve to dark-theme values on the white page, so those keep the print classes instead.
  const colours = (buttonColorMap as Record<string, Record<string, { base: { background: string; text: string } }>>)[theme]?.[
    options.color ?? ''
  ]?.base
  const style =
    colours && !colours.background.startsWith('var(') && !colours.text.startsWith('var(')
      ? { backgroundColor: colours.background, color: colours.text }
      : undefined

  return { label: options.label || props.modelValue?.label || '', theme, href, style }
})

function plainValue(value: any) {
  return parsePlainCellValue(value, {
    col: props.column,
    abstractType: sqlUi.value?.getAbstractType(props.column),
    meta: meta.value as TableType,
    metas: metas.value,
    baseUsers: basesUser.value,
    isMysql: baseStore.isMysql,
    isXcdbBase: baseStore.isXcdbBase,
    t,
  })
}
</script>

<template>
  <div
    class="nc-print-cell"
    :class="[`nc-print-cell-${kind}`, { 'nc-print-cell-numeric': isNumeric }]"
    :data-testid="`nc-print-cell-${kind}`"
  >
    <template v-if="isEmpty" />
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div v-else-if="kind === 'richText'" class="nc-print-cell-rich" v-html="richTextHtml" />
    <template v-else-if="kind === 'select'">
      <span
        v-for="(option, index) in selectOptions"
        :key="index"
        class="nc-print-chip"
        :style="{ backgroundColor: option.color, color: option.textColor }"
      >
        {{ option.title }}
      </span>
    </template>
    <template v-else-if="kind === 'user'">
      <span v-for="(name, index) in users" :key="index" class="nc-print-chip nc-print-chip-user">{{ name }}</span>
    </template>
    <template v-else-if="kind === 'records'">
      <span v-for="(title, index) in records" :key="index" class="nc-print-chip nc-print-chip-record">{{ title }}</span>
    </template>
    <span v-else-if="kind === 'checkbox'" :style="{ color: columnMeta.color }">
      {{ getCheckBoxValue(props.modelValue) ? '✔' : '' }}
    </span>
    <span v-else-if="kind === 'rating'" class="nc-print-cell-stars" :style="{ color: columnMeta.color ?? '#fcb401' }">
      {{ '★'.repeat(ratingIcons) }}
    </span>
    <a
      v-else-if="kind === 'link' && linkHref"
      class="nc-print-cell-link"
      :href="linkHref"
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ plainValue(props.modelValue) }}
    </a>
    <span v-else-if="kind === 'link'" class="nc-print-cell-link">{{ plainValue(props.modelValue) }}</span>
    <span v-else-if="kind === 'colour' && colour" class="nc-print-cell-colour-value">
      <span
        v-if="colour.showSwatch"
        class="nc-print-cell-swatch"
        :style="{ backgroundColor: colour.hex, borderRadius: colour.radius }"
      />
      <span v-if="colour.showHex">{{ colour.hex }}</span>
    </span>
    <template v-else-if="kind === 'button'">
      <a
        v-if="button?.href"
        class="nc-print-button"
        :class="`nc-print-button-${button.theme}`"
        :style="button.style"
        :href="button.href"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ button.label }}
      </a>
      <span v-else-if="button?.label" class="nc-print-button" :class="`nc-print-button-${button.theme}`" :style="button.style">{{
        button.label
      }}</span>
    </template>
    <SmartsheetPlainCell v-else :column="props.column" :model-value="props.modelValue" />
  </div>
</template>
