<script lang="ts" setup>
import MdiOpenInNew from '~icons/mdi/open-in-new'
const { isUIAllowed } = useUIPermission()
</script>

<template>
  <div>
    <a-button v-t="['c:view:share']" outlined class="nc-btn-share-view nc-toolbar-btn" size="small">
      <div class="flex align-center gap-1">
        <MdiOpenInNew class="text-grey" />
        <!-- Share View -->
        {{ $t('activity.shareView') }}
      </div>
    </a-button>
  </div>
</template>

<style scoped />
