<script setup lang="ts">
import { IsGeodataActiveInj, ReadonlyInj, useGlobal } from '#imports'
// import { geodataToggleState } from ''


// const { t } = useI18n()

// const { api } = useApi()
// const { includeM2M } = useGlobal()
// const GeoDataToggleRef = ref(true)
// provide(IsGeodataActiveInj, GeoDataToggleRef)
// provide(ReadonlyInj, GeoDataToggleRef)

async function toggleGeodataFeature() {
  geodataToggleState.show = !geodataToggleState.show
  // console.log(GeoDataToggleRef.value)
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
    <!-- <div style="{{fontSize: '5px';}}"></div> -->
    <mdi-map-marker class="cursor-pointer" @click="toggleGeodataFeature" />
  </a-tooltip>
</template>
