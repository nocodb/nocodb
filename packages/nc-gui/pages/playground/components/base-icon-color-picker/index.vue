<script lang="ts" setup>
const color1 = ref('')
</script>

<template>
  <div class="bg-gray-100">
    <a-card>
      <h4>Simple</h4>

      Selected color: {{ color1 }}
      <div class="inline-block min-h-[24px] min-w-[24px] h-[24px] w-[24px] rounded-md" :class="[`bg-${color1}`]"></div>
      <GeneralBaseIconColorPicker :model-value="color1" type="database" @update:model-value="color1 = $event">
      </GeneralBaseIconColorPicker>
    </a-card>
  </div>
</template>
