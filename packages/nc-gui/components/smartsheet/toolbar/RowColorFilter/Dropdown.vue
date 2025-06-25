<script setup lang="ts">
const { isMobileMode } = useGlobal()
const isToolbarIconMode = inject(
  IsToolbarIconMode,
  computed(() => false),
)
const isShowColoringButton = ref(false)
</script>

<template>
  <!-- TODO: show "ONLY IN EE feature" -->
  <template v-if="isShowColoringButton">
    <NcDropdown>
      <NcButton type="text" size="small" class="nc-toolbar-btn !border-0 !h-7">
        <div class="flex items-center gap-1 min-h-5">
          <div class="flex items-center gap-2">
            <component :is="iconMap.ncPaintRoller" class="h-4 w-4" />

            <!-- Group By -->
            <span v-if="!isMobileMode && !isToolbarIconMode" class="text-capitalize !text-[13px] font-medium">Coloring</span>
          </div>
          <!-- <span v-if="groupedByColumnIds?.length" class="bg-brand-50 text-brand-500 nc-toolbar-btn-chip">{{
            groupedByColumnIds.length
          }}</span> -->
        </div>
      </NcButton>
      <template #overlay>
        <SmartsheetToolbarRowColorFilterTypeOptionOSS />
      </template>
    </NcDropdown>
  </template>
  <template v-else></template>
</template>
