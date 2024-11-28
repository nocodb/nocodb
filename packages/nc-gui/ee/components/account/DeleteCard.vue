<script lang="ts" setup>
import type { ApiTokenType, BaseType, IntegrationType, SourceType, WorkspaceType } from 'nocodb-sdk'
const _props = defineProps<{
  entity:
    | (BaseType & {
        workspace_title: string
        base_role: string
      })
    | WorkspaceType
    | SourceType
    | ApiTokenType
    | IntegrationType
    | any
  entityDef: {
    title: string
    key: string
    titleKey: string
  }
}>()
</script>

<template>
  <div class="flex items-center gap-2">
    <div class="icon">
      <GeneralWorkspaceIcon v-if="entityDef.key === 'workspaces'" :workspace="entity" size="medium" />
      <GeneralProjectIcon v-else-if="entityDef.key === 'bases'" :color="parseProp(entity.meta).iconColor" />
      <GeneralBaseLogo v-else-if="entityDef.key === 'sources'" />
      <GeneralIcon v-else-if="entityDef.key === 'apiTokens'" class="text-yellow-500 mt-1" icon="key" />
    </div>
    <div class="flex flex-col truncate">
      <template v-if="entityDef.key === 'bases'">
        <div class="flex gap-1 items-center">
          <div class="font-semibold truncate max-w-1/2">{{ entity.workspace_title }}</div>
          <GeneralIcon icon="arrowRight" class="text-gray-500 mt-0.5" />
          <div class="font-semibold truncate">{{ entity[entityDef.titleKey] }}</div>
        </div>
      </template>
      <template v-else>
        <div class="font-semibold truncate">{{ entity[entityDef.titleKey] }}</div>
      </template>
    </div>
  </div>
</template>

<style></style>
