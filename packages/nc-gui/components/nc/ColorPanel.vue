<script lang="ts" setup>
import tinycolor from 'tinycolor2'
import { themeV3Colors } from '../../utils/colorsUtils'

/**
 * Colour panel — hue rail + shade ramp (design handoff "direction 1b").
 *
 * Single panel, no tabs, no spectrum: pick a hue family, then a shade; a hex
 * field allows an exact value. The reachable palette is the product's fixed
 * 9x10 option palette (themeV3Colors), so picks always match chips rendered
 * elsewhere.
 */
interface Props {
  modelValue?: string | null
  /** Text for the live preview pill — falls back to the hex value. */
  previewLabel?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [color: string]
  /** Esc with no hex draft to revert — the host should close its dropdown. */
  'escape': []
}>()

const { t } = useI18n()

const { isDark, getColor } = useTheme()

const panelRef = ref<HTMLElement>()

/** Family order matches the legacy 9x10 grid so muscle memory carries over. */
const FAMILY_KEYS = ['gray', 'red', 'green', 'yellow', 'orange', 'pink', 'maroon', 'purple', 'blue'] as const

/** Row index shown on the hue rail — the family's representative (500) shade. */
const REPRESENTATIVE_SHADE = 5

const families = FAMILY_KEYS.map((key) => ({
  key,
  name: key.charAt(0).toUpperCase() + key.slice(1),
  // Gray carries an extra ultra-light 10 step — drop it so every ramp is 10 cells.
  shades: (key === 'gray' ? Object.values(themeV3Colors.gray).slice(1) : Object.values(themeV3Colors[key])) as string[],
}))

const familyIndex = ref(0)

const shadeIndex = ref(REPRESENTATIVE_SHADE)

/** Hex committed outside the palette — null means the colour derives from family + shade. */
const override = ref<string | null>(null)

/** Hex input text while typing — null mirrors the committed colour. */
const draft = ref<string | null>(null)

const currentColor = computed(() => override.value ?? families[familyIndex.value].shades[shadeIndex.value])

const pillLabel = computed(() => props.previewLabel?.trim() || currentColor.value.toUpperCase())

// The pill previews the option EXACTLY as product chips render — same bg/text
// helpers (dark-mode aware) — so what you see here is what the grid shows.
const pillBg = computed(() => getSelectTypeFieldOptionBgColor({ color: currentColor.value, isDark: isDark.value, getColor }))

const pillText = computed(() => getSelectTypeFieldOptionTextColor({ color: currentColor.value, isDark: isDark.value, getColor }))

const hexFieldValue = computed(() => draft.value ?? currentColor.value.toUpperCase())

function isLight(hex: string) {
  return tinycolor(hex).getBrightness() / 255 > 0.6
}

function contrastText(hex: string) {
  return isLight(hex) ? '#1C1C22' : '#FFFFFF'
}

