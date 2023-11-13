<script lang="ts" setup>
import { Language, useGlobal, useI18n, useNuxtApp } from '#imports'
import { setI18nLanguage } from '~/plugins/a.i18n'

const { $e } = useNuxtApp()

const { lang: currentLang } = useGlobal()

const { locale } = useI18n()

const languages = computed(() => Object.entries(Language).sort() as [keyof typeof Language, Language][])

async function changeLanguage(lang: string) {
  const nextLang = lang as keyof typeof Language

  await setI18nLanguage(nextLang)
  currentLang.value = nextLang

  $e('c:navbar:lang', { lang })
}
</script>

<template>
  <a-menu-item class="mt-1 group">
    <a
      href="https://docs.nocodb.com/engineering/translation/#how-to-contribute--for-community-members"
      target="_blank"
      class="caption nc-base-menu-item py-2 text-primary underline hover:opacity-75"
      rel="noopener"
    >
      {{ $t('activity.translate') }}
    </a>
  </a-menu-item>

  <a-menu-item
    v-for="[key, lang] of languages"
    :key="key"
    :class="key === locale ? '!bg-primary bg-opacity-10 text-primary' : ''"
    class="group"
    :value="key"
    @click="changeLanguage(key)"
  >
    <div :class="key === locale ? '!font-semibold !text-primary' : ''" class="nc-base-menu-item capitalize">
      {{ Language[key] || lang }}
    </div>
  </a-menu-item>
</template>
