<script lang="ts" setup>
import type { SourceType } from 'nocodb-sdk'

interface Props {
  showBaseOption: (source: SourceType) => boolean
  dataReflectionState?: number
  dataReflectionText?: string
}

const props = withDefaults(defineProps<Props>(), {})

interface Emits {
  (e: 'clickMenu', event: Event): void
  (e: 'rename'): void
  (e: 'openErdView', value: SourceType): void
  (e: 'duplicateProject', base: NcProject): void
  (e: 'onDataReflection'): void
  (e: 'openBaseSettings', id: string): void
  (e: 'delete'): void
  (e: 'toggleStarred', id: string): void
}

const emits = defineEmits<Emits>()

const { dataReflectionState, dataReflectionText } = toRefs(props)

const base = inject(ProjectInj)!

const { appInfo } = useGlobal()

const { isFeatureEnabled } = useBetaFeatureToggle()

const { isUIAllowed } = useRoles()
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
    @click="emits('clickMenu', $event)"
  >
    <NcMenuItem v-if="isUIAllowed('baseRename')" data-testid="nc-sidebar-base-rename" @click="emits('rename')">
      <GeneralIcon icon="rename" />
      {{ $t('general.rename') }} {{ $t('objects.project').toLowerCase() }}
    </NcMenuItem>
    <NcMenuItem data-testid="nc-sidebar-base-starred" @click="emits('toggleStarred', base.id!)">
      <GeneralIcon v-if="base.starred" icon="unStar" />
      <GeneralIcon v-else icon="star" />
      <div class="ml-0.25">
        {{ base.starred ? $t('activity.removeFromStarred') : $t('activity.addToStarred') }}
      </div>
    </NcMenuItem>

    <NcMenuItem
      v-if="base.type === NcProjectType.DB && isUIAllowed('baseDuplicate', { roles: base.project_role || base.workspace_role })"
      data-testid="nc-sidebar-base-duplicate"
      @click="emits('duplicateProject', base)"
    >
      <GeneralIcon icon="duplicate" />
      {{ $t('general.duplicate') }} {{ $t('objects.project').toLowerCase() }}
    </NcMenuItem>

    <NcDivider />

    <!-- ERD View -->
    <NcMenuItem
      v-if="base?.sources?.[0]?.enabled"
      key="erd"
      data-testid="nc-sidebar-base-relations"
      @click="emits('openErdView', base?.sources?.[0])"
    >
      <GeneralIcon icon="ncErd" />
      {{ $t('title.relations') }}
    </NcMenuItem>

    <!-- Get Connection -->
    <NcMenuItem
      v-if="
        isFeatureEnabled(FEATURE_FLAG.DATA_REFLECTION) && isUIAllowed('createConnectionDetails') && base?.sources?.[0]?.enabled
      "
      m-key="connect"
      data-testid="nc-sidebar-base-connect"
      @click="emits('onDataReflection')"
    >
      <GeneralLoader v-if="dataReflectionState === 1" />
      <GeneralIcon v-else-if="dataReflectionState === 2" icon="circleCheckSolid" class="text-success" />
      <GeneralIcon v-else-if="dataReflectionState === 3" icon="ncXCircle" />
      <GeneralIntegrationIcon v-else type="nocodb" class="group-hover:text-black" />
      {{ dataReflectionText }}
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
      {{ $t('labels.restApis') }}
    </NcMenuItem>

    <DashboardTreeViewBaseOptions
      v-if="base?.sources?.[0]?.enabled && showBaseOption(base.sources[0])"
      v-model:base="base"
      :source="base.sources[0]"
    />

    <NcDivider v-if="['settings', 'baseDelete'].some((permission) => isUIAllowed(permission))" />

    <NcMenuItem
      v-if="isUIAllowed('baseMiscSettings')"
      key="teamAndSettings"
      v-e="['c:navdraw:base-settings']"
      data-testid="nc-sidebar-base-settings"
      class="nc-sidebar-base-base-settings"
      @click="emits('openBaseSettings', base.id!)"
    >
      <GeneralIcon icon="settings" />
      {{ $t('activity.settings') }}
    </NcMenuItem>
    <NcMenuItem
      v-if="isUIAllowed('baseDelete', { roles: base.project_role || base.workspace_role })"
      class="!text-red-500 !hover:bg-red-50"
      data-testid="nc-sidebar-base-delete"
      @click="emits('delete')"
    >
      <GeneralIcon icon="delete" class="w-4" />
      <div>{{ $t('general.delete') }} {{ $t('objects.project').toLowerCase() }}</div>
    </NcMenuItem>
  </NcMenu>
</template>
