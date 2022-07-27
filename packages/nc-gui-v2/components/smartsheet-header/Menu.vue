<script lang="ts" setup>
import MdiEditIcon from '~icons/mdi/pencil'
import MdiStarIcon from '~icons/mdi/star'
import MdiDeleteIcon from '~icons/mdi/delete-outline'
import MdiMenuDownIcon from '~icons/mdi/menu-down'

const editColumnDropdown = $ref(false)
</script>

<template>
  <a-dropdown v-model:visible="editColumnDropdown" :trigger="['click']">
    <span />
    <template #overlay>
      <SmartsheetColumnEditOrAdd @click.stop />
    </template>
  </a-dropdown>
  <a-dropdown :trigger="['hover']">
    <MdiMenuDownIcon class="text-grey" />
    <template #overlay>
      <div class="shadow bg-white">
        <div class="nc-column-edit nc-menu-item" @click="editColumnDropdown = true">
          <MdiEditIcon class="text-primary" />
          <!-- Edit -->
          {{ $t('general.edit') }}
        </div>
        <div v-t="['a:column:set-primary']" class="nc-menu-item">
          <MdiStarIcon class="text-primary" />

          <!--       todo : tooltip -->
          <!-- Set as Primary value -->
          {{ $t('activity.setPrimary') }}
          <!--        <span class="caption font-weight-bold">Primary value will be shown in place of primary key</span> -->
        </div>
        <div class="nc-column-delete nc-menu-item">
          <MdiDeleteIcon class="text-error" />
          <!-- Delete -->
          {{ $t('general.delete') }}
        </div>
      </div>
    </template>
  </a-dropdown>
</template>
