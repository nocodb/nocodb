<script setup lang="ts">
// Decorative, aria-hidden copy of the marketing site's live workflow editor (landing-page components/nc/workflow.tsx):
// the "Celebrate closed deals" workflow after a run. Demo data is sample content, not UI copy.

interface Deal {
  name: string
  owner: string
  value: number
}

interface FlowNode {
  icon: keyof typeof iconMap
  title: string
  description: string
}

const { isDark } = useTheme()

const { t } = useI18n()

// presence palette from ee/composables/usePresence.ts
const peers = [
  { name: 'Lena Fischer', color: '#10b981' },
  { name: 'Arjun Patel', color: '#f59e0b' },
]

const deal: Deal = { name: 'Aurora Analytics expansion', owner: 'Maya Chen', value: 48000 }

const nodes: FlowNode[] = [
  { icon: 'ncFilter', title: 'When record matches conditions', description: 'A deal moves to Closed won' },
  { icon: 'slack', title: 'Send message', description: 'Tell the team in #sales-wins' },
  { icon: 'ncRecordCreate', title: 'Create record', description: 'Start the rollout plan in Onboarding' },
]

const tabs: { label: string; icon: keyof typeof iconMap }[] = [
  { label: t('objects.roleType.editor'), icon: 'ncAutomation' },
  { label: t('general.logs'), icon: 'audit' },
  { label: t('labels.settings'), icon: 'ncSettings' },
]

function chip(color: string) {
  const { bg, ink } = getSelectChipColors(color, isDark.value)
  return { backgroundColor: bg, color: ink }
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
}

function usd(value: number) {
  return `$${Math.round(value).toLocaleString('en-US')}`
}

function detail(index: number, d: Deal) {
  if (index === 1) return `🎉 ${d.name} just closed for ${usd(d.value)}. Nice work, ${d.owner.split(' ')[0]}!`
  return `Kickoff call · ${d.owner}`
}
</script>

