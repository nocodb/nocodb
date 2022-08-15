<script setup lang="ts">
import { enumColor as colors } from '#imports'

const { lang: currentLang } = useGlobal()

const isRtlLang = $computed(() => ['fa'].includes(currentLang.value))
</script>

<template>
  <a-card :body-style="{ padding: '0' }" class="w-[300px] shadow-sm rounded-lg">
    <a-list class="w-full" dense>
      <a-list-item>
        <nuxt-link class="text-primary" to="https://github.com/nocodb/nocodb" target="_blank">
          <div class="flex items-center text-sm">
            <mdi-github class="mx-3 text-lg" />
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
              <mdi-star-outline class="mx-1" />
              <!-- us on Github -->
              {{ $t('labels.community.starUs2') }}
            </div>
          </div>
        </nuxt-link>
      </a-list-item>
      <a-list-item>
        <nuxt-link class="text-primary" to="https://calendly.com/nocodb-meeting" target="_blank">
          <div class="flex items-center text-sm">
            <mdi-calendar-month class="mx-3 text-lg" :color="colors.dark[3 % colors.dark.length]" />
            <!-- Book a Free DEMO -->
            <div>
              {{ $t('labels.community.bookDemo') }}
            </div>
          </div>
        </nuxt-link>
      </a-list-item>
      <a-list-item>
        <nuxt-link class="text-primary" to="https://discord.gg/5RgZmkW" target="_blank">
          <div class="flex items-center text-sm">
            <mdi-discord class="mx-3 text-lg" :color="colors.dark[0 % colors.dark.length]" />
            <!-- Get your questions answered -->
            <div>
              {{ $t('labels.community.getAnswered') }}
            </div>
          </div>
        </nuxt-link>
      </a-list-item>
      <a-list-item>
        <nuxt-link class="text-primary" to="https://twitter.com/NocoDB" target="_blank">
          <div class="flex items-center text-sm">
            <mdi-twitter class="mx-3 text-lg" :color="colors.dark[1 % colors.dark.length]" />
            <!-- Follow NocoDB -->
            <div>
              {{ $t('labels.community.followNocodb') }}
            </div>
          </div>
        </nuxt-link>
      </a-list-item>
      <a-list-item v-t="['e:hiring']">
        <nuxt-link class="text-primary" target="_blank" to="http://careers.nocodb.com">
          <div class="flex items-center text-sm">
            <div class="ml-3">🚀 <span class="ml-2">We are Hiring!!!</span></div>
          </div>
        </nuxt-link>
      </a-list-item>
    </a-list>
  </a-card>
</template>

<style scoped>
:deep(.ant-list-item) {
  @apply hover:(bg-gray-100 !text-primary);
}
</style>
