<script lang="ts">
/** `$attrs` go to the inner `<input>`, not the root. */
export default { inheritAttrs: false }
</script>

<script setup lang="ts">
/**
 * A single-line input with grouped, keyboard-navigable suggestions. What is
 * typed is the value; suggestions are an aid.
 */
interface SuggestOption {
  value: string
  label?: string
  /** Secondary line, e.g. what a value means. */
  description?: string
  /**
   * Splice over `[from, to)` instead of replacing the field, for completing one
   * segment. `done` closes the menu instead of reopening it.
   */
  replace?: { from: number; to: number; text?: string; caret?: number; done?: boolean }
}

interface SuggestGroup {
  key: string
  label: string
  options: SuggestOption[]
}

interface Props {
  modelValue?: string
  options?: SuggestOption[]
  groups?: SuggestGroup[]
  placeholder?: string
  loading?: boolean
  disabled?: boolean
  readOnly?: boolean
  /** A value outside the list is valid. */
  allowFreeText?: boolean
  emptyText?: string
  inputClass?: string
  /** Off when the caller already narrowed `options`. */
  filter?: boolean
  /** Off when an empty list is a normal state. */
  showEmpty?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  options: () => [],
  groups: () => [],
  placeholder: undefined,
  loading: false,
  disabled: false,
  readOnly: false,
  allowFreeText: true,
  emptyText: undefined,
  inputClass: undefined,
  filter: true,
  showEmpty: true,
})

const emits = defineEmits<{
  (event: 'update:modelValue', value: string): void
  /** Every keystroke and caret move. */
  (event: 'search', value: string, caret: number): void
  (event: 'select', option: SuggestOption): void
}>()

const { t } = useI18n()

const wrapper = ref<HTMLElement>()

const isOpen = ref(false)

const activeIndex = ref(0)

// Separate from `modelValue` so an echoed value does not fight the caret.
const query = ref(props.modelValue ?? '')

const flatOptions = computed<(SuggestOption & { group?: string })[]>(() => {
  const fromGroups = props.groups.flatMap((group) => group.options.map((option) => ({ ...option, group: group.label })))

  return [...props.options, ...fromGroups]
})

const filtered = computed(() => {
  if (!props.filter) return flatOptions.value

  const needle = query.value.trim().toLowerCase()

  if (!needle) return flatOptions.value

  return flatOptions.value.filter((option) => `${option.label ?? option.value}`.toLowerCase().includes(needle))
})

const sections = computed(() => {
  const out: { label?: string; options: (SuggestOption & { index: number })[] }[] = []

  filtered.value.forEach((option, index) => {
    const label = option.group
    const last = out[out.length - 1]

    if (last && last.label === label) {
      last.options.push({ ...option, index })
    } else {
      out.push({ label, options: [{ ...option, index }] })
    }
  })

  return out
})

const hasSuggestions = computed(() => filtered.value.length > 0)

const resolvedEmptyText = computed(() => props.emptyText ?? t('labels.noResults'))

function open() {
  if (props.disabled || props.readOnly) return

  isOpen.value = true
  activeIndex.value = 0
}

function close() {
  isOpen.value = false
}

function commit(value: string) {
  query.value = value
  emits('update:modelValue', value)
}

function inputEl(): HTMLInputElement | null {
  return wrapper.value?.querySelector('input') ?? null
}

function caretOf(el: HTMLInputElement | null): number {
  return el?.selectionStart ?? query.value.length
}

function notifySearch() {
  emits('search', query.value, caretOf(inputEl()))
}

function choose(option: SuggestOption) {
  emits('select', option)

  if (!option.replace) {
    commit(option.value)
    close()
    return
  }

  // Segment mode: splice, place the caret, stay open for the next segment.
  const { from, to, caret } = option.replace
  const inserted = option.replace.text ?? option.value
  const next = query.value.slice(0, from) + inserted + query.value.slice(to)
  const position = caret ?? from + inserted.length

  commit(next)

  if (option.replace.done) close()

  nextTick(() => {
    const el = inputEl()
    el?.focus()
    el?.setSelectionRange(position, position)
    notifySearch()
  })
}

function onInput(event: Event) {
  const el = event.target as HTMLInputElement

  commit(el.value)
  emits('search', el.value, caretOf(el))

  open()
}

function move(delta: number) {
  if (!hasSuggestions.value) return

  const count = filtered.value.length
  activeIndex.value = (activeIndex.value + delta + count) % count
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (!isOpen.value) return open()
    return move(1)
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    return move(-1)
  }

  if (event.key === 'Enter') {
    if (!isOpen.value || !hasSuggestions.value) return

    // Only when taking a suggestion, so Enter still submits the form otherwise.
    event.preventDefault()
    event.stopPropagation()

    const option = filtered.value[activeIndex.value]
    if (option) choose(option)
    return
  }

  if (event.key === 'Escape') {
    if (!isOpen.value) return

    event.stopPropagation()
    close()
  }
}

function onFocus() {
  open()
  notifySearch()
}

const CARET_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End'])

function onCaretMove(event: Event) {
  if (event instanceof KeyboardEvent && !CARET_KEYS.has(event.key)) return
  notifySearch()
}

function onBlur() {
  if (!props.allowFreeText && !flatOptions.value.some((option) => option.value === query.value)) {
    commit('')
  }
}

onClickOutside(wrapper, close)

defineExpose({ focus: () => inputEl()?.focus() })

watch(
  () => props.modelValue,
  (value) => {
    if ((value ?? '') !== query.value) query.value = value ?? ''
  },
)

watch(filtered, () => {
  activeIndex.value = 0
})
</script>

<template>
  <div ref="wrapper" class="nc-suggest-input relative w-full">
    <a-input
      :value="query"
      :placeholder="placeholder"
      :disabled="disabled"
      :read-only="readOnly"
      :class="inputClass"
      v-bind="$attrs"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @keydown="onKeyDown"
      @keyup="onCaretMove"
      @click="onCaretMove"
    />

    <div
      v-if="isOpen && (hasSuggestions || loading)"
      class="nc-suggest-input-menu absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-default py-1 shadow-lg"
      data-testid="nc-suggest-input-menu"
    >
      <div v-if="loading" class="px-3 py-2 text-bodySm text-nc-content-gray-muted">
        {{ $t('general.loading') }}
      </div>

      <template v-else>
        <div v-for="section of sections" :key="section.label ?? '_'">
          <div v-if="section.label" class="px-3 pt-2 pb-1 text-captionSm uppercase text-nc-content-gray-muted">
            {{ section.label }}
          </div>

          <div
            v-for="option of section.options"
            :key="option.index"
            class="nc-suggest-input-option cursor-pointer px-3 py-1.5 text-bodySm"
            :class="option.index === activeIndex ? 'bg-nc-bg-gray-light' : ''"
            :data-testid="`nc-suggest-input-option-${option.value}`"
            @mouseenter="activeIndex = option.index"
            @mousedown.prevent="choose(option)"
          >
            <div class="truncate text-nc-content-gray">{{ option.label ?? option.value }}</div>
            <div v-if="option.description" class="truncate text-captionSm text-nc-content-gray-muted">
              {{ option.description }}
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Only once something is typed: an untouched empty list is normal. -->
    <div
      v-else-if="showEmpty && isOpen && query && !hasSuggestions"
      class="nc-suggest-input-menu absolute z-50 mt-1 w-full rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-default px-3 py-2 text-bodySm text-nc-content-gray-muted shadow-lg"
      data-testid="nc-suggest-input-empty"
    >
      {{ resolvedEmptyText }}
    </div>
  </div>
</template>
