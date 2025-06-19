<script lang="ts" setup>
const vModel = ref({})
</script>

<template>
  <div class="bg-gray-100">
    <a-card>
      <h4>Simple</h4>
      <div class="flex gap-2">
        <div>
          vModel:
          {{ vModel }}
        </div>
      </div>
    </a-card>
    <div class="m-4">
      <SmartsheetToolbarRowColorFilterUsingFilterPanel v-model="vModel" />
    </div>
  </div>
</template>