function normalizeHex(value: string): string | null {
  const trimmed = value.trim().replace(/^#/, '')

  return /^[0-9a-f]{6}$/i.test(trimmed) ? `#${trimmed.toUpperCase()}` : null
}

/** Locate the value in the palette; unmatched values become an override. */
function syncFromValue(value?: string | null) {
  draft.value = null

  if (!value) {
    override.value = null
    return
  }

  for (const [fi, fam] of families.entries()) {
    const si = fam.shades.findIndex((shade) => shade.toLowerCase() === value.toLowerCase())
    if (si >= 0) {
      familyIndex.value = fi
      shadeIndex.value = si
      override.value = null
      return
    }
  }

  override.value = value
}

/** Hue pick keeps the current shade index — changes hue, not weight. */
function pickFamily(index: number) {
  familyIndex.value = index
  override.value = null
  draft.value = null

  emit('update:modelValue', currentColor.value)
}

function pickShade(index: number) {
  shadeIndex.value = index
  override.value = null
  draft.value = null

  emit('update:modelValue', currentColor.value)
}

function commitHex() {
  if (draft.value === null) return

  const hex = normalizeHex(draft.value)
  draft.value = null

  if (!hex) return

  syncFromValue(hex)
  emit('update:modelValue', hex)
}

/**
 * Esc handling — document-level CAPTURE while the panel is VISIBLE, because
 * focus often sits outside the panel (on the trigger chip) where a bubbling
 * handler would never fire and outer modals would swallow the key instead.
 * First Esc reverts an in-progress hex draft; otherwise the host is asked to
 * close just this popover (never the editor/modal underneath).
 *
 * Visibility is checked per keystroke, not assumed from mount: hosts render
 * the panel inside a dropdown overlay that ant keeps MOUNTED after close (it
 * only toggles `display`), so a closed popover would otherwise keep eating
 * Esc for the whole page. No client rects means display:none — let it pass.
 */
function onGlobalEscape(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (!panelRef.value?.getClientRects().length) return

  e.preventDefault()
  e.stopPropagation()

  if (draft.value !== null) {
    draft.value = null
    return
  }

  emit('escape')
}

useEventListener(document, 'keydown', onGlobalEscape, { capture: true })

/** Arrow-key navigation within a group of sibling buttons (hue dots / ramp cells). */
function moveFocus(e: KeyboardEvent, dir: 1 | -1) {
  const el = e.target as HTMLElement
  const sibling = (dir === 1 ? el.nextElementSibling : el.previousElementSibling) as HTMLElement | null

  sibling?.focus()
}

watch(() => props.modelValue, syncFromValue, { immediate: true })
</script>

<template>
  <div ref="panelRef" class="nc-color-panel" data-testid="nc-color-panel">
    <!-- Preview row: live option pill + editable hex field -->
    <div class="flex items-center gap-2.5">
      <div class="nc-color-panel-pill" :style="{ background: pillBg, color: pillText }" data-testid="nc-color-panel-pill">
        <span class="truncate">{{ pillLabel }}</span>
      </div>

      <div class="flex-1" />

      <div class="nc-color-panel-hex-field">
        <input
          :value="hexFieldValue"
          spellcheck="false"
          data-testid="nc-color-panel-hex-input"
          @input="draft = ($event.target as HTMLInputElement).value"
          @blur="commitHex"
          @keydown.enter.prevent=";($event.target as HTMLInputElement).blur()"
        />
      </div>
    </div>

    <!-- Hue rail -->
    <div class="flex flex-col gap-2">
      <div class="nc-color-panel-label">{{ t('general.hue') }}</div>
      <div class="nc-color-panel-hue-grid">
        <button
          v-for="(fam, i) in families"
          :key="fam.key"
          type="button"
          :title="fam.name"
          class="nc-color-panel-hue-dot"
          :class="{ 'nc-selected': i === familyIndex && !override }"
          :style="{ background: fam.shades[REPRESENTATIVE_SHADE] }"
          :data-testid="`nc-color-panel-hue-${fam.key}`"
          @click="pickFamily(i)"
          @keydown.right.prevent="moveFocus($event, 1)"
          @keydown.left.prevent="moveFocus($event, -1)"
        />
      </div>
    </div>

    <!-- Shade ramp -->
    <div class="flex flex-col gap-2">
      <div class="flex justify-between items-baseline">
        <span class="nc-color-panel-label">{{ t('general.shade') }}</span>
        <span class="nc-color-panel-hex-readout">{{ currentColor.toUpperCase() }}</span>
      </div>
      <div class="nc-color-panel-ramp">
        <button
          v-for="(shade, i) in families[familyIndex].shades"
          :key="shade"
          type="button"
          :title="shade.toUpperCase()"
          class="nc-color-panel-ramp-cell"
          :style="{ background: shade }"
          data-testid="nc-color-panel-ramp-cell"
          @click="pickShade(i)"
          @keydown.right.prevent="moveFocus($event, 1)"
          @keydown.left.prevent="moveFocus($event, -1)"
        >
          <span
            class="nc-color-panel-ramp-dot"
            :style="{ background: contrastText(shade), opacity: i === shadeIndex && !override ? 1 : 0 }"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-color-panel {
  @apply flex flex-col;
  width: 296px;
  padding: 14px;
  gap: 14px;
}

.nc-color-panel-pill {
  @apply inline-flex items-center min-w-0;
  height: 26px;
  max-width: 170px;
  padding: 0 12px;
  border-radius: 13px;
  font-size: 13px;
  font-weight: 600;
}

.nc-color-panel-hex-field {
  @apply flex items-center;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--nc-border-gray-medium);
  border-radius: 8px;

  input {
    @apply font-mono uppercase bg-transparent border-none outline-none;
    width: 68px;
    font-size: 12px;
    color: var(--nc-content-gray);
  }
}

.nc-color-panel-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--nc-content-gray-muted);
}

.nc-color-panel-hex-readout {
  @apply font-mono;
  font-size: 11px;
  color: var(--nc-content-gray-muted);
}

// Layout in plain scoped CSS — rare windi utilities (grid-cols-9, gap-[5px])
// can be missing from a dev server that predates this file, which blew the
// aspect-ratio dots up to container width.
.nc-color-panel-hue-grid {
  display: grid;
  grid-template-columns: repeat(9, minmax(0, 1fr));
  gap: 6px;
}

.nc-color-panel-hue-dot {
  @apply cursor-pointer border-none p-0;
  aspect-ratio: 1;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(16, 16, 21, 0.08);
  transition: box-shadow 150ms;

  &.nc-selected,
  &:focus-visible {
    box-shadow: 0 0 0 2px var(--nc-bg-default), 0 0 0 4px var(--color-brand-500);
    outline: none;
  }
}

.nc-color-panel-ramp {
  @apply flex overflow-hidden;
  height: 34px;
  border-radius: 8px;
  border: 1px solid rgba(16, 16, 21, 0.08);
}

.nc-color-panel-ramp-cell {
  @apply flex-1 cursor-pointer grid place-items-center border-none p-0;

  &:focus-visible {
    box-shadow: inset 0 0 0 2px var(--nc-bg-default), inset 0 0 0 4px var(--color-brand-500);
    outline: none;
  }
}

.nc-color-panel-ramp-dot {
  @apply block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  transition: opacity 150ms;
}
</style>
