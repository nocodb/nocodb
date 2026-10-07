<script setup lang="ts">
import { ViewTypes } from 'nocodb-sdk'
import type { TableType, ViewType } from 'nocodb-sdk'
import PgDemo from '../../-components/PgDemo.vue'
import PgSection from '../../-components/PgSection.vue'

const PIE_VALUES = [
  { label: 'Records', value: 226, total: 1000, fill: 'var(--nc-content-brand)' },
  { label: 'Storage', value: 0.8, total: 1, fill: 'var(--nc-content-orange-medium)' },
  { label: 'API calls', value: 980, total: 1000, fill: 'var(--nc-content-red-medium)' },
]

const SLIDES = [
  { title: 'Grid view', body: 'Spreadsheet-style editing with grouping and aggregation.', icon: 'grid' },
  { title: 'Kanban view', body: 'Drag cards across stacks to move work forward.', icon: 'kanban' },
  { title: 'Calendar view', body: 'Plan launches by day, week or month.', icon: 'calendar' },
  { title: 'Form view', body: 'Collect submissions straight into a table.', icon: 'form' },
]

const VIEW_TYPES = [
  { type: ViewTypes.GRID, label: 'Grid' },
  { type: ViewTypes.GALLERY, label: 'Gallery' },
  { type: ViewTypes.KANBAN, label: 'Kanban' },
  { type: ViewTypes.CALENDAR, label: 'Calendar' },
  { type: ViewTypes.FORM, label: 'Form' },
  { type: ViewTypes.MAP, label: 'Map' },
  { type: ViewTypes.LIST, label: 'List' },
  { type: ViewTypes.TIMELINE, label: 'Timeline' },
]

const TABLES: TableType[] = [
  { id: 't1', title: 'Campaigns' } as TableType,
  { id: 't2', title: 'Leads (synced)', synced: true } as TableType,
  { id: 't3', title: 'Pipeline', meta: { icon: '🚀' } } as TableType,
]

const ICON_USERS = [
  { email: 'priya@acme.dev', display_name: 'Priya Raman' },
  { email: 'lucas@acme.dev', display_name: '' },
]

const TooltipGlideItems = [
  { type: 'pg', title: 'PostgreSQL' },
  { type: 'mysql2', title: 'MySQL' },
  { type: 'sqlite3', title: 'SQLite' },
  { type: 'mssql', title: 'SQL Server' },
  { type: 'oracledb', title: 'Oracle' },
]

const color = ref('#cfdffe')

const shouldThrow = ref(false)

const Bomb = defineComponent({
  props: { explode: Boolean },
  setup(props) {
    return () => {
      if (props.explode) throw new Error('Playground: simulated render error')
      return h('div', { class: 'text-caption text-nc-content-gray-subtle' }, 'Child renders normally.')
    }
  },
})

function viewOf(type: ViewTypes) {
  return { id: `v${type}`, title: `View ${type}`, type } as ViewType
}
</script>

