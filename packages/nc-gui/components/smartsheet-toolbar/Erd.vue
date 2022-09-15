<script lang="ts" setup>
const meta = inject(MetaInj)
</script>

<template>
  <div class="w-full h-full !py-0 !px-2" style="height: 70vh">
    <ErdView :table="meta" />
  </div>
</template>
