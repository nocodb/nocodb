<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
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
            {{ Languages[lang] || lang }}
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
