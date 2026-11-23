<script lang="ts" setup>
import { setI18nLanguage } from '~/plugins/a.i18n'
import { Language } from '#imports'

const { isMobileMode, lang: currentLang } = useGlobal()

const { selectedTheme, setTheme, isThemeEnabled, isThemeConfigOpen } = useTheme()

const { isFeatureEnabled } = useBetaFeatureToggle()

const { weekStart, setWeekStart } = useWeekStart()

const { locale, t } = useI18n()

const { $e } = useNuxtApp()

const isSavingWeekStart = ref(false)

const themeOptions = computed(() => [
  { value: 'light' as ThemeMode, label: t('general.light') },
  { value: 'dark' as ThemeMode, label: t('general.dark') },
  { value: 'system' as ThemeMode, label: t('general.system') },
])

const isThemeConfigEnabled = computed(() => isThemeEnabled.value && isFeatureEnabled(FEATURE_FLAG.THEME_SETTINGS))

const languageOptions = computed(() =>
  (Object.entries(Language).sort() as [keyof typeof Language, Language][]).map(([value, label]) => ({ value, label })),
)

const weekStartOptions = computed(() => {
  const [sunday, monday] = getCalendarWeekdayLabels(locale.value, { weekStartsOn: 0, format: 'long' })
  return [
    { value: 'sunday', label: sunday! },
    { value: 'monday', label: monday! },
  ]
})

function filterLanguage(input: string, option: any) {
  return String(option?.label ?? '')
    .toLowerCase()
    .includes(input.toLowerCase())
}

function onSelectTheme(mode: ThemeMode) {
  if (mode === selectedTheme.value) return
  setTheme(mode)
  $e('c:theme:mode', { mode, source: 'preferences' })
}

function openThemeConfig() {
  isThemeConfigOpen.value = true
  $e('c:theme:config-open', { source: 'preferences' })
}

async function onSelectLanguage(value: string) {
  const nextLang = value as keyof typeof Language
  await setI18nLanguage(nextLang)
  currentLang.value = nextLang
  $e('c:navbar:lang', { lang: value, source: 'preferences' })
}

async function onSelectWeekStart(value: string) {
  isSavingWeekStart.value = true
  try {
    await setWeekStart(value as WeekStart)
    $e('c:user:week-start:toggle', { week_start: value, source: 'preferences' })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isSavingWeekStart.value = false
  }
}
</script>

