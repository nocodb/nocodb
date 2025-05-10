<script lang="ts" setup>
interface Props {
  colors: []
}

interface Emits {
  (event: 'removeAll', model: void): void
}

const props = defineProps<Props>()
const emits = defineEmits<Emits>()
</script>

<template>
  <div class="min-w-[640px] w-auto inline-block h-auto rounded-2xl bg-white p-4">
    <div class="flex flex-col gap-3">
      <div>This is for filters</div>
      <div>
        <NcButton type="text" size="small" class="hover:!text-brand-500 hover:!bg-transparent">
          <template #icon>
            <component :is="iconMap.plus" />
          </template>
          Add Color
        </NcButton>
      </div>
    </div>
  </div>
</template>
