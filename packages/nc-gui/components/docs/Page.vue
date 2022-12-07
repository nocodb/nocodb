<script lang="ts" setup>
const { openedPage } = useDocs()
</script>

<template>
  <a-layout-content>
    <div v-if="openedPage" class="mx-20 mt-16 flex flex-col gap-y-6">
      <a-typography-title>
        {{ openedPage.title }}
      </a-typography-title>
      <div>
        {{ openedPage.content }}
      </div>
    </div>
  </a-layout-content>
</template>
