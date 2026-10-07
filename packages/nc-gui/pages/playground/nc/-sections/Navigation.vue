<script setup lang="ts">
import PgDemo from '../../-components/PgDemo.vue'
import PgSection from '../../-components/PgSection.vue'

const activeTab = ref('fields')

const aiTab = ref('chat')

const page = ref(3)

const TOTAL_RECORDS = 1248

const pageSize = ref(25)

// NcPagination leaves the page untouched on a size change — callers clamp it (smartsheet/Pagination.vue)
watch(pageSize, (size) => {
  page.value = Math.min(page.value, Math.ceil(TOTAL_RECORDS / size))
})

const pageV2 = ref(1)

const TOTAL_ROWS_V2 = 312

const pageSizeV2 = ref(25)

watch(pageSizeV2, (size) => {
  pageV2.value = Math.min(pageV2.value, Math.ceil(TOTAL_ROWS_V2 / size))
})

const stripePage = ref(1)

const stripePageSize = ref(10)

const activeNav = ref('members')

const showRowNumbers = ref(true)

const wrapText = ref(false)

const webhooksV2 = ref(false)

const NAV_ITEMS = [
  { key: 'overview', icon: 'ncHome', label: 'Overview' },
  { key: 'members', icon: 'ncUsers', label: 'Members', count: 24 },
  { key: 'integrations', icon: 'ncZap', label: 'Integrations' },
  { key: 'billing', icon: 'ncCreditCard', label: 'Billing' },
  { key: 'audit', icon: 'ncFileText', label: 'Audit logs', disabled: true },
]
</script>

<template>
  <PgSection
    id="navigation"
    title="Navigation"
    source="NcTabs · NcPagination · NcPaginationV2 · NcPaginationStripe · NcSidebarMenuItem · NcPageHeader · NcGroupedSettings"
  >
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <PgDemo label="NcTabs">
        <div class="flex flex-col gap-4">
          <NcTabs v-model:active-key="activeTab">
            <a-tab-pane key="fields" tab="Fields">
              <div class="py-3 text-caption text-nc-content-gray-subtle">12 fields, 2 hidden.</div>
            </a-tab-pane>
            <a-tab-pane key="relations" tab="Relations">
              <div class="py-3 text-caption text-nc-content-gray-subtle">3 linked tables.</div>
            </a-tab-pane>
            <a-tab-pane key="api" tab="APIs">
              <div class="py-3 text-caption text-nc-content-gray-subtle">REST and SDK snippets.</div>
            </a-tab-pane>
            <a-tab-pane key="webhooks" tab="Webhooks" disabled />
            <template #rightExtra>
              <NcButton size="xsmall" type="text" class="!px-2">Docs</NcButton>
            </template>
          </NcTabs>
          <NcTabs v-model:active-key="aiTab" theme="ai" centered>
            <a-tab-pane key="chat" tab="Chat" />
            <a-tab-pane key="history" tab="History" />
            <a-tab-pane key="prompts" tab="Prompts" />
          </NcTabs>
        </div>
      </PgDemo>

      <PgDemo label="NcSidebarMenuItem">
        <div class="w-56">
          <NcSidebarMenuItem
            v-for="item in NAV_ITEMS"
            :key="item.key"
            :icon="item.icon"
            :active="activeNav === item.key"
            :disabled="item.disabled"
            @click="activeNav = item.key"
          >
            {{ item.label }}
            <template v-if="item.count" #extraRight>
              <span class="text-captionXs text-nc-content-gray-muted pr-1">{{ item.count }}</span>
            </template>
          </NcSidebarMenuItem>
        </div>
      </PgDemo>
    </div>

    <PgDemo label="Pagination" hint="full · simple · v2 · stripe (cursor)">
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <span class="w-28 text-captionXs text-nc-content-gray-muted font-mono">full</span>
          <NcPagination
            v-model:current="page"
            v-model:page-size="pageSize"
            :total="TOTAL_RECORDS"
            entity-name="records"
            show-size-changer
            :use-stored-page-size="false"
          />
        </div>
        <div class="flex items-center gap-3">
          <span class="w-28 text-captionXs text-nc-content-gray-muted font-mono">simple</span>
          <NcPagination
            v-model:current="page"
            :page-size="pageSize"
            :total="TOTAL_RECORDS"
            mode="simple"
            :use-stored-page-size="false"
          />
        </div>
        <div class="flex items-center gap-3">
          <span class="w-28 text-captionXs text-nc-content-gray-muted font-mono">V2 default</span>
          <NcPaginationV2
            v-model:current="pageV2"
            v-model:page-size="pageSizeV2"
            :total="TOTAL_ROWS_V2"
            entity-name="rows"
            show-size-changer
          />
        </div>
        <div class="flex items-center gap-3">
          <span class="w-28 text-captionXs text-nc-content-gray-muted font-mono">V2 variant v2</span>
          <NcPaginationV2 v-model:current="pageV2" v-model:page-size="pageSizeV2" :total="TOTAL_ROWS_V2" variant="v2" />
        </div>
        <div class="flex items-center gap-3">
          <span class="w-28 text-captionXs text-nc-content-gray-muted font-mono">stripe</span>
          <NcPaginationStripe
            v-model:current="stripePage"
            v-model:page-size="stripePageSize"
            entity-name="invoices"
            show-size-changer
            :has-more="stripePage < 4"
          />
        </div>
      </div>
    </PgDemo>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <PgDemo label="NcPageHeader" :padded="false">
        <NcPageHeader>
          <template #icon>
            <GeneralIcon icon="ncSettings" class="w-5 h-5" />
          </template>
          <template #title>Workspace settings</template>
          <template #action>
            <NcButton size="small" type="secondary">Invite</NcButton>
          </template>
        </NcPageHeader>
        <div class="p-4 text-captionSm text-nc-content-gray-muted">Page body…</div>
      </PgDemo>

      <PgDemo label="NcGroupedSettings" :padded="false">
        <!-- dashboard widget config pattern: each NcSwitch in its own block div -->
        <NcGroupedSettings title="Appearance">
          <div class="flex flex-col gap-3">
            <div>
              <NcSwitch v-model:checked="showRowNumbers">
                <span class="text-caption text-nc-content-gray select-none">Show row numbers</span>
              </NcSwitch>
            </div>
            <div>
              <NcSwitch v-model:checked="wrapText">
                <span class="text-caption text-nc-content-gray select-none">Wrap long text</span>
              </NcSwitch>
            </div>
          </div>
        </NcGroupedSettings>
        <NcGroupedSettings title="Advanced" default-collapsed>
          <div>
            <NcSwitch v-model:checked="webhooksV2">
              <span class="text-caption text-nc-content-gray select-none">Enable webhooks v2</span>
            </NcSwitch>
          </div>
        </NcGroupedSettings>
      </PgDemo>
    </div>
  </PgSection>
</template>
