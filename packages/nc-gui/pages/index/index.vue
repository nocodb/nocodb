<script lang="ts" setup>
import { useRoute, useSidebar } from '#imports'

const route = useRoute()

useSidebar('nc-left-sidebar', { hasSidebar: false })
</script>

<template>
  <NuxtLayout>
    <div
      class="min-h-[calc(100vh_-_var(--header-height))] bg-primary bg-opacity-5 flex flex-wrap justify-between xl:flex-nowrap gap-6 py-6 px-4 pt-65px md:(px-12)"
    >
      <div class="flex-1 justify-end hidden xl:(flex)">
        <div>
          <LazyGeneralSponsors />
        </div>
      </div>

      <div class="min-w-2/4 xl:max-w-2/4 w-full mx-auto">
        <NuxtPage />
      </div>

      <div class="flex flex-1 justify-between gap-6 lg:block">
        <template v-if="route.name === 'index-index'">
          <TransitionGroup name="page" mode="out-in">
            <div key="social-card">
              <LazyGeneralSocialCard />
            </div>

            <div key="sponsors" class="block mt-0 lg:(!mt-6) xl:hidden">
              <LazyGeneralSponsors />
            </div>
          </TransitionGroup>
        </template>
      </div>
    </div>
  </NuxtLayout>
</template>
