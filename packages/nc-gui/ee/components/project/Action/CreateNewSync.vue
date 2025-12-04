<script setup lang="ts">
interface Props {
  baseId?: string
}
defineProps<Props>()
</script>

<template>
  <ProjectSyncCreateProvider :base-id="baseId">
    <template #default="{ createSyncClick }">
      <ProjectActionItem
        v-e="['c:table:create-sync']"
        data-testid="proj-view-btn__create-sync"
        :label="$t('labels.syncData')"
        :subtext="$t('msg.subText.syncData')"
        @click="
          () => {
            createSyncClick()
          }
        "
      >
        <template #icon>
          <GeneralIcon icon="ncZap" class="!h-7 !w-7 !text-nc-content-green-dark" />
        </template>
      </ProjectActionItem>
    </template>
  </ProjectSyncCreateProvider>
</template>
