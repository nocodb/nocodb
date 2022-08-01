<script lang="ts" setup>
import { Modal } from 'ant-design-vue'
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toastification'
import { useNuxtApp } from '#app'
import useMetas from '~/composables/useMetas'
import { ColumnInj, MetaInj } from '~/context'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'
import MdiEditIcon from '~icons/mdi/pencil'
import MdiStarIcon from '~icons/mdi/star'
import MdiDeleteIcon from '~icons/mdi/delete-outline'
import MdiMenuDownIcon from '~icons/mdi/menu-down'

const editColumnDropdown = $ref(false)

const column = inject(ColumnInj)
const meta = inject(MetaInj)

const { $api } = useNuxtApp()
const { t } = useI18n()
const toast = useToast()
const { getMeta } = useMetas()

const deleteColumn = () =>
  Modal.confirm({
    title: h('div', { innerHTML: `Do you want to delete <span class="font-weight-bold">'${column?.title}'</span> column ?` }),
    okText: t('general.delete'),
    okType: 'danger',
    cancelText: t('general.cancel'),
    async onOk() {
      try {
        await $api.dbTableColumn.delete(column?.id as string)
        getMeta(meta?.value?.id as string, true)
      } catch (e) {
        toast.error(await extractSdkResponseErrorMsg(e))
      }
    },
  })

const setAsPrimaryValue = async () => {
  try {
    await $api.dbTableColumn.primaryColumnSet(column?.id as string)
    getMeta(meta?.value?.id as string, true)
    toast.success('Successfully updated as primary column')
  } catch (e) {
    console.log(e)
    toast.error('Failed to update primary column')
  }
}
</script>

<template>
  <a-dropdown v-model:visible="editColumnDropdown" :trigger="['click']">
    <span />
    <template #overlay>
      <SmartsheetColumnEditOrAdd @click.stop @cancel="editColumnDropdown = false" />
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
        <div v-t="['a:column:set-primary']" class="nc-menu-item" @click="setAsPrimaryValue">
          <MdiStarIcon class="text-primary" />

          <!--       todo : tooltip -->
          <!-- Set as Primary value -->
          {{ $t('activity.setPrimary') }}
          <!--        <span class="caption font-weight-bold">Primary value will be shown in place of primary key</span> -->
        </div>
        <div class="nc-column-delete nc-menu-item" @click="deleteColumn">
          <MdiDeleteIcon class="text-error" />
          <!-- Delete -->
          {{ $t('general.delete') }}
        </div>
      </div>
    </template>
  </a-dropdown>
</template>
