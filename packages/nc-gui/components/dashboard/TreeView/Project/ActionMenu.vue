<script lang="ts" setup>
import { stringifyRolesObj, type SourceType } from 'nocodb-sdk'

interface Props {
  showBaseOption: (source: SourceType) => boolean
}

defineProps<Props>()

interface Emits {
  (e: 'clickMenu'): void
  (e: 'rename'): void
  (e: 'openErdView', value: SourceType): void
  (e: 'duplicateProject', base: NcProject): void
  (e: 'openBaseSettings', id: string): void
  (e: 'copyProjectInfo'): void
  (e: 'delete'): void
}

const emits = defineEmits<Emits>()

const base = inject(ProjectInj)!

const { appInfo } = useGlobal()

const { orgRoles, isUIAllowed } = useRoles()

const baseRole = computed(() => base.value.project_role || base.value.workspace_role)
</script>

<template>
  <NcMenu
    class="nc-scrollbar-md !min-w-50"
    :style="{
      maxHeight: '70vh',
      overflow: 'overlay',
    }"
    :data-testid="`nc-sidebar-base-${base.title}-options`"
    variant="small"
    @click="emits('clickMenu')"
  >
    <NcMenuItem v-if="isUIAllowed('baseRename')" data-testid="nc-sidebar-project-rename" @click="emits('rename')">
      <div v-e="['c:base:rename']" class="flex gap-2 items-center">
        <GeneralIcon icon="rename" />
        {{ $t('general.rename') }}
      </div>
    </NcMenuItem>

    <NcMenuItem
      v-if="isUIAllowed('baseDuplicate', { roles: [stringifyRolesObj(orgRoles), baseRole].join() })"
      data-testid="nc-sidebar-base-duplicate"
      @click="emits('duplicateProject', base)"
    >
      <div v-e="['c:base:duplicate']" class="flex gap-2 items-center">
        <GeneralIcon icon="duplicate" />
        {{ $t('general.duplicate') }}
      </div>
    </NcMenuItem>

    <NcDivider v-if="['baseDuplicate', 'baseRename'].some((permission) => isUIAllowed(permission))" />

    <!-- Copy Project Info -->
    <NcMenuItem v-if="!isEeUI" key="copy" data-testid="nc-sidebar-base-copy-base-info" @click.stop="emits('copyProjectInfo')">
      <div v-e="['c:base:copy-proj-info']" class="flex gap-2 items-center">
        <GeneralIcon icon="copy" />
        {{ $t('activity.account.projInfo') }}
      </div>
    </NcMenuItem>

    <!-- ERD View -->
    <NcMenuItem
      v-if="base?.sources?.[0]?.enabled"
      key="erd"
      data-testid="nc-sidebar-base-relations"
      @click="emits('openErdView', base?.sources?.[0])"
    >
      <div v-e="['c:base:erd']" class="flex gap-2 items-center">
        <GeneralIcon icon="ncErd" />
        {{ $t('title.relations') }}
      </div>
    </NcMenuItem>

    <!-- Swagger: Rest APIs -->
    <NcMenuItem
      v-if="isUIAllowed('apiDocs')"
      key="api"
      v-e="['e:api-docs']"
      data-testid="nc-sidebar-base-rest-apis"
      @click.stop="openLink(`/api/v2/meta/bases/${base.id}/swagger`, appInfo.ncSiteUrl)"
    >
      <GeneralIcon icon="ncCode" class="opacity-80 !max-w-3.9" />
      {{ $t('activity.account.swagger') }}
    </NcMenuItem>

    <template v-if="base?.sources?.[0]?.enabled && showBaseOption(base?.sources?.[0])">
      <NcDivider />
      <DashboardTreeViewBaseOptions v-model:base="base" :source="base.sources[0]" />
    </template>

    <NcDivider v-if="['baseMiscSettings', 'baseDelete'].some((permission) => isUIAllowed(permission))" />

    <NcMenuItem
      v-if="isUIAllowed('baseMiscSettings')"
      key="teamAndSettings"
      data-testid="nc-sidebar-base-settings"
      class="nc-sidebar-base-base-settings"
      @click="emits('openBaseSettings', base.id!)"
    >
      <div v-e="['c:base:settings']" class="flex gap-2 items-center">
        <GeneralIcon icon="settings" />
        {{ $t('activity.settings') }}
      </div>
    </NcMenuItem>
    <NcMenuItem
      v-if="isUIAllowed('baseDelete', { roles: [stringifyRolesObj(orgRoles), baseRole].join() })"
      data-testid="nc-sidebar-base-delete"
      class="!text-red-500 !hover:bg-red-50"
      @click="emits('delete')"
    >
      <div class="flex gap-2 items-center">
        <GeneralIcon icon="delete" class="w-4" />
        {{ $t('general.delete') }}
      </div>
    </NcMenuItem>
  </NcMenu>
</template>
