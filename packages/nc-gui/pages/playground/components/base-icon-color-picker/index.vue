<script lang="ts" setup>
const color1 = ref('')

const managedApp = ref({
  managed_app_master: false,
  managed_app_id: 'prr1pr4xx9vqn5c',
})
</script>

<template>
  <div class="bg-nc-bg-gray-light">
    <a-card>
      <h4>Simple</h4>

      Selected color: {{ color1 }}

      <div class="flex items-center gap-2">
        <NcSwitch v-model:checked="managedApp.managed_app_master"> Toggle Managed App state </NcSwitch>
      </div>
      <div class="inline-block min-h-[24px] min-w-[24px] h-[24px] w-[24px] rounded-md" :class="[`bg-${color1}`]"></div>
      <GeneralBaseIconColorPicker
        :model-value="color1"
        type="database"
        @update:model-value="color1 = $event"
        :managed-app="managedApp"
      >
      </GeneralBaseIconColorPicker>
    </a-card>
  </div>
</template>
