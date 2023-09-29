<script setup lang="ts">
import { durationOptions, useVModel } from '#imports'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const durationOptionList =
  durationOptions.map((o) => ({
    ...o,
    // h:mm:ss (e.g. 3:45, 1:23:40)
    title: `${o.title} ${o.example}`,
  })) || []

// set default value
vModel.value.meta = {
  duration: 0,
  ...vModel.value.meta,
}
</script>

<template>
  <a-row>
    <a-col :span="24">
      <span class="prose-sm mt-2">{{ $t('labels.durationInfo') }}</span>
    </a-col>

    <a-col :span="24">
      <a-form-item :label="$t('labels.durationFormat')">
        <a-select v-model:value="vModel.meta.duration" class="w-52" dropdown-class-name="nc-dropdown-duration-option">
          <a-select-option v-for="(duration, i) of durationOptionList" :key="i" :value="duration.id">
            {{ duration.title }}
          </a-select-option>
        </a-select>
      </a-form-item>
    </a-col>
  </a-row>
</template>
