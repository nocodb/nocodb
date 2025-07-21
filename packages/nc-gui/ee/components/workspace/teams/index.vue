<script lang="ts" setup>
interface Props {
  workspaceId?: string
}

const props = withDefaults(defineProps<Props>(), {})

const { workspaceId } = toRefs(props)

const { t } = useI18n()

const isAdminPanel = inject(IsAdminPanelInj, ref(false))

const searchQuery = ref('')

const isTeamsLoading = ref(false)
</script>

<template>
  <div
    class="nc-teams-container overflow-auto nc-scrollbar-thin relative"
    :class="{
      'h-[calc(100vh-144px)]': isAdminPanel,
      'h-[calc(100vh-92px)]': !isAdminPanel,
    }"
  >
    <div class="nc-teams-wrapper h-full max-w-[1200px] mx-auto py-6 px-6 flex flex-col gap-6 sticky top-0">
      <div class="w-full flex items-center justify-between gap-3">
        <a-input
          v-model:value="searchQuery"
          allow-clear
          :disabled="isTeamsLoading"
          class="nc-input-border-on-value !max-w-90 !h-8 !px-3 !py-1 !rounded-lg"
          :placeholder="$t('placeholder.searchATeam')"
        >
          <template #prefix>
            <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-gray-500 group-hover:text-black" />
          </template>
        </a-input>

        <NcButton size="small" :disabled="isTeamsLoading" data-testid="nc-new-team-btn">
          <div class="flex items-center gap-2">
            <GeneralIcon icon="plus" class="h-4 w-4" />
            {{ $t('labels.newTeam') }}
          </div>
        </NcButton>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
