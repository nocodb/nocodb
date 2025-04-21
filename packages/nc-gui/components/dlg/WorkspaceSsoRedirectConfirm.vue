<script lang="ts" setup>
const workspaceStore = useWorkspace()

const { ssoLoginRequiredDlg } = storeToRefs(workspaceStore)

</script>

<template>
  <NcModalConfirm v-model:visible="ssoLoginRequiredDlg">
      <div class="flex flex-row items-center py-2.25 px-2.75 bg-gray-50 rounded-lg text-gray-700">
        test
      </div>
  </NcModalConfirm>
</template>
