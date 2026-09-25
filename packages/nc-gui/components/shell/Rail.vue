<script lang="ts" setup>
// Not auto-imported, unlike most of @vueuse/core's surface.
import { useStorage } from '@vueuse/core'
import type { PlanFeatureTypes } from 'nocodb-sdk'

export interface ShellRailItem {
  /** Identifies the pane; the shell decides what it means (route slug, tab key…). */
  slug: string
  icon: string
  title: string
  /** When set, the row shows a plan-upgrade lock badge while the feature is blocked. */
  feature?: PlanFeatureTypes
  /** What the pane contains but does not say in its label — searched, never shown. */
  keywords?: string
  /** Tooltip at the row's right edge, explaining what the pane is for. */
  info?: string
  /** Client marks shown at the row's right edge — an invitation to connect. */
  logos?: string[]
  /** Overrides the derived `{testidPrefix}-item-{slug}`. */
  testId?: string
  /** Telemetry suffix, when the event name differs from the slug. */
  ev?: string
}

export interface ShellRailGroup {
  label: string
  items: ShellRailItem[]
  /** Stable id — required for a collapsible group, whose fold state is stored under it. */
  key?: string
  /** Folds by default, and can be folded away by the reader. */
  collapsible?: boolean
  /** Draws a rule above the heading: a second section in the same scroll column. */
  divider?: boolean
}

interface Props {
  groups: ShellRailGroup[]
  active: string
  searchPlaceholder?: string
  /** Shown in place of the generic "no results" line, with `{query}` interpolated. */
  emptyText?: string
  testidPrefix?: string
  /** Prepended to each row's telemetry event — the shells predate this rail and own their names. */
  eventPrefix?: string
  /** localStorage key backing the collapsible groups. Omit to fold per mount. */
  collapseStorageKey?: string
  /** Fills its host instead of sitting beside the pane — the phone's list view. */
  fullWidth?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  testidPrefix: 'nc-tools-rail',
  eventPrefix: 'c:table:tools-shell:',
})

const emits = defineEmits<{
  select: [slug: string]
  groupToggle: [key: string, open: boolean]
}>()

const { t } = useI18n()

const search = ref('')

const isSearching = computed(() => !!search.value.trim())

// Panes whose title, group or keywords match the query; empty groups fall away
// with their headers.
const filteredGroups = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return props.groups

  return props.groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          group.label.toLowerCase().includes(query) ||
          (item.keywords ?? '').includes(query),
      ),
    }))
    .filter((group) => group.items.length)
})

const hasMatches = computed(() => filteredGroups.value.some((group) => group.items.length))

/**
 * Remembered across subjects and sessions only when a host asks for it by key.
 * Without one the fold state lives for the mount, so a long group opens on
 * demand and is folded again next time the shell is opened.
 */
const openGroups = props.collapseStorageKey
  ? useStorage<Record<string, boolean>>(props.collapseStorageKey, {})
  : ref<Record<string, boolean>>({})

/**
 * A collapsible group still opens itself when it has to: while a search is
 * running, hiding a matching row would make the search look broken, and a
 * folded group holding the pane you are on would leave the rail with nothing
 * marked active.
 */
function isGroupOpen(group: ShellRailGroup) {
  if (!group.collapsible) return true

  if (isSearching.value) return true

  if (group.items.some((i) => i.slug === props.active)) return true

  return !!openGroups.value[group.key ?? group.label]
}

function toggleGroup(group: ShellRailGroup) {
  if (!group.collapsible) return

  const key = group.key ?? group.label
  const open = !isGroupOpen(group)

  openGroups.value = { ...openGroups.value, [key]: open }

  emits('groupToggle', key, open)
}

const onSelect = (slug: string) => {
  emits('select', slug)
}

// Enter jumps to the first match, so a search can be driven from the keyboard alone.
const onSearchEnter = () => {
  const first = filteredGroups.value[0]?.items[0]
  if (first) onSelect(first.slug)
}
</script>