<template>
  <PgSection
    id="misc"
    title="Data display & utilities"
    source="NcPieChart · NcCarousel · NcColorPanel · NcFile · NcUserInfo · NcIcon* · NcTooltipProvider · NcErrorBoundary"
  >
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <PgDemo label="NcPieChart" hint="usage meters">
        <div class="flex flex-wrap gap-6">
          <div v-for="p in PIE_VALUES" :key="p.label" class="flex items-center gap-3">
            <NcPieChart
              :size="40"
              :value="p.value"
              :total="p.total"
              :fill-color="p.fill"
              background-color="var(--nc-bg-gray-medium)"
            />
            <div>
              <div class="text-captionBold">{{ p.label }}</div>
              <div class="text-captionSm text-nc-content-gray-muted">{{ Math.round((p.value / p.total) * 100) }}% used</div>
            </div>
          </div>
        </div>
      </PgDemo>

      <PgDemo label="NcColorPanel" :hint="color">
        <NcColorPanel v-model="color" preview-label="In progress" />
      </PgDemo>

      <PgDemo label="NcCarousel">
        <!-- .embla clips overflow, so the arrows sit inside the slide; Next ships `absolute` (loses to .ant-btn), hence !absolute -->
        <NcCarousel class="w-full rounded-xl">
          <NcCarouselContent>
            <NcCarouselItem v-for="s in SLIDES" :key="s.title">
              <div
                class="h-36 rounded-xl border-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight px-12 py-4 flex flex-col gap-2"
              >
                <GeneralIcon :icon="s.icon" class="w-6 h-6 text-nc-content-brand" />
                <div class="text-captionBold">{{ s.title }}</div>
                <div class="text-captionSm text-nc-content-gray-subtle">{{ s.body }}</div>
              </div>
            </NcCarouselItem>
          </NcCarouselContent>
          <NcCarouselPrevious class="left-3 top-1/2 -translate-y-1/2" />
          <NcCarouselNext class="!absolute right-3 top-1/2 -translate-y-1/2" />
        </NcCarousel>
      </PgDemo>

      <PgDemo label="NcFile" hint="trigger + upload modal (upload needs a base)">
        <NcFile multiple accept="image/*,.pdf" :max-size="10" />
      </PgDemo>

      <PgDemo label="NcUserInfo">
        <div class="flex flex-col gap-3">
          <NcUserInfo :user="ICON_USERS[0]" />
          <NcUserInfo :user="ICON_USERS[1]" />
          <NcUserInfo :user="ICON_USERS[0]" disabled />
        </div>
      </PgDemo>

      <PgDemo label="Entity icons" hint="NcIconView · Table · Dashboard · Script · Workflow">
        <div class="flex flex-col gap-3">
          <div class="flex flex-wrap items-center gap-4">
            <div v-for="v in VIEW_TYPES" :key="v.type" class="flex items-center gap-1.5 text-captionSm">
              <NcIconView :view="viewOf(v.type)" />
              {{ v.label }}
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-4">
            <div v-for="t in TABLES" :key="t.id" class="flex items-center gap-1.5 text-captionSm">
              <NcIconTable :table="t" />
              {{ t.title }}
            </div>
            <div class="flex items-center gap-1.5 text-captionSm">
              <NcIconDashboard :dashboard="{ id: 'd1', title: 'KPIs' }" /> Dashboard
            </div>
            <div class="flex items-center gap-1.5 text-captionSm">
              <NcIconScript :script="{ id: 's1', title: 'Cleanup' }" /> Script
            </div>
            <div class="flex items-center gap-1.5 text-captionSm">
              <NcIconWorkflow :workflow="{ id: 'w1', title: 'Onboarding' }" /> Workflow
            </div>
          </div>
        </div>
      </PgDemo>

      <PgDemo label="NcTooltipProvider (glide)" hint="hover along the row">
        <NcTooltipProvider glide :delay="200">
          <div class="flex gap-2">
            <NcTooltipItem v-for="item in TooltipGlideItems" :key="item.type" :title="item.title">
              <div class="w-9 h-9 rounded-lg border-1 border-nc-border-gray-medium flex items-center justify-center">
                <GeneralIntegrationIcon :type="item.type" size="md" />
              </div>
            </NcTooltipItem>
          </div>
        </NcTooltipProvider>
      </PgDemo>

      <PgDemo label="NcErrorBoundary" hint="catches a child render error and shows the error toast">
        <div class="flex items-center gap-3">
          <NcErrorBoundary>
            <component :is="Bomb" :explode="shouldThrow" />
          </NcErrorBoundary>
          <NcButton size="small" type="danger" @click="shouldThrow = !shouldThrow">
            {{ shouldThrow ? 'Reset' : 'Throw error' }}
          </NcButton>
        </div>
      </PgDemo>
    </div>
  </PgSection>
</template>
