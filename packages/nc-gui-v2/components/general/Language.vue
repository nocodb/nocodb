<script lang="ts" setup>
import { Language } from '~/lib'
import { onMounted, useGlobal, useI18n, useNuxtApp } from '#imports'

const { $e } = useNuxtApp()

const { lang: currentLang } = useGlobal()

const { availableLocales = ['en'], locale } = useI18n()

const languages = $computed(() => availableLocales.sort())

const isRtlLang = $computed(() => ['fa'].includes(currentLang.value))

function applyDirection() {
  const targetDirection = isRtlLang ? 'rtl' : 'ltr'

  const oppositeDirection = targetDirection === 'ltr' ? 'rtl' : 'ltr'

  document.body.classList.remove(oppositeDirection)
  document.body.classList.add(targetDirection)
  document.body.style.direction = targetDirection
}

function changeLanguage(lang: string) {
  currentLang.value = lang
  locale.value = lang

  applyDirection()

  $e('c:navbar:lang', { lang })
}

onMounted(() => {
  applyDirection()
})
</script>

<template>
  <a-dropdown class="select-none" :trigger="['click']">
    <MaterialSymbolsTranslate v-bind="$attrs" class="md:text-xl cursor-pointer nc-menu-translate" />

    <template #overlay>
      <a-menu class="scrollbar-thin-dull min-w-50 max-h-90vh overflow-auto !py-0 dark:(!bg-gray-800 !text-white)">
        <a-menu-item
          v-for="lang of languages"
          :key="lang"
          :class="lang === locale ? '!bg-primary/10 text-primary dark:(!bg-gray-700 !text-secondary)' : ''"
          class="!min-h-8 group"
          :value="lang"
          @click="changeLanguage(lang)"
        >
          <div
            :class="lang === locale ? '!font-semibold !text-primary' : ''"
            class="capitalize md:(!leading-8) group-hover:(text-primary font-semibold) dark:(group-hover:text-secondary)"
          >
            {{ Language[lang] || lang }}
          </div>
        </a-menu-item>

        <a-menu-item>
          <a
            href="https://docs.nocodb.com/engineering/translation/#how-to-contribute--for-community-members"
            target="_blank"
            class="caption py-2 text-primary underline hover:opacity-75"
          >
            {{ $t('activity.translate') }}
          </a>
        </a-menu-item>
      </a-menu>
    </template>
  </a-dropdown>
</template>
