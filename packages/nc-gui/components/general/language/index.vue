<script lang="ts" setup>
import { setI18nLanguage } from '~/plugins/a.i18n'

const props = defineProps<{
  button?: boolean
}>()

const { $e } = useNuxtApp()

const { lang: currentLang } = useGlobal()

const { locale } = useI18n()

const languages = computed(
  () =>
    Object.entries(Language)
      .sort()
      .map(([key, value]) => ({
        label: value,
        value: key,
      })) as { label: string; value: string }[],
)

async function changeLanguage(lang: { label: string; value: string }) {
  const nextLang = lang.value as keyof typeof Language

  await setI18nLanguage(nextLang)
  currentLang.value = nextLang

  $e('c:navbar:lang', { lang })
}

const isDropdownOpen = ref(false)
</script>

<template>
  <NcDropdown
    v-model:visible="isDropdownOpen"
    class="select-none color-transition cursor-pointer"
    :trigger="['click']"
    overlay-class-name="nc-dropdown-menu-translate overflow-hidden"
  >
    <NcButton
      v-if="props.button"
      :class="{
        '!border-brand-500 !shadow-selected': isDropdownOpen,
      }"
      type="secondary"
      size="small"
    >
      <div class="flex items-center text-nc-content-gray justify-between">
        <div class="flex items-center min-w-24 gap-2">
          <MaterialSymbolsTranslate class="text-caption nc-menu-translate" />
          <span class="text-caption">{{ Language[locale] }}</span>
        </div>
        <GeneralIcon icon="arrowDown" class="text-caption nc-menu-translate" />
      </div>
    </NcButton>
    <div v-else v-bind="$attrs" class="flex items-center justify-center">
      <MaterialSymbolsTranslate class="text-base nc-menu-translate" />
    </div>

    <template #overlay>
      <NcList :value="locale" :list="languages" @change="changeLanguage" />
    </template>
  </NcDropdown>
</template>
