<script lang="ts" setup>
const props = defineProps<{
  buttons?: boolean
}>()

const baseCreateDlg = ref(false)

const openCreateProjectDlg = () => {
  baseCreateDlg.value = true
}
</script>

<template>
  <div class="flex items-center justify-center mt-8">
    <div class="flex flex-col gap-4 items-center text-gray-500">
      <NcIconsInbox />
      <div class="font-weight-medium">No Projects</div>
      <template v-if="props.buttons">
        <div class="text-xs">Create Base</div>
        <div class="flex gap-2 justify mt-1">
          <a-button class="flex-1 nc-btn" @click="openCreateProjectDlg()">
            <div class="flex gap-2 items-center justify-center text-xs">
              <GeneralProjectIcon class="text-[#2824FB] text-lg" />
              New Database Base
            </div>
          </a-button>
        </div>

        <WorkspaceCreateProjectDlg v-model="baseCreateDlg" />
      </template>
    </div>
  </div>
</template>

<style scoped></style>
