<script setup lang="ts">
interface Props {
  fullscreen?: boolean
  activeError?: boolean
}

const { fullscreen, activeError } = defineProps<Props>()
const emits = defineEmits(['rename', 'duplicate', 'showDetails', 'clearData', 'delete'])
</script>

<template>
  <div class="flex items-center">
    <NcDropdown :trigger="['click']">
      <NcButton type="text" :size="fullscreen ? 'small' : 'xs'" class="!px-1">
        <GeneralIcon icon="threeDotVertical" />
      </NcButton>

      <template #overlay>
        <NcMenu>
          <template v-if="!activeError">
            <NcMenuItem data-rec="true" class="!hover:text-primary" @click="emits('rename')">
              <GeneralIcon icon="edit" />
              Rename
            </NcMenuItem>
            <NcMenuItem data-rec="true" class="!hover:text-primary" @click="emits('duplicate')">
              <GeneralIcon icon="duplicate" />
              Duplicate
            </NcMenuItem>
            <NcMenuItem data-rec="true" class="!hover:text-primary" @click="emits('showDetails')">
              <GeneralIcon icon="info" />
              Details
            </NcMenuItem>
            <NcDivider />
          </template>
          <NcMenuItem data-rec="true" class="!text-red-500 !hover:bg-red-50" @click="emits('clearData')">
            <GeneralIcon icon="reload" />
            Clear Data
          </NcMenuItem>
          <NcMenuItem data-rec="true" class="!text-red-500 !hover:bg-red-50" @click="emits('delete')">
            <GeneralIcon icon="delete" />
            Delete
          </NcMenuItem>
        </NcMenu>
      </template>
    </NcDropdown>
  </div>
</template>

<style scoped lang="scss"></style>
