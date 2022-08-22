<script lang="ts" setup>
import { useRoute } from '#imports'

const route = useRoute()
</script>

<template>
  <NuxtLayout>
    <div
      class="min-h-[calc(100vh_-_var(--header-height))] h-auto bg-primary bg-opacity-5 flex flex-col lg:flex-row flex-wrap gap-6 py-6 px-12 pt-65px"
    >
      <div class="flex-1 justify-end hidden xl:(flex)">
        <GeneralSponsors />
      </div>

      <div class="min-w-2/4 xl:max-w-2/4 w-full mx-auto">
        <NuxtPage />
      </div>

      <div class="flex flex-1 justify-between gap-6 lg:block">
        <template v-if="route.name === 'index-index'">
          <TransitionGroup name="page" mode="out-in">
            <div>
              <GeneralSocialCard />
            </div>

            <div class="block mt-0 lg:(!mt-6) xl:hidden">
              <GeneralSponsors />
            </div>
          </TransitionGroup>
        </template>
      </div>
    </div>
  </NuxtLayout>
</template>
