<script setup lang="ts">
import PgDemo from '../../-components/PgDemo.vue'
import PgSection from '../../-components/PgSection.vue'

const activeTab = ref('fields')

const aiTab = ref('chat')

const page = ref(3)

const pageSize = ref(25)

const pageV2 = ref(1)

const pageSizeV2 = ref(25)

const stripePage = ref(1)

const stripePageSize = ref(10)

const activeNav = ref('members')

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
              <NcButton size="xsmall" type="text">Docs</NcButton>
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
            :total="1248"
            entity-name="records"
            show-size-changer
            :use-stored-page-size="false"
          />
        </div>
        <div class="flex items-center gap-3">
          <span class="w-28 text-captionXs text-nc-content-gray-muted font-mono">simple</span>
          <NcPagination v-model:current="page" :page-size="pageSize" :total="1248" mode="simple" :use-stored-page-size="false" />
        </div>
        <div class="flex items-center gap-3">
          <span class="w-28 text-captionXs text-nc-content-gray-muted font-mono">V2 default</span>
          <NcPaginationV2
            v-model:current="pageV2"
            v-model:page-size="pageSizeV2"
            :total="312"
            entity-name="rows"
            show-size-changer
          />
        </div>
        <div class="flex items-center gap-3">
          <span class="w-28 text-captionXs text-nc-content-gray-muted font-mono">V2 variant v2</span>
          <NcPaginationV2 v-model:current="pageV2" v-model:page-size="pageSizeV2" :total="312" variant="v2" />
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
        <NcGroupedSettings title="Appearance">
          <NcSwitch :checked="true">Show row numbers</NcSwitch>
          <NcSwitch :checked="false">Wrap long text</NcSwitch>
        </NcGroupedSettings>
        <NcGroupedSettings title="Advanced" default-collapsed>
          <NcSwitch :checked="false">Enable webhooks v2</NcSwitch>
        </NcGroupedSettings>
      </PgDemo>
    </div>
  </PgSection>
</template>
