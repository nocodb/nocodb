<script setup lang="ts">
import { IsGeodataActiveInj, inject, provide } from '#imports'

// const { t } = useI18n()

// const { api } = useApi()
const GeoDataToggleRef = ref(false)
// provide(IsGeodataActiveInj, GeoDataToggleRef)
provide(ReadonlyInj, GeoDataToggleRef)

async function toggleGeodataFeature() {
  GeoDataToggleRef.value = !GeoDataToggleRef.value
  console.log(GeoDataToggleRef.value)
}

// watch(FOO?.value, () => {
//   console.log('FOO FOO?.value', FOO?.value)
// })
</script>

<template>
  <a-tooltip placement="bottomRight">
    <template #title>
      <span> Toggle GeoData </span>
    </template>
    <div style="{{fontSize: '5px';}}">I: {{ GeoDataToggleRef }}</div>
    <mdi-map-marker class="cursor-pointer" @click="toggleGeodataFeature" />
  </a-tooltip>
</template>
