<script setup lang="ts">
import { iconMap } from '~/utils/iconUtils'

if (import.meta.env.PROD) {
  navigateTo('/')
}

const searchQuery = ref('')
const copiedIcon = ref<string | null>(null)

const allIcons = computed(() => {
  return Object.keys(iconMap)
})

const filteredIcons = computed(() => {
  if (!searchQuery.value) {
    return allIcons.value
  }
  return allIcons.value.filter((iconName) => iconName.toLowerCase().includes(searchQuery.value.toLowerCase()))
})

const copyIconName = async (iconName: string) => {
  try {
    await navigator.clipboard.writeText(iconName)
    copiedIcon.value = iconName
    setTimeout(() => {
      copiedIcon.value = null
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

// Get icon component
const getIconComponent = (iconName: string) => {
  return iconMap[iconName as keyof typeof iconMap]
}
</script>

<template>
  <div class="h-screen w-screen bg-nc-bg-gray-light overflow-auto">
    <!-- Header -->
    <div class="sticky top-0 bg-nc-bg-default border-b-1 border-nc-border-gray-medium z-10 shadow-sm">
      <div class="max-w-7xl mx-auto px-6 py-4">
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-3xl font-bold text-nc-content-gray-emphasis mt-2">Icon Library</h1>
          <NcBadge color="gray" class="!h-8">
            <span class="text-sm px-2 text-nc-content-gray-emphasis font-medium">
              {{ filteredIcons.length }} / {{ allIcons.length }}
            </span>
          </NcBadge>
        </div>

        <div class="relative">
          <div class="absolute left-3 top-1/2 transform -translate-y-1/2 text-nc-content-gray-muted pointer-events-none">
            <GeneralIcon icon="search" class="w-4 h-4" />
          </div>
          <a-input v-model:value="searchQuery" placeholder="Search icons..." class="nc-input nc-input-md nc-input-shadow" />
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-6 py-6">
      <div v-if="filteredIcons.length === 0" class="flex flex-col items-center justify-center py-20">
        <div class="w-16 h-16 rounded-full bg-nc-bg-gray-medium flex items-center justify-center mb-4">
          <GeneralIcon icon="search" class="w-8 h-8 text-nc-content-gray-muted" />
        </div>
        <p class="text-nc-content-gray-subtle text-base font-medium mb-1">No icons found</p>
        <p class="text-nc-content-gray-muted text-sm">Try searching with a different keyword</p>
      </div>

      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        <div
          v-for="iconName in filteredIcons"
          :key="iconName"
          class="relative group bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-lg p-4 hover:shadow-hover hover:border-nc-border-brand transition-all cursor-pointer"
          @click="copyIconName(iconName)"
        >
          <div class="flex flex-col items-center justify-center gap-3">
            <div
              class="flex items-center justify-center w-10 h-10 text-nc-content-gray-emphasis group-hover:text-nc-content-brand transition-colors"
            >
              <component :is="getIconComponent(iconName)" class="w-6 h-6 stroke-transparent" />
            </div>

            <div class="text-center w-full">
              <p
                class="text-xs font-mono text-nc-content-gray-subtle break-all leading-tight group-hover:text-nc-content-brand transition-colors"
              >
                {{ iconName }}
              </p>
            </div>
          </div>

          <Transition
            enter-active-class="transition-opacity duration-200"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-opacity duration-200"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div
              v-if="copiedIcon === iconName"
              class="absolute inset-0 bg-nc-bg-green-dark rounded-lg flex items-center justify-center"
            >
              <div class="flex items-center gap-2">
                <GeneralIcon icon="checkFill" class="w-5 h-5 text-nc-content-green-medium" />
                <span class="text-sm font-semibold text-nc-content-green-medium">Copied!</span>
              </div>
            </div>
          </Transition>
          <div
            class="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          >
            <div class="bg-nc-content-gray-emphasis text-nc-bg-default text-xs px-2 py-1 rounded whitespace-nowrap">
              Click to copy
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