<template>
  <div aria-hidden="true" class="h-full flex bg-nc-bg-default text-nc-content-gray select-none pointer-events-none">
    <!-- rail -->
    <div
      class="w-12 flex-none flex flex-col items-center gap-3 pt-3 border-r-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight"
    >
      <GeneralNocoIcon inline :size="26" />
      <GeneralIcon icon="ncDatabase" class="mt-1 w-4 h-4 text-nc-content-gray-muted" />
      <span class="w-8 h-8 rounded-lg flex items-center justify-center bg-nc-bg-brand text-nc-content-brand">
        <GeneralIcon icon="ncAutomation" class="w-4 h-4" />
      </span>
      <GeneralIcon icon="ncLayout" class="w-4 h-4 text-nc-content-gray-muted" />
      <GeneralIcon icon="ncSettings" class="w-4 h-4 text-nc-content-gray-muted" />
    </div>

    <!-- main -->
    <div class="flex-1 min-w-0 flex flex-col">
      <div class="h-[46px] flex-none flex items-center gap-2 px-4 border-b-1 border-nc-border-gray-medium text-bodyDefaultSm">
        <span class="w-4 h-4 rounded bg-[#36bfff]" />
        <span class="text-nc-content-gray-muted">Sales CRM</span>
        <span class="text-nc-content-gray-muted">/</span>
        <GeneralIcon icon="ncAutomation" class="w-4 h-4 text-nc-content-gray-subtle" />
        <span class="text-bodyDefaultSmBold text-nc-content-gray-emphasis">Celebrate closed deals</span>
        <div class="ml-6 flex items-center -space-x-1.5">
          <span
            v-for="(peer, i) of peers"
            :key="peer.name"
            class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white ring-2 ring-[var(--nc-bg-default)]"
            :style="{ backgroundColor: peer.color, zIndex: 2 - i }"
          >
            {{ initials(peer.name) }}
          </span>
        </div>
      </div>

      <!-- workflow topbar: tabs, Live pill and the run counter (kept in the visible left part) -->
      <div class="h-12 flex-none flex items-center gap-2 px-2 border-b-1 border-nc-border-gray-medium">
        <div
          v-for="(tab, i) of tabs"
          :key="tab.icon"
          class="relative flex items-center gap-2 px-2 py-1 text-bodyBold"
          :class="i === 0 ? 'text-nc-content-brand' : 'text-nc-content-gray-muted'"
        >
          <GeneralIcon :icon="tab.icon" />
          {{ tab.label }}
          <span v-if="i === 0" class="absolute inset-x-0 -bottom-[9px] h-0.5 rounded-t-md bg-nc-content-brand" />
        </div>
        <div
          class="ml-4 rounded-md flex items-center gap-2 px-2 py-0.5 bg-nc-bg-green-dark text-nc-content-green-dark text-captionBold"
        >
          <span class="block w-2 h-2 rounded-full bg-nc-green-600" />
          {{ $t('general.live') }}
        </div>
        <div class="ml-2 flex items-center gap-1.5 text-caption text-nc-content-gray-subtle">
          {{ $t('labels.runHistory') }}
          <span class="text-captionBold text-nc-content-gray-emphasis tabular-nums">142</span>
        </div>
      </div>

      <!-- canvas -->
      <div class="nc-auth-wf-canvas flex-1 min-h-0 overflow-hidden bg-nc-bg-gray-extralight">
        <div class="w-[560px] flex flex-col items-center pt-9">
          <template v-for="(node, i) of nodes" :key="node.title">
            <!-- edge -->
            <svg v-if="i > 0" width="4" height="40" class="flex-none overflow-visible">
              <line x1="2" y1="0" x2="2" y2="40" stroke="var(--nc-content-brand)" stroke-width="2" />
            </svg>

            <div class="relative w-77 flex flex-col border-1 border-nc-border-gray-medium rounded-lg p-3 bg-nc-bg-default">
              <span v-if="i > 0" class="absolute -top-1 left-1/2 w-2 h-2 -translate-x-1/2 rounded-full bg-nc-content-brand" />

              <!-- status badge, as WorkflowNodeStatusIcon draws it -->
              <div
                class="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center bg-nc-green-700 dark:bg-nc-green-200"
              >
                <GeneralIcon icon="ncCheck" class="text-base-white !w-3 !h-3" />
              </div>

              <div class="flex gap-2.5 w-full items-center">
                <div
                  class="w-6 h-6 flex-none flex items-center justify-center rounded-md p-1 bg-nc-bg-brand text-nc-content-brand-disabled"
                >
                  <GeneralIcon :icon="node.icon" class="!w-5 !h-5 stroke-transparent" />
                </div>
                <div class="text-nc-content-gray truncate flex-1 text-bodyBold">{{ node.title }}</div>
              </div>
              <div class="my-2 h-px bg-nc-bg-gray-medium" />
              <div class="text-bodySm text-nc-content-gray line-clamp-2">{{ node.description }}</div>

              <!-- what the run did at the step -->
              <div class="mt-2 flex items-center gap-1.5 min-w-0 px-2 py-1 rounded-md bg-nc-bg-gray-extralight">
                <template v-if="i === 0">
                  <span class="truncate text-bodySmBold text-nc-content-brand">{{ deal.name }}</span>
                  <span
                    class="flex-none h-[18px] inline-flex items-center px-1.5 rounded-xl text-captionSm"
                    :style="chip('#d1f7c4')"
                  >
                    Closed won
                  </span>
                </template>
                <span v-else class="truncate text-bodySm text-nc-content-gray-subtle">{{ detail(i, deal) }}</span>
              </div>
            </div>
          </template>

          <svg width="4" height="24" class="flex-none">
            <line x1="2" y1="0" x2="2" y2="24" stroke="var(--nc-border-gray-dark)" stroke-width="1" />
          </svg>
          <span
            class="w-5 h-5 rounded-full flex items-center justify-center border-1 border-nc-border-gray-medium bg-nc-bg-default text-nc-content-gray-muted"
          >
            <GeneralIcon icon="plus" class="w-3 h-3" />
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// vue-flow's <Background /> dot grid
.nc-auth-wf-canvas {
  background-image: radial-gradient(var(--nc-border-gray-dark) 1px, transparent 1px);
  background-size: 20px 20px;
}
</style>
