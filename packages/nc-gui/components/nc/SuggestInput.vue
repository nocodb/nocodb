<script setup lang="ts">
/**
 * A single-line input with a grouped, keyboard-navigable suggestion list that
 * never takes the field away from the user: whatever is typed is the value,
 * and the suggestions are an aid.
 *
 * Interaction is modelled on the workflow variable picker
 * (`WorkflowVariablePicker.vue`) — grouped items, arrow keys to move, Enter to
 * take, Escape to dismiss. What it deliberately does NOT inherit is that
 * picker's TipTap host: `WorkflowInput` exists to compose one string out of
 * several inline mentions plus surrounding text, so its value is a rich
 * document. This is for a single scalar that is picked or typed, where a
 * rich-text editor would both be far heavier and permit `prefix{{x}}suffix`
 * that the caller would then have to validate back out.
 *
 * Generic on purpose — it knows nothing about what it is completing. Feed it
 * `options` (or `groups`) and it will complete anything.
 */
interface SuggestOption {
  value: string
  label?: string
  /** Secondary line, e.g. what a value means. */
  description?: string
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
  /** A value outside the list is valid. Off makes this a filterable select. */
  allowFreeText?: boolean
  emptyText?: string
  inputClass?: string
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
})

const emits = defineEmits<{
  (event: 'update:modelValue', value: string): void
  /** Every keystroke, so an async source can refill `options`. */
  (event: 'search', value: string): void
  (event: 'select', option: SuggestOption): void
}>()

const { t } = useI18n()

const wrapper = ref<HTMLElement>()

const isOpen = ref(false)

const activeIndex = ref(0)

// The typed text, which is the value. Kept separate from `modelValue` so a
// parent echoing the same value back does not fight the caret.
const query = ref(props.modelValue ?? '')

/**
 * One flat list, with the group each option came from. Flattening up front
 * keeps arrow-key movement a single index rather than a (group, option) pair —
 * the picker this borrows from needs the pair because it drills INTO a group;
 * here every option is reachable at one level.
 */
const flatOptions = computed<(SuggestOption & { group?: string })[]>(() => {
  const fromGroups = props.groups.flatMap((group) => group.options.map((option) => ({ ...option, group: group.label })))

  return [...props.options, ...fromGroups]
})

const filtered = computed(() => {
  const needle = query.value.trim().toLowerCase()

  if (!needle) return flatOptions.value

  return flatOptions.value.filter((option) => `${option.label ?? option.value}`.toLowerCase().includes(needle))
})

/** Rendered as headed sections only when the caller supplied groups. */
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

function choose(option: SuggestOption) {
  commit(option.value)
  emits('select', option)
  close()
}

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value

  commit(value)
  emits('search', value)

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

    // Only swallow Enter when it is actually taking a suggestion, so the key
    // still submits the surrounding form in every other case.
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

function onBlur() {
  // Without free text the field is a filterable select, so anything that is not
  // an option is discarded rather than silently kept.
  if (!props.allowFreeText && !flatOptions.value.some((option) => option.value === query.value)) {
    commit('')
  }
}

onClickOutside(wrapper, close)

watch(
  () => props.modelValue,
  (value) => {
    if ((value ?? '') !== query.value) query.value = value ?? ''
  },
)

// A refilled list invalidates wherever the highlight was pointing.
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
      @focus="open"
      @blur="onBlur"
      @keydown="onKeyDown"
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
            :key="option.value"
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

    <!-- Only shown once something has been typed: an empty list on an untouched
         field is the normal state for a source that has nothing to offer, and
         saying so would read as an error. -->
    <div
      v-else-if="isOpen && query && !hasSuggestions"
      class="nc-suggest-input-menu absolute z-50 mt-1 w-full rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-default px-3 py-2 text-bodySm text-nc-content-gray-muted shadow-lg"
      data-testid="nc-suggest-input-empty"
    >
      {{ resolvedEmptyText }}
    </div>
  </div>
</template>
