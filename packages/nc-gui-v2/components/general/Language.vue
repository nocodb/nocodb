<script lang="ts" setup>
import { useI18n } from 'vue-i18n'

const { $e } = useNuxtApp()

const { availableLocales = ['en'] } = useI18n()

const labels = reactive({
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fa: 'فارسی',
  fr: 'Français',
  id: 'Bahasa Indonesia',
  ja: '日本語',
  it_IT: 'Italiano',
  ko: '한국인',
  lv: 'Latviešu',
  nl: 'Nederlandse',
  ru: 'Pусский',
  zh_CN: '大陆简体',
  zh_HK: '香港繁體',
  zh_TW: '臺灣正體',
  sv: 'Svenska',
  tr: 'Turkish',
  da: 'Dansk',
  vi: 'Tiếng Việt',
  no: 'Norsk',
  iw: 'עִברִית',
  fi: 'Suomalainen',
  uk: 'Українська',
  hr: 'Hrvatski',
  th: 'ไทย',
  sl: 'Slovenščina',
  pt_BR: 'Português (Brasil)',
})

const languages = $computed(() => {
  return availableLocales.sort()
})

let language = $computed({
  get: () => 'en', // todo: add language from state
  set: () => {
    // todo: set language to state
    applyDirection()
  },
})

const isRtlLang = $computed(() => ['fa'].includes(language))

function applyDirection() {
  const targetDirection = isRtlLang ? 'rtl' : 'ltr'
  const oppositeDirection = targetDirection === 'ltr' ? 'rtl' : 'ltr'
  document.body.classList.remove(oppositeDirection)
  document.body.classList.add(targetDirection)
  document.body.style.direction = targetDirection
}

function changeLanguage(lang: string) {
  language = lang
  $e('c:navbar:lang', { lang })
}

onMounted(() => {
  applyDirection()
})
</script>

<template>
  <div>
    <v-menu top offset-y>
      <template #activator="{ props }">
        <div style="cursor: pointer" @click="props.onClick">Switch language</div>
      </template>
      <v-list dense class="nc-language-list">
        <v-list-item
          v-for="lang in languages"
          :key="lang.value"
          dense
          :value="lang"
          color="primary"
          @click="changeLanguage(lang)"
        >
          <v-list-item-subtitle class="text-capitalize">
            {{ labels[lang] || lang }}
          </v-list-item-subtitle>
        </v-list-item>
        <v-divider />
        <v-list-item>
          <a
            href="https://docs.nocodb.com/engineering/translation/#how-to-contribute--for-community-members"
            target="_blank"
            class="caption"
          >
            <!-- Help translate -->
            {{ $t('activity.translate') }}
          </a>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<style scoped lang="scss">
::v-deep {
  .nc-language-list {
    max-height: 90vh;
    overflow: auto;
    .v-list-item {
      min-height: 30px !important;
    }
  }
}
</style>
