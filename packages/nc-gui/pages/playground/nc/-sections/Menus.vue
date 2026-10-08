<script setup lang="ts">
import PgDemo from '../../-components/PgDemo.vue'
import PgSection from '../../-components/PgSection.vue'

const VARIANTS = ['default', 'small', 'medium', 'large'] as const

const lastAction = ref('—')

const isDropDrawerOpen = ref(false)

function act(action: string) {
  lastAction.value = action
}
</script>

<template>
  <PgSection
    id="menus"
    title="Dropdowns & menus"
    source="NcDropdown · NcMenu · NcMenuItem · NcSubMenu · NcMenuItemLabel · NcMenuItemCopyId · NcMenuItemChangeIcon · NcDivider · NcDropDrawer"
  >
    <PgDemo :label="$t('labels.contextMenu')" :hint="`last action: ${lastAction}`">
      <div class="flex flex-wrap items-start gap-3">
        <NcDropdown>
          <NcButton size="small" type="secondary">
            <div class="flex items-center gap-2">
              {{ $t('labels.viewActions') }}
              <GeneralIcon icon="arrowDown" />
            </div>
          </NcButton>
          <template #overlay>
            <NcMenu variant="small" class="!min-w-56">
              <NcMenuItemCopyId id="vw_k82jx01ab9" :tooltip="$t('tooltip.copyViewId')" label="View ID: vw_k82jx01ab9" />
              <NcDivider />
              <NcMenuItemLabel>{{ $t('general.edit') }}</NcMenuItemLabel>
              <NcMenuItem @click="act('rename')">
                <GeneralIcon icon="ncEdit" class="opacity-80" />
                {{ $t('labels.renameView') }}
              </NcMenuItem>
              <NcMenuItemChangeIcon @change-icon="act('change icon')" />
              <NcMenuItem @click="act('duplicate')">
                <GeneralIcon icon="duplicate" class="opacity-80" />
                {{ $t('labels.duplicateView') }}
                <GeneralShortcutLabel :keys="['Meta', 'D']" class="ml-auto" />
              </NcMenuItem>
              <NcMenuItem disabled>
                <GeneralIcon icon="ncLock" class="opacity-80" />
                Lock view (no permission)
              </NcMenuItem>
              <NcDivider />
              <NcSubMenu variant="small">
                <template #title>
                  <GeneralIcon icon="ncDownload" class="opacity-80" />
                  {{ $t('general.download') }}
                </template>
                <NcMenuItem @click="act('csv')">CSV</NcMenuItem>
                <NcMenuItem @click="act('excel')">Excel</NcMenuItem>
              </NcSubMenu>
              <NcSubMenu variant="small">
                <template #title>
                  <GeneralIcon icon="ncUpload" class="opacity-80" />
                  {{ $t('general.upload') }}
                </template>
                <NcMenuItemLabel>Upload data</NcMenuItemLabel>
                <NcMenuItem @click="act('upload csv')">CSV</NcMenuItem>
                <NcMenuItem @click="act('upload json')">JSON</NcMenuItem>
              </NcSubMenu>
              <NcDivider />
              <NcMenuItem theme="ai" @click="act('ai')">
                <GeneralIcon icon="ncAutoAwesome" class="opacity-80" />
                {{ $t('labels.generateWithAi') }}
              </NcMenuItem>
              <NcMenuItem danger @click="act('delete')">
                <GeneralIcon icon="ncTrash" />
                {{ $t('labels.deleteView') }}
              </NcMenuItem>
            </NcMenu>
          </template>
        </NcDropdown>

        <NcDropdown :trigger="['hover']" placement="bottomRight">
          <NcButton size="small" type="secondary">Hover trigger</NcButton>
          <template #overlay>
            <NcMenu variant="small">
              <NcMenuItem @click="act('share')"
                ><GeneralIcon icon="ncShare" class="opacity-80" /> {{ $t('general.share') }}</NcMenuItem
              >
              <NcMenuItem @click="act('star')"
                ><GeneralIcon icon="ncStar" class="opacity-80" /> {{ $t('labels.addToFavourites') }}</NcMenuItem
              >
            </NcMenu>
          </template>
        </NcDropdown>

        <NcDropdown disabled>
          <NcButton size="small" type="secondary" disabled>Disabled dropdown</NcButton>
          <template #overlay>
            <div />
          </template>
        </NcDropdown>

        <NcDropdown>
          <NcButton size="small" type="secondary">Custom overlay</NcButton>
          <template #overlay>
            <div class="w-64 p-3 flex flex-col gap-2">
              <div class="text-captionBold">{{ $t('objects.copyViewConfig.rowHeight') }}</div>
              <div class="text-captionSm text-nc-content-gray-muted">Arbitrary content inside NcDropdown's overlay.</div>
              <NcButton size="small" @click="act('apply')">{{ $t('general.apply') }}</NcButton>
            </div>
          </template>
        </NcDropdown>
      </div>
    </PgDemo>

    <PgDemo label="Menu variants" hint="rendered inline">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div v-for="variant in VARIANTS" :key="variant" class="flex flex-col gap-1.5">
          <div class="text-captionXs text-nc-content-gray-muted font-mono">{{ variant }}</div>
          <!-- outside NcDropdown a-menu renders .ant-menu-*, but the variant styles target .ant-dropdown-menu-* -->
          <NcMenu
            :variant="variant"
            prefix-cls="ant-dropdown-menu"
            class="rounded-lg border-1 border-nc-border-gray-medium shadow-lg bg-nc-bg-default"
          >
            <NcMenuItem><GeneralIcon icon="ncEdit" class="opacity-80" /> {{ $t('general.rename') }}</NcMenuItem>
            <NcMenuItem><GeneralIcon icon="ncCopy" class="opacity-80" /> {{ $t('activity.copyLink') }}</NcMenuItem>
            <NcDivider />
            <NcMenuItem danger><GeneralIcon icon="ncTrash" /> {{ $t('general.delete') }}</NcMenuItem>
          </NcMenu>
        </div>
      </div>
    </PgDemo>

    <PgDemo label="NcDropDrawer" hint="dropdown on desktop, bottom drawer on mobile">
      <NcDropDrawer v-model:visible="isDropDrawerOpen" :title="$t('labels.sortBy')">
        <NcButton size="small" type="secondary">Open drop drawer</NcButton>
        <template #overlay>
          <NcMenu variant="small">
            <NcMenuItem @click="isDropDrawerOpen = false">Created time</NcMenuItem>
            <NcMenuItem @click="isDropDrawerOpen = false">Last modified</NcMenuItem>
            <NcMenuItem @click="isDropDrawerOpen = false">{{ $t('general.title') }}</NcMenuItem>
          </NcMenu>
        </template>
      </NcDropDrawer>
    </PgDemo>
  </PgSection>
</template>
