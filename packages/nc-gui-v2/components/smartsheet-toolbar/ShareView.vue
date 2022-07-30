<script lang="ts" setup>
import MdiOpenInNew from '~icons/mdi/open-in-new'
import { useUIPermission } from '#imports'

const { isUIAllowed } = useUIPermission()
</script>

<template>
  <div v-t="['c:view:share']" class="nc-sidebar-right-item hover:after:bg-secondary/75 group">
    <MdiOpenInNew class="group-hover:(!text-white)" />
    {{ $t('activity.shareView') }}
  </div>
</template>
