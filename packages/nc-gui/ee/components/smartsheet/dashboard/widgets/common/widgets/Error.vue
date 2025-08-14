<script setup lang="ts">
const isPublic = inject(IsPublicInj, ref(false))
</script>

<template>
  <NcTooltip v-if="!isPublic">
    <template #title>
      <slot>
        {{ $t('labels.configurationError') }}
      </slot>
    </template>

    <div class="flex items-center gap-2 rounded-md bg-nc-bg-orange-light text-caption text-nc-content-orange-dark px-2 py-1">
      <GeneralIcon icon="ncAlertTriangle" />
      <slot>
        {{ $t('labels.configurationError') }}
      </slot>
    </div>
  </NcTooltip>
</template>