<template>
  <div
    class="nc-shell-rail flex flex-col bg-nc-bg-gray-extralight"
    :class="fullWidth ? 'w-full flex-1' : 'flex-none w-61 border-r-1 border-nc-border-gray-medium'"
    :data-testid="testidPrefix"
  >
    <!-- Top padding matches ShellHeader so the subject lines up with the pane title. -->
    <div class="flex-none px-3 pt-4 sm:pt-8 pb-3">
      <!-- Names the subject being configured, so the modal always states what these panes belong to. -->
      <div v-if="$slots.subject" class="nc-shell-rail-subject">
        <slot name="subject" />
      </div>

      <a-input
        v-model:value="search"
        class="nc-shell-rail-search !h-8 !rounded-lg !pl-2.5"
        :placeholder="searchPlaceholder ?? $t('placeholder.searchTools')"
        allow-clear
        :data-testid="`${testidPrefix}-search`"
        @keydown.enter.prevent="onSearchEnter"
      >
        <template #prefix>
          <GeneralIcon icon="search" class="mr-1.5 h-3.5 w-3.5 text-nc-content-gray-muted" />
        </template>
      </a-input>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto nc-scrollbar-thin px-3 pb-4">
      <div
        v-if="!hasMatches"
        class="px-2.5 py-2 text-bodyDefaultSm text-nc-content-gray-muted"
        :data-testid="`${testidPrefix}-empty`"
      >
        {{ emptyText ? t(emptyText, { query: search.trim() }) : $t('labels.noResults') }}
      </div>

      <template v-for="group in filteredGroups" :key="group.key ?? group.label">
        <component
          :is="group.collapsible ? 'button' : 'div'"
          v-if="group.items.length"
          class="nc-shell-rail-group"
          :class="{
            'nc-shell-rail-group-divider': group.divider,
            'nc-shell-rail-group-toggle': group.collapsible,
          }"
          :type="group.collapsible ? 'button' : undefined"
          :aria-expanded="group.collapsible ? isGroupOpen(group) : undefined"
          :data-testid="group.collapsible ? `nc-settings-group-${group.key}` : undefined"
          @click="toggleGroup(group)"
        >
          <span>{{ group.label }}</span>
          <GeneralIcon
            v-if="group.collapsible"
            icon="chevronDown"
            class="nc-shell-rail-chevron"
            :class="{ '-rotate-90': !isGroupOpen(group) }"
          />
        </component>
        <div
          v-for="item in isGroupOpen(group) ? group.items : []"
          :key="item.slug"
          v-e="[`${eventPrefix}${item.ev ?? item.slug}`]"
          class="nc-shell-rail-item"
          :class="{ active: active === item.slug }"
          :data-testid="item.testId ?? `${testidPrefix}-item-${item.slug}`"
          @click="onSelect(item.slug)"
        >
          <GeneralIcon
            :icon="item.icon"
            class="!h-4 !w-4 flex-none"
            :class="active === item.slug ? 'text-nc-content-brand' : 'text-nc-content-gray-subtle2'"
          />
          <span class="truncate flex-1">{{ item.title }}</span>

          <div v-if="item.logos" class="nc-shell-rail-logos">
            <div class="nc-shell-rail-logos-stack">
              <span
                v-for="(logo, logoIdx) in item.logos"
                :key="logo"
                class="nc-shell-rail-logo"
                :style="{ zIndex: item.logos.length - logoIdx }"
              >
                <GeneralIcon :icon="logo" />
              </span>
            </div>
          </div>

          <NcTooltip v-if="item.info" :title="item.info" placement="right" :arrow="false" class="nc-shell-rail-info">
            <GeneralIcon icon="ncInfo" class="nc-shell-rail-info-icon flex-none" />
          </NcTooltip>

          <LazyPaymentUpgradeBadge v-if="item.feature" :feature="item.feature" remove-click />
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-shell-rail-subject {
  @apply flex items-center gap-2 px-2 h-7 mb-3 text-base font-semibold text-nc-content-gray-extreme;
}

.nc-shell-rail-item {
  @apply flex items-center gap-2.5 px-2.5 py-2 mb-0.5 rounded-lg text-bodyDefaultSm font-normal text-nc-content-gray-emphasis cursor-pointer;
  // Pinned to the text line's row height: the client-mark chips (22px) and the
  // upgrade badge (20px) overshoot it and would otherwise grow their rows.
  height: 34px;

  &:hover {
    @apply bg-nc-bg-gray-light;
  }

  &.active {
    @apply bg-nc-bg-brand text-nc-content-brand font-medium;

    &:hover {
      @apply bg-nc-bg-brand;
    }
  }
}

