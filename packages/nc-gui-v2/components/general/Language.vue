<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import MaterialSymbolsTranslate from '~icons/material-symbols/translate'
import { Languages } from '~/lib/enums'

const { $e, $state } = useNuxtApp()

const { availableLocales = ['en'], locale } = useI18n()

const languages = $computed(() => {
  return availableLocales.sort()
})

const isRtlLang = $computed(() => ['fa'].includes($state.value.lang))

function applyDirection() {
  const targetDirection = isRtlLang ? 'rtl' : 'ltr'
  const oppositeDirection = targetDirection === 'ltr' ? 'rtl' : 'ltr'
  document.body.classList.remove(oppositeDirection)
  document.body.classList.add(targetDirection)
  document.body.style.direction = targetDirection
}

function changeLanguage(lang: string) {
  $state.value.lang = lang
  locale.value = lang
  $e('c:navbar:lang', { lang })
}

onMounted(() => {
  applyDirection()
})
</script>

<template>
  <v-menu top offset-y>
    <template #activator="{ props }">
      <MaterialSymbolsTranslate class="cursor-pointer" @click="props.onClick" />
    </template>
    <v-list dense class="min-w-50 max-h-90vh overflow-auto !py-0">
      <v-list-item
        v-for="lang of languages"
        :key="lang.value"
        class="!min-h-8 group"
        dense
        :value="lang"
        @click="changeLanguage(lang)"
      >
        <v-list-item-subtitle class="capitalize md:(!leading-8) group-hover:(text-primary font-semibold)">
          {{ Languages[lang] || lang }}
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

<style scoped lang="scss">
.v-list {
  @apply scrollbar scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-primary scrollbar-track-white;
}
</style>
