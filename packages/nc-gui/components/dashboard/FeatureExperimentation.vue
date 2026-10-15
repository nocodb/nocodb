<script setup lang="ts">
interface Props {
  value?: boolean
}

const props = defineProps<Props>()

const { toggleFeature, features, isEngineeringModeOn, isAdvancedModeOn } = useBetaFeatureToggle()

const value = useVModel(props, 'value')

const { appInfo } = useGlobal()

const { showEEFeatures, isEEFeatureBlocked } = useEeConfig()

const searchQuery = ref('')

const selectedIndex = ref(0)

const inputRef = ref<HTMLInputElement>()

const listRef = ref<HTMLElement>()

const isEnabledForPlatform = (feature: BetaFeatureType) => {
  if (appInfo.value.isOnPrem && feature.isOnPrem === false) return false
  if (appInfo.value.isCloud && feature.isCloud === false) return false

  return true
}

const isFeatureVisible = (feature: BetaFeatureType) => {
  return (
    (!feature?.isEE || showEEFeatures.value) &&
    // Licensed-only features are hidden on self-hosted free (CE / unlicensed
    // on-prem); shown on licensed on-prem and cloud.
    (!feature?.isLicensed || !isEEFeatureBlocked.value) &&
    (!feature?.isEngineering || isEngineeringModeOn.value) &&
    (!feature?.isAdvanced || isAdvancedModeOn.value) &&
    isEnabledForPlatform(feature)
  )
}

const visibleFeatures = computed(() => features.value.filter(isFeatureVisible))