.nc-shell-rail-group {
  @apply px-2 pt-2.5 pb-1.5 text-[10px] font-bold tracking-wide text-nc-content-gray-muted uppercase;
}

// A foldable heading is a control, so it takes the whole row as its hit target.
.nc-shell-rail-group-toggle {
  @apply w-full flex items-center justify-between gap-1 text-left cursor-pointer bg-transparent border-0;
  // Only the font family, which a <button> swaps for the UA's own. Every other
  // type property is left to the base class: `inherit` takes the parent's value
  // rather than this class's, which is how the heading first lost its uppercase.
  font-family: inherit;

  &:hover {
    @apply text-nc-content-gray-subtle2;
  }
}

.nc-shell-rail-chevron {
  @apply flex-none h-3.5 w-3.5 transition-transform duration-200;
}

// A second section in the same scroll column — a rule separates it from the first.
.nc-shell-rail-group-divider {
  @apply mt-3 pt-4 border-t border-nc-border-gray-medium;
}

// The client marks are an invitation to connect, not part of the row's resting
// state: the rail reads as plain icon + label like every other shell rail, and
// the marks bloom in when the row is hovered or active. While hidden they take
// no width at all — a 0fr track, plus a negative margin swallowing the row gap —
// so a long label keeps the whole row until the marks are wanted.
.nc-shell-rail-logos {
  @apply grid flex-none;
  grid-template-columns: 0fr;
  margin-left: -0.625rem;
  opacity: 0;
  // 200ms matches NcSidebarMenuItem's own transition-all, so the marks arrive in
  // step with the row surface rather than ahead of it.
  transition: opacity 200ms ease, grid-template-columns 200ms ease, margin-left 200ms ease;
}

.nc-shell-rail-logos-stack {
  @apply flex items-center min-w-0 overflow-hidden;
}

// Each mark gets its own chip so the overlap reads as a stack — these logos are
// not circular, so overlapping the bare glyphs would crop them into each other.
// The chip is filled with the row's own surface rather than a fixed colour, so
// it carves the mark out of the row instead of sitting on it as a light block.
.nc-shell-rail-item {
  --nc-shell-chip-surface: var(--color-gray-100);

  &:hover {
    --nc-shell-chip-surface: var(--color-gray-200);
  }

  &.active {
    --nc-shell-chip-surface: var(--color-brand-50);
  }
}

[theme='dark'] .nc-shell-rail-item.active {
  --nc-shell-chip-surface: var(--color-gray-200);
}

// 22px chip around a 16px mark leaves 3px each side, and the overlap has to stay
// under that or the next chip's fill bites into the previous glyph.
.nc-shell-rail-logo {
  @apply relative flex items-center justify-center h-[22px] w-[22px] rounded-full -ml-0.5;
  background: var(--nc-shell-chip-surface);
  transition: background-color 200ms ease;

  &:first-child {
    @apply ml-0;
  }

  :deep(svg) {
    @apply h-4 w-4;
  }

  // Most brand marks ship an opaque white backplate (a full-canvas
  // `<rect rx="2" fill="white">`) which reads as a square tile inside the chip.
  :deep(svg > rect:first-child) {
    fill: transparent;
  }
}

.nc-shell-rail-item:hover .nc-shell-rail-logos,
.nc-shell-rail-item.active .nc-shell-rail-logos {
  grid-template-columns: 1fr;
  margin-left: 0;
  opacity: 1;
}

// Always visible, but quiet enough to sit beside the brand marks without
// competing. The negative margin pulls back against the row's own gap-2.5, so
// the hint sits close to the marks it annotates rather than drifting to the edge.
:deep(.nc-shell-rail-info) {
  @apply -ml-1.5 flex-none transition-opacity duration-150 opacity-80;
}

.nc-shell-rail-item:hover :deep(.nc-shell-rail-info) {
  @apply opacity-100;
}

:deep(.nc-shell-rail-info .nc-shell-rail-info-icon) {
  @apply h-3 w-3 text-nc-content-gray-disabled;
}
</style>
