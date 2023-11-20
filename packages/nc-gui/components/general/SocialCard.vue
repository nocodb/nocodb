<script setup lang="ts">
import { enumColor as colors, iconMap, useDialog, useGlobal, useNuxtApp } from '#imports'

const { $e } = useNuxtApp()

const { lang: currentLang } = useGlobal()

const isRtlLang = computed(() => ['fa', 'ar'].includes(currentLang.value))

function openKeyboardShortcutDialog() {
  $e('a:actions:keyboard-shortcut')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgKeyboardShortcuts'), {
    'modelValue': isOpen,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false
    close(1000)
  }
}
</script>

<template>
  <a-card :body-style="{ padding: '0px' }" class="w-[300px] shadow-sm !rounded-lg">
    <a-list class="w-full" dense>
      <slot name="before" />

      <a-list-item>
        <nuxt-link
          v-e="['e:docs']"
          no-prefetch
          no-rel
          class="text-primary !no-underline !text-current"
          target="_blank"
          to="https://docs.nocodb.com/"
        >
          <div class="ml-3 flex items-center text-sm">
            <component :is="iconMap.book" class="text-lg text-accent" />
            <span class="ml-3">{{ $t('labels.documentation') }}</span>
          </div>
        </nuxt-link>
      </a-list-item>

      <a-list-item>
        <nuxt-link
          v-e="['e:api-docs']"
          no-prefetch
          no-rel
          class="text-primary !no-underline !text-current"
          target="_blank"
          to="https://apis.nocodb.com/"
        >
          <div class="ml-3 flex items-center text-sm">
            <component :is="iconMap.json" class="text-lg text-green-500" />
            <!--            todo:  i18n -->
            <span class="ml-3">API {{ $t('labels.documentation') }}</span>
          </div>
        </nuxt-link>
      </a-list-item>

      <a-list-item>
        <nuxt-link
          v-e="['e:community:github']"
          no-prefetch
          no-rel
          class="text-primary !no-underline !text-current"
          to="https://github.com/nocodb/nocodb"
          target="_blank"
        >
          <div class="flex items-center text-sm">
            <component :is="iconMap.github" class="mx-3 text-lg" />
            <div v-if="isRtlLang">
              <!-- us on Github -->
              {{ $t('labels.community.starUs2') }}
              <!-- Star -->
              {{ $t('labels.community.starUs1') }}
              <mdi-star-outline />
            </div>
            <div v-else class="flex items-center">
              <!-- Star -->
              {{ $t('labels.community.starUs1') }}
              {{ ' ' }}
              <!-- us on Github -->
              {{ $t('labels.community.starUs2') }}
            </div>
          </div>
        </nuxt-link>
      </a-list-item>

      <a-list-item>
        <nuxt-link
          v-e="['e:community:book-demo']"
          no-prefetch
          no-rel
          class="!no-underline !text-current"
          to="https://calendly.com/nocodb-meeting"
          target="_blank"
        >
          <div class="flex items-center text-sm">
            <component :is="iconMap.calendar" class="mx-3 text-lg" :color="colors.dark[3 % colors.dark.length]" />
            <!-- Book a Free DEMO -->
            <div>
              {{ $t('labels.community.bookDemo') }}
            </div>
          </div>
        </nuxt-link>
      </a-list-item>

      <a-list-item>
        <nuxt-link
          v-e="['e:community:discord']"
          no-prefetch
          no-rel
          class="!no-underline !text-current"
          to="https://discord.gg/5RgZmkW"
          target="_blank"
        >
          <div class="flex items-center text-sm">
            <component :is="iconMap.discord" class="mx-3 text-lg" :color="colors.dark[0 % colors.dark.length]" />
            <!-- Get your questions answered -->
            <div>
              {{ $t('labels.community.getAnswered') }}
            </div>
          </div>
        </nuxt-link>
      </a-list-item>

      <a-list-item>
        <nuxt-link
          v-e="['e:community:twitter']"
          no-prefetch
          no-rel
          class="!no-underline !text-current"
          to="https://twitter.com/NocoDB"
          target="_blank"
        >
          <div class="flex items-center text-sm">
            <component :is="iconMap.twitter" class="mx-3 text-lg" :color="colors.dark[1 % colors.dark.length]" />
            <!-- Follow NocoDB -->
            <div>
              {{ $t('labels.community.followNocodb') }}
            </div>
          </div>
        </nuxt-link>
      </a-list-item>

      <a-list-item>
        <nuxt-link
          v-e="['e:hiring']"
          no-prefetch
          no-rel
          class="!no-underline !text-current"
          target="_blank"
          to="http://careers.nocodb.com"
        >
          <div class="flex items-center text-sm">
            <!--            todo:  i18n -->
            <div class="ml-3">
              🚀 <span class="ml-3">{{ $t('labels.weAreHiring') }}!!!</span>
            </div>
          </div>
        </nuxt-link>
      </a-list-item>

      <a-list-item>
        <nuxt-link
          v-e="['e:community:reddit']"
          no-prefetch
          no-rel
          class="!no-underline !text-current"
          target="_blank"
          to="https://www.reddit.com/r/NocoDB/"
        >
          <div class="ml-3 flex items-center text-sm">
            <component :is="iconMap.reddit" color="red" />
            <span class="ml-4">/r/NocoDB/</span>
          </div>
        </nuxt-link>
      </a-list-item>

      <a-list-item @click="openKeyboardShortcutDialog">
        <div class="ml-3 flex items-center text-sm cursor-pointer">
          <component :is="iconMap.keyboard" class="text-lg text-primary" />
          <span class="ml-4">{{ $t('title.keyboardShortcut') }}</span>
        </div>
      </a-list-item>
    </a-list>
  </a-card>
</template>

<style scoped>
:deep(.ant-list-item) {
  @apply hover:(bg-gray-100 !text-primary);
}
</style>
