<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <a-form-item>
    <div class="flex flex-col gap-2 text-sm text-nc-content-gray-subtle py-1">
      <div>
        {{ t('msg.autoNumberFieldInfo') }}
      </div>
    </div>
  </a-form-item>
</template>