<template>
  <div class="flex flex-col" data-testid="nc-account-preferences">
    <NcPageHeader v-if="!isMobileMode">
      <template #icon>
        <GeneralIcon class="flex-none !h-5 !w-5" icon="ncSlidersHorizontal" />
      </template>
      <template #title>
        <span data-rec="true">{{ $t('labels.preferences') }}</span>
      </template>
    </NcPageHeader>
    <div class="h-[calc(100vh_-_100px)] overflow-auto nc-scrollbar-thin">
      <div class="h-full nc-content-max-w p-6">
        <div class="flex flex-col gap-8 w-150 max-w-full mx-auto pb-6">
          <div v-if="isThemeEnabled" class="nc-settings-item-card-wrapper mt-5">
            <div class="nc-settings-item-heading text-nc-content-gray-emphasis">
              {{ $t('general.appearance') }}
            </div>
            <div class="nc-settings-item-card">
              <div class="nc-settings-item !flex-col !items-stretch">
                <div class="nc-settings-item-content">
                  <div id="nc-pref-theme-label" class="nc-settings-item-title">{{ $t('labels.theme') }}</div>
                  <div class="nc-settings-item-subtitle">{{ $t('labels.preferencesPage.themeSubtitle') }}</div>
                </div>
                <div role="radiogroup" aria-labelledby="nc-pref-theme-label" class="grid grid-cols-3 gap-3 md:gap-4">
                  <button
                    v-for="option of themeOptions"
                    :key="option.value"
                    type="button"
                    role="radio"
                    :aria-checked="selectedTheme === option.value"
                    class="nc-pref-theme-card"
                    :class="{ 'is-on': selectedTheme === option.value }"
                    :data-testid="`nc-pref-theme-${option.value}`"
                    @click="onSelectTheme(option.value)"
                  >
                    <div class="nc-pref-theme-ring">
                      <div class="nc-pref-theme-preview">
                        <div class="nc-pref-theme-half" :class="option.value === 'dark' ? 'is-dark' : 'is-light'">
                          <span class="nc-pref-theme-line w-3/5" />
                          <span class="nc-pref-theme-line w-4/5 is-soft" />
                          <span class="nc-pref-theme-btn" />
                        </div>
                        <div v-if="option.value === 'system'" class="nc-pref-theme-half is-dark">
                          <span class="nc-pref-theme-line w-3/5" />
                          <span class="nc-pref-theme-line w-4/5 is-soft" />
                          <span class="nc-pref-theme-btn" />
                        </div>
                      </div>
                    </div>
                    <span class="text-bodyDefaultSm font-semibold text-nc-content-gray">{{ option.label }}</span>
                  </button>
                </div>
              </div>
              <div v-if="isThemeConfigEnabled" class="nc-settings-item md:!items-center">
                <div class="nc-settings-item-content flex-1">
                  <div class="nc-settings-item-title flex items-center gap-2">
                    {{ $t('labels.preferencesPage.darkColours') }}
                    <NcBadgeBeta />
                  </div>
                  <div class="nc-settings-item-subtitle">{{ $t('labels.preferencesPage.darkColoursSubtitle') }}</div>
                </div>
                <NcButton
                  class="nc-settings-item-action md:!self-center"
                  type="secondary"
                  size="small"
                  data-testid="nc-pref-theme-config"
                  @click="openThemeConfig"
                >
                  {{ $t('labels.preferencesPage.customize') }}
                </NcButton>
              </div>
            </div>
          </div>

          <div class="nc-settings-item-card-wrapper" :class="{ 'mt-5': !isThemeEnabled }">
            <div class="nc-settings-item-heading text-nc-content-gray-emphasis">
              {{ $t('labels.preferencesPage.languageRegion') }}
            </div>
            <div class="nc-settings-item-card">
              <div class="nc-settings-item md:!items-center">
                <div class="nc-settings-item-content flex-1">
                  <div class="nc-settings-item-title">{{ $t('labels.language') }}</div>
                  <div class="nc-settings-item-subtitle">{{ $t('labels.preferencesPage.languageSubtitle') }}</div>
                  <div class="nc-settings-item-subtitle flex items-center gap-1" data-testid="nc-pref-language-note">
                    <GeneralIcon icon="ncAutoAwesome" class="w-3.5 h-3.5 flex-none" />
                    {{ $t('labels.community.communityTranslated') }}
                  </div>
                </div>
                <NcSelect
                  :value="locale"
                  class="nc-settings-item-action md:!self-center w-full md:!w-50"
                  show-search
                  :filter-option="filterLanguage"
                  data-testid="nc-pref-language"
                  dropdown-class-name="nc-pref-language-dropdown"
                  @update:value="onSelectLanguage"
                >
                  <a-select-option
                    v-for="option of languageOptions"
                    :key="option.value"
                    :value="option.value"
                    :label="option.label"
                  >
                    <span class="capitalize">{{ option.label }}</span>
                  </a-select-option>
                </NcSelect>
              </div>
              <div class="nc-settings-item md:!items-center">
                <div class="nc-settings-item-content flex-1">
                  <div id="nc-pref-week-label" class="nc-settings-item-title">
                    {{ $t('labels.preferencesPage.weekStartsOn') }}
                  </div>
                  <div class="nc-settings-item-subtitle">{{ $t('labels.preferencesPage.weekStartsOnSubtitle') }}</div>
                </div>
                <NcSegmented
                  class="nc-pref-week-start nc-settings-item-action md:!self-center w-full md:!w-50"
                  :value="weekStart"
                  :options="weekStartOptions"
                  :disabled="isSavingWeekStart"
                  :aria-label="$t('labels.preferencesPage.weekStartsOn')"
                  data-testid="nc-pref-week-start"
                  @update:value="onSelectWeekStart"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// Same width as the language select above it; the two days split it evenly.
.nc-pref-week-start {
  @apply !flex;

  :deep(> *) {
    @apply flex-1;
  }

  :deep(.nc-segmented-option) {
    @apply w-full;
  }
}

.nc-pref-theme-card {
  @apply flex flex-col gap-2 p-0 border-0 bg-transparent cursor-pointer text-left;

  &:focus-visible {
    @apply outline-none;

    .nc-pref-theme-ring {
      @apply border-nc-border-brand;
    }
  }
}

.nc-pref-theme-ring {
  @apply p-0.75 rounded-xl border-2 border-transparent transition-colors duration-150;
  box-shadow: inset 0 0 0 1px var(--nc-border-gray-medium);

  .is-on & {
    @apply border-nc-border-brand;
    box-shadow: none;
  }
}

.nc-pref-theme-preview {
  @apply h-20 md:h-24 rounded-lg overflow-hidden flex;
}

// Fixed colours: each preview shows its own theme whatever the app is in now.
.nc-pref-theme-half {
  @apply flex-1 flex flex-col gap-2 p-3;

  &.is-light {
    background: #ffffff;
    --pref-line: #e7e7e9;
    --pref-line-soft: #f0f0f0;
    --pref-btn: #3366ff;
  }

  &.is-dark {
    background: #1b1b1f;
    --pref-line: #3a3a43;
    --pref-line-soft: #2d2d34;
    --pref-btn: #5c85ff;
  }
}

.nc-pref-theme-line {
  @apply h-2 rounded;
  background: var(--pref-line);

  &.is-soft {
    background: var(--pref-line-soft);
  }
}

.nc-pref-theme-btn {
  @apply h-3.5 w-2/5 rounded mt-auto;
  background: var(--pref-btn);
}
</style>

<style lang="scss">
// Mobile options are taller than their text; keep the label centred.
.nc-pref-language-dropdown .ant-select-item-option {
  @apply items-center;
}
</style>
