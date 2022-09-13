<script lang="ts" setup>
import { Language } from '~/lib'
import { onMounted, useGlobal, useI18n, useNuxtApp } from '#imports'
import { setI18nLanguage } from '~/plugins/a.i18n'

const { $e } = useNuxtApp()

const { lang: currentLang } = useGlobal()

const { locale } = useI18n()

const languages = $computed(() => Object.entries(Language).sort())

const isRtlLang = $computed(() => ['fa'].includes(currentLang.value))

function applyDirection() {
  const targetDirection = isRtlLang ? 'rtl' : 'ltr'
  const oppositeDirection = targetDirection === 'ltr' ? 'rtl' : 'ltr'

  document.body.classList.remove(oppositeDirection)
  document.body.classList.add(targetDirection)
  document.body.style.direction = targetDirection
}

async function changeLanguage(lang: string) {
  const nextLang = lang as keyof typeof Language

  await setI18nLanguage(nextLang)
  currentLang.value = nextLang

  applyDirection()

  $e('c:navbar:lang', { lang })
}

onMounted(() => {
  applyDirection()
})
</script>

<template>
  <a-menu-item
    v-for="[key, lang] of languages"
    :key="key"
    :class="key === locale ? '!bg-primary bg-opacity-10 text-primary' : ''"
    class="group"
    :value="key"
    @click="changeLanguage(key)"
  >
    <div :class="key === locale ? '!font-semibold !text-primary' : ''" class="nc-project-menu-item capitalize">
      {{ Language[key] || lang }}
    </div>
  </a-menu-item>

  <a-menu-item class="mt-1">
    <a
      href="https://docs.nocodb.com/engineering/translation/#how-to-contribute--for-community-members"
      target="_blank"
      class="caption py-2 text-primary underline hover:opacity-75"
    >
      {{ $t('activity.translate') }}
    </a>
  </a-menu-item>
</template>
