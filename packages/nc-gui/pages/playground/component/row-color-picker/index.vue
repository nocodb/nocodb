<script lang="ts" setup>
const color1 = ref('')
</script>

<template>
  <div class="bg-gray-100">
    <a-card>
      <h4>Simple</h4>

      Selected color: {{ color1 }}
      <div class="inline-block min-h-[24px] min-w-[24px] h-[24px] w-[24px] rounded-md" :class="[`bg-${color1}`]"></div>
    </a-card>
    <NcRowColorPicker v-model="color1" />
    <a-card>
      <h4>As dropdown <NcRowColorPickerDropdown v-model="color1" /></h4>
    </a-card>
  </div>
</template>
