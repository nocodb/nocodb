<script lang="ts" setup>
import { computed, ref } from 'vue'
import { Icon as IconifyIcon } from '@iconify/vue'
import allIcons from '@iconify-json/mdi/chars.json'

const dashboardStore = useDashboardStore()
// const { updateIconOfNumberWidget } = dashboardStore

const materialIcons = computed(() => {
  return Object.values(allIcons).map((icon) => `mdi:${icon}`)
})
// const currentIcon = ref('android')
// const showPicker = ref(true)
const searchQuery = ref('')

const filteredIcons = computed(() => {
  const search = searchQuery.value.toLowerCase()
  return materialIcons.value.filter((icon) => icon.includes(search))
})

const updateIcon = (icon: string) => {
  dashboardStore.updateIconOfNumberWidget(icon)
  debugger
}

// const selectIcon = (icon) => {
//   currentIcon.value = icon
//   //   showPicker.value = false
// }

// onMounted(() => {
//   const handleOutsideClick = (event) => {
//     if (!event.target.classList.contains('use-material-icon-picker')) {
//       showPicker.value = false
//     }
//   }
//   document.addEventListener('mouseup', handleOutsideClick)
//   return () => {
//     document.removeEventListener('mouseup', handleOutsideClick)
//   }
// })
</script>

<template>
  <a-collapse expand-icon-position="right" accordion :bordered="false" class="nc-dashboard-layouts-propspanel-collapse">
    <a-collapse-panel class="nc-dashboard-layouts-propspanel-collapse-panel" header="Icon selector">
      <div class="input-field col s4">
        <div class="bg-gray-50 p-4 rounded-lg" tabindex="-1">
          <input v-model="searchQuery" type="text" class="rounded-lg w-full border-gray-100 mb-4" placeholder="Search icon" />
          <ul class="flex flex-wrap max-h-40 overflow-y-auto justify-between">
            <IconifyIcon
              v-for="icon in filteredIcons"
              :key="icon"
              class="p-2 rounded-lg h-10 min-w-10 text-lg"
              :icon="icon"
              @click="updateIcon(icon)"
            ></IconifyIcon>
          </ul>
        </div>
      </div>
    </a-collapse-panel>
  </a-collapse>
</template>
