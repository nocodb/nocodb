<script setup lang="ts">
const props = defineProps<{
  allowMetaWrite: boolean
  allowDataWrite: boolean
}>()

const emits = defineEmits(['update:allowMetaWrite', 'update:allowDataWrite'])

const dataWrite = useVModel(props, 'allowDataWrite', emits)
const metaWrite = useVModel(props, 'allowMetaWrite', emits)
</script>

<template>
  <a-form-item>
    <template #help>
      <span class="text-small">
        {{ $t('tooltip.allowDataWrite') }}
      </span>
    </template>
    <template #label>
      <div class="flex gap-1 justify-end">
        <span>
          {{ $t('labels.allowDataWrite') }}
        </span>
      </div>
    </template>
    <div class="flex justify-start">
      <NcTooltip :disabled="!metaWrite" placement="topLeft">
        <template #title>
          {{ $t('tooltip.dataWriteOptionDisabled') }}
        </template>
        <a-switch v-model:checked="dataWrite" :disabled="metaWrite" data-testid="nc-allow-data-write" size="small"></a-switch>
      </NcTooltip>
    </div>
  </a-form-item>
  <a-form-item>
    <template #help>
      <span class="text-small">
        <span class="font-weight-medium" :class="{ 'nc-allow-meta-write-help': metaWrite }">
          {{ $t('labels.notRecommended') }}:
        </span>
        {{ $t('tooltip.allowMetaWrite') }}
      </span>
    </template>
    <template #label>
      <div class="flex gap-1 justify-end">
        <span>
          {{ $t('labels.allowMetaWrite') }}
        </span>
      </div>
    </template>
    <a-switch v-model:checked="metaWrite" data-testid="nc-allow-meta-write" class="nc-allow-meta-write" size="small"></a-switch>
  </a-form-item>
</template>

<style scoped>
.nc-allow-meta-write.ant-switch-checked {
  background: #b33870;
}

.nc-allow-meta-write-help {
  color: #b33870;
}
</style>