/** Word-start match, then title over description — a bare substring would let "ai" hit "email". */
const filteredFeatures = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  if (!query) return visibleFeatures.value

  const wordStart = new RegExp(`(^|[^a-z0-9])${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)

  const score = (feature: BetaFeatureType) => {
    const title = feature.title.toLowerCase()
    const description = feature.description.toLowerCase()

    if (title.startsWith(query)) return 4
    if (wordStart.test(title)) return 3
    if (description.startsWith(query)) return 2
    if (wordStart.test(description)) return 1

    return 0
  }

  return visibleFeatures.value.filter((feature) => score(feature) > 0).sort((a, b) => score(b) - score(a))
})

const enabledCount = computed(() => visibleFeatures.value.filter((feature) => feature.enabled).length)

const isAllEnabled = computed(() => visibleFeatures.value.length > 0 && enabledCount.value === visibleFeatures.value.length)

function toggle(feature: BetaFeatureType) {
  toggleFeature(feature.id)
}

function toggleAll() {
  const next = !isAllEnabled.value

  for (const feature of visibleFeatures.value) {
    if (feature.enabled !== next) toggleFeature(feature.id, next)
  }
}

function close() {
  value.value = false
}

/** Keeps the highlighted row in view when arrowing past the fold. */
function scrollSelectedIntoView() {
  nextTick(() => {
    listRef.value?.querySelector('.nc-exp-row.selected')?.scrollIntoView({ block: 'nearest' })
  })
}

function move(delta: number) {
  const total = filteredFeatures.value.length
  if (!total) return

  selectedIndex.value = (selectedIndex.value + delta + total) % total
  scrollSelectedIntoView()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    move(1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    move(-1)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const feature = filteredFeatures.value[selectedIndex.value]
    if (feature) toggle(feature)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    close()
  }
}

watch(searchQuery, () => {
  selectedIndex.value = 0
})

watch(value, (open) => {
  if (!open) return

  searchQuery.value = ''
  selectedIndex.value = 0

  nextTick(() => inputRef.value?.focus())
})

// ─── Easter eggs ─────────────────────────────────────────────────────────────

/** Triple-click the bulb / the hint row — the original two eggs, kept as they were. */
function useTripleClick(onTriggered: () => void) {
  const count = ref(0)
  const timer = ref<NodeJS.Timeout>()

  onUnmounted(() => timer.value && clearTimeout(timer.value))

  return () => {
    count.value++

    if (count.value === 1) {
      if (timer.value) clearTimeout(timer.value)
      timer.value = setTimeout(() => (count.value = 0), 3000)
    }

    if (count.value >= 3) {
      onTriggered()
      count.value = 0
      if (timer.value) clearTimeout(timer.value)
      timer.value = undefined
    }
  }
}

const handleClick = useTripleClick(() => (isEngineeringModeOn.value = !isEngineeringModeOn.value))

const handleAdvancedClick = useTripleClick(() => (isAdvancedModeOn.value = !isAdvancedModeOn.value))

const SHIFT_TAP_WINDOW = 600

const shiftTaps = ref(0)

const shiftTimer = ref<NodeJS.Timeout>()

function resetShiftTaps() {
  shiftTaps.value = 0
  if (shiftTimer.value) clearTimeout(shiftTimer.value)
  shiftTimer.value = undefined
}

useEventListener('keydown', (e: KeyboardEvent) => {
  // The input handles its own Esc; this covers focus having left it (e.g. after a row click).
  if (value.value && e.key === 'Escape' && e.target !== inputRef.value) {
    close()
    return
  }

  if (isActiveInputElementExist()) return

  if (e.shiftKey && e.altKey && e.code === 'KeyE') {
    value.value = !value.value
    return
  }

  // Secret: Shift Shift Shift opens the palette with every egg already cracked.
  // Any other key resets the run, so typing a capital can never accumulate taps.
  if (e.key !== 'Shift') {
    resetShiftTaps()
    return
  }

  if (e.repeat) return

  shiftTaps.value++

  if (shiftTimer.value) clearTimeout(shiftTimer.value)
  shiftTimer.value = setTimeout(resetShiftTaps, SHIFT_TAP_WINDOW)

  if (shiftTaps.value >= 3) {
    resetShiftTaps()

    // Toggles: tap again to put the eggs away. Either way the palette opens, so
    // the row count visibly confirms which way it went.
    const next = !(isEngineeringModeOn.value && isAdvancedModeOn.value)

    isEngineeringModeOn.value = next
    isAdvancedModeOn.value = next
    value.value = true
  }
})

// Shift+click (grid range selection) must not count as a tap.
useEventListener('pointerdown', resetShiftTaps, { capture: true })

onUnmounted(resetShiftTaps)
</script>

<template>
  <div v-if="value" class="nc-exp-palette" data-testid="nc-exp-palette" @click.self="close">
    <div class="nc-exp-modal">
      <div class="nc-exp-head">
        <component :is="iconMap.bulb" class="h-4 w-4 flex-none text-nc-content-gray-muted cursor-pointer" @click="handleClick" />

        <input
          ref="inputRef"
          v-model="searchQuery"
          class="nc-exp-input"
          :placeholder="$t('general.featurePreview')"
          data-testid="nc-exp-palette-input"
          @keydown="onKeydown"
        />

        <span v-if="isEngineeringModeOn" class="nc-exp-badge egg">eng</span>
        <span v-if="isAdvancedModeOn" class="nc-exp-badge egg">adv</span>
      </div>

      <div v-if="filteredFeatures.length" ref="listRef" class="nc-exp-list nc-scrollbar-thin">
        <div
          v-for="(feature, i) in filteredFeatures"
          :key="feature.id"
          class="nc-exp-row"
          :class="{ selected: i === selectedIndex }"
          :data-testid="`nc-exp-row-${feature.id}`"
          @mouseenter="selectedIndex = i"
          @click="toggle(feature)"
        >
          <div class="flex flex-col min-w-0 flex-1">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-bodyDefaultSm text-nc-content-gray truncate">{{ feature.title }}</span>
              <span v-if="feature.isEngineering" class="nc-exp-badge">eng</span>
              <span v-if="feature.isAdvanced" class="nc-exp-badge">adv</span>
            </div>
            <span class="text-captionSm text-nc-content-gray-muted truncate">{{ feature.description }}</span>
          </div>

          <NcSwitch :checked="feature.enabled" size="small" class="flex-none pointer-events-none" />
        </div>
      </div>

      <div v-else class="nc-exp-empty">
        {{ visibleFeatures.length ? $t('title.noResultsMatchedYourSearch') : $t('labels.noExperimentalFeatures') }}
      </div>

      <div class="nc-exp-foot" @click="handleAdvancedClick">
        <span class="flex-1 truncate">{{ enabledCount }}/{{ visibleFeatures.length }} {{ $t('general.enabled') }}</span>

        <button type="button" class="nc-exp-link" data-testid="nc-exp-toggle-all" @click.stop="toggleAll">
          {{ isAllEnabled ? $t('general.disable') : $t('general.enable') }} {{ $t('general.all') }}
        </button>

        <span class="nc-exp-keys"><kbd>↑</kbd><kbd>↓</kbd> {{ $t('labels.navigate') }}</span>
        <span class="nc-exp-keys"><kbd>↵</kbd> {{ $t('general.toggle') }}</span>
        <span class="nc-exp-keys"><kbd>esc</kbd> {{ $t('general.close') }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-exp-palette {
  @apply fixed inset-0 z-1000 flex items-start justify-center pt-[12vh] px-4;
  background: rgba(0, 0, 0, 0.5);
}

.nc-exp-modal {
  @apply flex flex-col w-full max-w-[640px] max-h-[60vh] rounded-xl overflow-hidden border-1 border-nc-border-gray-medium;
  background: var(--nc-bg-default);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
}

.nc-exp-head {
  @apply flex items-center gap-2 px-4 h-12 flex-none border-b-1 border-nc-border-gray-medium;
}

.nc-exp-input {
  @apply flex-1 min-w-0 bg-transparent text-bodyDefaultSm text-nc-content-gray placeholder:text-nc-content-gray-muted;
  outline: none !important;
  border: none !important;
  box-shadow: none !important;
}

.nc-exp-list {
  @apply flex-1 overflow-y-auto py-1;
}

.nc-exp-row {
  @apply flex items-center gap-3 px-4 py-2 cursor-pointer;

  &.selected {
    background: var(--nc-bg-gray-extralight);
  }
}

.nc-exp-badge {
  @apply flex-none px-1.5 rounded text-captionSm leading-4 text-nc-content-gray-muted border-1 border-nc-border-gray-medium;

  &.egg {
    @apply text-nc-content-brand border-nc-border-brand;
  }
}

.nc-exp-empty {
  @apply flex-1 flex items-center justify-center py-10 text-bodyDefaultSm text-nc-content-gray-muted;
}

.nc-exp-foot {
  @apply flex items-center gap-3 px-4 h-9 flex-none border-t-1 border-nc-border-gray-medium text-captionSm text-nc-content-gray-muted;
}

.nc-exp-link {
  @apply flex-none cursor-pointer bg-transparent border-0 text-captionSm text-nc-content-gray-subtle2 hover:text-nc-content-gray;
  font-family: inherit;
}

.nc-exp-keys {
  @apply flex-none hidden sm:flex items-center gap-1;

  kbd {
    @apply inline-flex items-center justify-center min-w-4 h-4 px-1 rounded border-1 border-nc-border-gray-medium text-captionSm;
    background: var(--nc-bg-gray-extralight);
  }
}
</style>
