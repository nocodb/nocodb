<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { Icon as IconifyIcon } from '@iconify/vue'

const materialIcons = ['switch', 'ac_unit', 'zoom_in', 'zoom_out', 'zoom_out_map']
const currentIcon = ref('android')
const showPicker = ref(true)
const searchQuery = ref('')

const filteredIcons = computed(() => {
  const search = searchQuery.value.toLowerCase()
  return materialIcons.filter((icon) => icon.includes(search))
})

const updateIcon = (event) => {
  currentIcon.value = event.target.value
}

const selectIcon = (icon) => {
  currentIcon.value = icon
  //   showPicker.value = false
}

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
        <label for="icon">Icon picker</label>
        <!-- <input
            ref="iconInput"
            type="text"
            class="use-material-icon-picker"
            :value="currentIcon"
            @focus="showPicker = true"
            @input="updateIcon"
          /> -->
        <i class="material-icons material-icon-picker-prefix prefix" v-text="currentIcon"></i>
        <div v-if="showPicker" class="material-icon-picker" tabindex="-1">
          <input v-model="searchQuery" type="text" placeholder="Search" />
          <ul class="icons">
            <!-- <li v-for="icon in filteredIcons" :key="icon" class="material-icons" @click="selectIcon(icon)" v-text="icon"></li> -->
            <IconifyIcon
              v-for="icon in filteredIcons"
              :key="icon"
              class="bg-blue-100 mr-3 p-2 rounded-lg h-10 min-w-10 text-lg"
              :icon="`material-symbols:${icon}`"
            ></IconifyIcon>
          </ul>
        </div>
      </div>
    </a-collapse-panel>
  </a-collapse>
</template>

<style>
/* .material-icon-picker {
  position: absolute;
  background: #fcfcfc;
  text-align: center;
  box-shadow: 0 16px 24px 2px rgba(0, 0, 0, 0.14), 0 6px 30px 5px rgba(0, 0, 0, 0.12), 0 8px 10px -5px rgba(0, 0, 0, 0.3);
  padding: 20px;
}

.material-icon-picker:focus {
  outline: none;
}

.material-icon-picker-prefix {
  top: 0.5rem;
}

.material-icon-picker .icons {
  max-width: 300px;
  max-height: 200px;
  overflow: scroll;
}

div.material-icon-picker input[type='text'] {
  width: 100%;
}

.material-icon-picker .material-icons {
  font-size: 30px;
  cursor: pointer;
  border-radius: 50%;
  padding: 10px;
  margin: 3px;
  transition: 0.2s;
}

.material-icon-picker .material-icons:hover {
  background: #ececec;
} */
</style>
