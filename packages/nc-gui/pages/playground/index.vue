<script setup lang="ts">
// Redirect to development environment only
if (import.meta.env.PROD) {
  navigateTo('/')
}

const navItems = [
  {
    name: 'Icons',
    path: '#/playground/icons',
    description: 'Browse all icons from iconUtils',
    icon: 'star',
  },
  {
    name: 'Components',
    path: '#/playground/components',
    description: 'Test NcComponents',
    icon: 'appStore',
  },
]
</script>

<template>
  <div class="h-screen w-screen bg-nc-bg-gray-light overflow-auto">
    <div class="max-w-6xl mx-auto p-8">
      <div class="mb-8">
        <h1 class="text-4xl font-bold text-nc-content-gray-emphasis mb-2">NocoDB Playground</h1>
        <div>
          <NcBadge color="purple" :border="false" class="!h-5 max-w-34 text-nc-content-purple-dark"> Development Only </NcBadge>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a
          v-for="item in navItems"
          :key="item.path"
          :href="item.path"
          class="group block p-6 !no-underline bg-nc-bg-default rounded-lg border-1 border-nc-border-gray-medium hover:border-nc-border-brand transition-all"
        >
          <div class="flex items-start gap-3">
            <div class="flex-none w-10 h-10 rounded-lg bg-nc-bg-brand-light flex items-center justify-center">
              <GeneralIcon :icon="item.icon" class="w-5 h-5 text-nc-content-brand" />
            </div>
            <div class="flex-1">
              <h2
                class="text-lg font-semibold text-nc-content-gray-emphasis mb-1 group-hover:text-nc-content-brand transition-colors"
              >
                {{ item.name }}
              </h2>
              <p class="text-sm text-nc-content-gray-subtle">
                {{ item.description }}
              </p>
            </div>
          </div>
        </a>
      </div>
    </div>
  </div>
</template>
