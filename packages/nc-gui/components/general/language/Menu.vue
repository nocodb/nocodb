<script lang="ts" setup>
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
  <a-menu-item class="group rounded-md !my-0.5">
    <a
      href="https://docs.nocodb.com/engineering/translation/#how-to-contribute--for-community-members"
      target="_blank"
      class="caption nc-base-menu-item rounded-md underline hover:!text-primary"
      rel="noopener"
    >
      {{ $t('activity.translate') }}
    </a>
  </a-menu-item>

  <a-menu-item
    v-for="[key, lang] of languages"
    :key="key"
    class="group rounded-md !my-0.5"
    :value="key"
    @click="changeLanguage(key)"
  >
    <div class="flex items-center gap-2 justify-between">
      <div class="nc-base-menu-item w-fit capitalize">
        {{ Language[key] || lang }}
      </div>
      <component :is="iconMap.check" v-if="key === locale" class="text-primary w-4 h-4" />
    </div>
  </a-menu-item>
</template>
