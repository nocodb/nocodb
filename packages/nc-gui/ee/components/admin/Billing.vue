<script lang="ts" setup>
interface Props {}

const props = withDefaults(defineProps<Props>(), {})

const {} = toRefs(props)

const { activeWorkspaceOrOrgId } = useProvidePaymentStore(true)

const orgStore = useOrg()

const { org } = storeToRefs(orgStore)
</script>

<template>
  <div class="flex flex-col" data-testid="nc-admin-billing">
    <div class="nc-breadcrumb px-2">
      <div class="nc-breadcrumb-item">
        {{ org.title }}
      </div>
      <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />
      <div class="nc-breadcrumb-item active">
        {{ $t('general.billing') }}
      </div>
    </div>
    <NcPageHeader>
      <template #icon>
        <GeneralIcon icon="dollerSign" class="flex-none h-5 w-5" />
      </template>
      <template #title>
        <span data-rec="true">
          {{ $t('general.billing') }}
        </span>
      </template>
    </NcPageHeader>

    <div
      class="nc-content-max-w flex-1 max-h-[calc(100vh_-_100px)] overflow-y-auto nc-scrollbar-thin flex flex-col items-center gap-6 p-6"
    ></div>
  </div>
</template>

<style lang="scss" scoped></style>
