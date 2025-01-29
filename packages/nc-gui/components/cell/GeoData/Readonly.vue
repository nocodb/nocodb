<script lang="ts" setup>
interface Props {
  modelValue?: string | null
  localEditEnabled?: boolean
}

const props = defineProps<Props>()

const emits = defineEmits(['update:localEditEnabled'])

const localEditEnabled = useVModel(props, 'localEditEnabled', emits, { defaultValue: false })

const readOnly = inject(ReadonlyInj, ref(false))

const isLocationSet = ref(false)

const latLongStr = computed(() => {
  const [latitude, longitude] = (props.modelValue || '').split(';')

  if (latitude) isLocationSet.value = true
  else if (isLocationSet.value) isLocationSet.value = false

  return latitude && longitude ? `${latitude}; ${longitude}` : 'Set location'
})
</script>

<template>
  <div :class="!isLocationSet ? 'flex justify-center' : ''">
    <template v-if="!isLocationSet">
      <div v-if="readOnly" data-testid="nc-geo-data-set-location-button">&nbsp;</div>
      <NcButton
        v-else
        size="xsmall"
        type="secondary"
        data-testid="nc-geo-data-set-location-button"
        class="w-full max-w-64 !px-2 group !text-gray-500 !hover:text-primary !text-xs"
        @click="localEditEnabled = true"
      >
        <div class="flex items-center gap-1.5">
          <component :is="iconMap.mapMarker" class="transform group-hover:(!text-accent scale-110) text-[0.75rem]" />

          {{ latLongStr }}
        </div>
      </NcButton>
    </template>

    <div
      v-else
      data-testid="nc-geo-data-lat-long-set"
      tabindex="0"
      class="nc-cell-field h-full w-full flex items-center py-1 focus-visible:!outline-none focus:!outline-none"
      @click="localEditEnabled = true"
    >
      <span class="truncate">
        {{ latLongStr }}
      </span>
    </div>
  </div>
</template>
