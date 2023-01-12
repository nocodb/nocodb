<script lang="ts" setup>
//
</script>

<script lang="ts">
export default {
  name: 'CowriterLayout',
}
</script>

<template>
  <NuxtLayout name="new">
    <a-layout>
      <a-layout-header class="!bg-white !p-2">
        <slot name="header" />
      </a-layout-header>
      <a-layout-content class="h-full overflow-hidden">
        <a-row>
          <a-col class="border-r-1" :span="12">
            <slot name="left" />
          </a-col>
          <a-col class="border-r-1" :span="12">
            <slot name="right" />
          </a-col>
          <a-col :span="24">
            <slot name="middle" />
          </a-col>
        </a-row>
      </a-layout-content>
    </a-layout>
  </NuxtLayout>
</template>

<style lang="scss">
.ant-layout-header {
  @apply !h-20 bg-transparent;
  border-bottom: 1px solid #f5f5f5;
}
</style>
