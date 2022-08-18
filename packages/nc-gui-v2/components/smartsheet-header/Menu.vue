<script lang="ts" setup>
import { Modal, message } from 'ant-design-vue'
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { useNuxtApp } from '#app'
import { useMetas, ColumnInj, MetaInj, IsLockedInj, extractSdkResponseErrorMsg } from '#imports'
import MdiEditIcon from '~icons/mdi/pencil'
import MdiStarIcon from '~icons/mdi/star'
import MdiDeleteIcon from '~icons/mdi/delete-outline'
import MdiMenuDownIcon from '~icons/mdi/menu-down'

const { virtual = false } = defineProps<{ virtual?: boolean }>()

const emit = defineEmits(['edit'])

const column = inject(ColumnInj)

const meta = inject(MetaInj)

const isLocked = inject(IsLockedInj)

const { $api, $e } = useNuxtApp()

const { t } = useI18n()

const { getMeta } = useMetas()

const deleteColumn = () =>
  Modal.confirm({
    title: h('div', ['Do you want to delete ', h('span', { class: 'font-weight-bold' }, [column?.value?.title]), ' column ?']),
    okText: t('general.delete'),
    okType: 'danger',
    cancelText: t('general.cancel'),
    async onOk() {
      try {
        await $api.dbTableColumn.delete(column?.value?.id as string)
        getMeta(meta?.value?.id as string, true)
      } catch (e) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    },
  })

const setAsPrimaryValue = async () => {
  try {
    await $api.dbTableColumn.primaryColumnSet(column?.value?.id as string)
    getMeta(meta?.value?.id as string, true)
    message.success('Successfully updated as primary column')
    $e('a:column:set-primary')
  } catch (e) {
    message.error('Failed to update primary column')
  }
}
</script>

<template>
  <a-dropdown v-if="!isLocked" placement="bottomRight" :trigger="['click']">
    <MdiMenuDownIcon class="h-full text-grey nc-ui-dt-dropdown cursor-pointer outline-0" />
    <template #overlay>
      <a-menu class="shadow bg-white">
        <a-menu-item @click="emit('edit')">
          <div class="nc-column-edit nc-header-menu-item">
            <MdiEditIcon class="text-primary" />
            <!-- Edit -->
            {{ $t('general.edit') }}
          </div>
        </a-menu-item>
        <a-menu-item v-if="!virtual" @click="setAsPrimaryValue">
          <div class="nc-column-set-primary nc-header-menu-item">
            <MdiStarIcon class="text-primary" />

            <!--       todo : tooltip -->
            <!-- Set as Primary value -->
            {{ $t('activity.setPrimary') }}
          </div>
          <!--        <span class="caption font-weight-bold">Primary value will be shown in place of primary key</span> -->
        </a-menu-item>
        <a-menu-item @click="deleteColumn">
          <div class="nc-column-delete nc-header-menu-item">
            <MdiDeleteIcon class="text-error" />
            <!-- Delete -->
            {{ $t('general.delete') }}
          </div>
        </a-menu-item>
      </a-menu>
    </template>
  </a-dropdown>
</template>

<style scoped>
.nc-header-menu-item {
  @apply text-xs flex items-center px-1 py-2 gap-1;
}
</style>
