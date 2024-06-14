<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const durationOptionList =
  durationOptions.map((o) => ({
    ...o,
    // h:mm:ss (e.g. 3:45, 1:23:40)
    title: `${o.title}`,
  })) || []

// set default value
vModel.value.meta = {
  ...columnDefaultMeta[UITypes.Duration],
  ...(vModel.value.meta || {}),
}
</script>

<template>
  <a-row>
    <a-col :span="24">
      <a-form-item :label="$t('general.format')">
        <a-select v-model:value="vModel.meta.duration" class="w-52" dropdown-class-name="nc-dropdown-duration-option">
          <template #suffixIcon> <GeneralIcon icon="arrowDown" class="text-gray-700" /> </template>

          <a-select-option v-for="(duration, i) of durationOptionList" :key="i" :value="duration.id">
            <div class="flex gap-2 w-full truncate items-center" :data-testid="duration.title">
              <NcTooltip show-on-truncate-only class="flex-1 truncate">
                <template #title> {{ duration.title }}</template>
                {{ duration.title }}
              </NcTooltip>

              <component
                :is="iconMap.check"
                v-if="vModel.meta.duration === duration.id"
                id="nc-selected-item-icon"
                class="text-primary w-4 h-4"
              />
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
    </a-col>
  </a-row>
</template>
