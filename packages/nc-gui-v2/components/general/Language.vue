<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import MaterialSymbolsTranslate from '~icons/material-symbols/translate'
import { Language } from '~/lib/enums'

const { $e, $state } = useNuxtApp()

const { availableLocales = ['en'], locale } = useI18n()

const languages = $computed(() => {
  return availableLocales.sort()
})

const isRtlLang = $computed(() => ['fa'].includes($state.lang.value))

function applyDirection() {
  const targetDirection = isRtlLang ? 'rtl' : 'ltr'
  const oppositeDirection = targetDirection === 'ltr' ? 'rtl' : 'ltr'
  document.body.classList.remove(oppositeDirection)
  document.body.classList.add(targetDirection)
  document.body.style.direction = targetDirection
}

function changeLanguage(lang: string) {
  $state.lang.value = lang
  locale.value = lang
  applyDirection()
  $e('c:navbar:lang', { lang })
}

onMounted(() => {
  applyDirection()
})
</script>

<template>
  <v-menu class="select-none">
    <template #activator="{ props }">
      <MaterialSymbolsTranslate class="md:text-xl cursor-pointer nc-menu-translate" @click="props.onClick" />
    </template>
    <v-list class="scrollbar min-w-50 max-h-90vh overflow-auto !py-0 dark:(!bg-gray-800 !text-white)">
      <v-list-item
        v-for="lang of languages"
        :key="lang.value"
        :class="lang === locale ? '!bg-primary/10 text-primary dark:(!bg-gray-700 !text-secondary)' : ''"
        class="!min-h-8 group"
        :value="lang"
        @click="changeLanguage(lang)"
      >
        <v-list-item-subtitle
          :class="lang === locale ? '!font-semibold' : ''"
          class="capitalize md:(!leading-8) group-hover:(text-primary font-semibold) dark:(group-hover:text-secondary)"
        >
          {{ Language[lang] || lang }}
        </v-list-item-subtitle>
      </v-list-item>

      <v-divider />

      <v-list-item>
        <a
          href="https://docs.nocodb.com/engineering/translation/#how-to-contribute--for-community-members"
          target="_blank"
          class="caption py-2 text-primary underline hover:opacity-75"
        >
          {{ $t('activity.translate') }}
        </a>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<style scoped>
.scrollbar {
  @apply scrollbar scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-primary scrollbar-track-white dark:(!scrollbar-track-gray-900);
}
</style>
