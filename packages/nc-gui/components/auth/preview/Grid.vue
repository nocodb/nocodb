<script setup lang="ts">
// The grid scene of the auth panel's live preview: a teammate edits deals (landing-page components/nc/grid + presence).
// Demo data is sample content, not UI copy.

interface Deal {
  id: number
  name: string
  account: string
  stage: string
  owner: string
  value: number
  probability: number
}

interface Peer {
  name: string
  color: string
}

interface Focus {
  row: number
  field: keyof Deal
  editing: boolean
}

interface Flash {
  row: number
  field: keyof Deal
  at: number
}

const { isDark } = useTheme()

// presence palette from ee/composables/usePresence.ts
const lena: Peer = { name: 'Lena Fischer', color: '#10b981' }

const arjun: Peer = { name: 'Arjun Patel', color: '#f59e0b' }

const stages = [
  { title: 'Lead', color: '#eeeeee', odds: 10 },
  { title: 'Qualified', color: '#cfdffe', odds: 30 },
  { title: 'Proposal', color: '#ede2fe', odds: 50 },
  { title: 'Negotiation', color: '#ffeab6', odds: 70 },
  { title: 'Closed won', color: '#d1f7c4', odds: 100 },
  { title: 'Closed lost', color: '#ffdce5', odds: 0 },
]

const userColors: Record<string, string> = {
  'Maya Chen': '#ffdaf6',
  'Arjun Patel': '#cfdffe',
  'Lena Fischer': '#c2f5e8',
  'Tomás Ruiz': '#ffeab6',
}

// the columns the teammate edits come first: the panel only shows the left ~600px of the window
const columns: { id: keyof Deal; title: string; icon: keyof typeof iconMap; width: number }[] = [
  { id: 'name', title: 'Deal', icon: 'cellText', width: 210 },
  { id: 'stage', title: 'Stage', icon: 'cellSingleSelect', width: 140 },
  { id: 'value', title: 'Value', icon: 'cellCurrency', width: 120 },
  { id: 'owner', title: 'Owner', icon: 'cellUser', width: 160 },
  { id: 'probability', title: 'Probability', icon: 'cellPercent', width: 110 },
  { id: 'account', title: 'Account', icon: 'cellLinks', width: 196 },
]

const deals = ref<Deal[]>(seedDeals())

const focus = ref<Focus | null>(null)

const flash = ref<Flash | null>(null)

const gridWidth = computed(() => 56 + columns.reduce((sum, col) => sum + col.width, 0) + 60)

// an object so the async loop reads the flag the unmount hook flips
const loop = { stopped: false }

function seedDeals(): Deal[] {
  return (
    [
      ['Aurora Analytics expansion', 'Aurora Analytics', 'Negotiation', 'Maya Chen', 48000, 70],
      ['Bluepeak fleet tracking', 'Bluepeak Logistics', 'Proposal', 'Arjun Patel', 126000, 50],
      ['Cedar & Pine store rollout', 'Cedar & Pine Retail', 'Qualified', 'Lena Fischer', 32000, 30],
      ['Driftwood patient intake', 'Driftwood Health', 'Closed won', 'Tomás Ruiz', 92000, 100],
      ['Evergreen quality tracking', 'Evergreen Manufacturing', 'Negotiation', 'Tomás Ruiz', 61000, 75],
      ['Fieldstone reporting suite', 'Fieldstone Capital', 'Lead', 'Arjun Patel', 18500, 10],
      ['Granite Ridge renewal', 'Granite Ridge Software', 'Closed won', 'Maya Chen', 14400, 100],
      ['Helio Labs starter plan', 'Helio Labs', 'Qualified', 'Tomás Ruiz', 9600, 40],
      ['Ironwood dispatch board', 'Ironwood Freight', 'Proposal', 'Maya Chen', 38000, 45],
      ['Juniper clinic scheduling', 'Juniper Clinics', 'Negotiation', 'Tomás Ruiz', 27500, 65],
      ['Kestrel parts inventory', 'Kestrel Robotics', 'Lead', 'Arjun Patel', 12000, 15],
      ['Lumen Retail data platform', 'Lumen Retail Group', 'Proposal', 'Lena Fischer', 184000, 40],
      ['Bluepeak warehouse pilot', 'Bluepeak Logistics', 'Closed lost', 'Lena Fischer', 22000, 0],
      ['Driftwood records migration', 'Driftwood Health', 'Qualified', 'Lena Fischer', 54000, 35],
      ['Aurora Analytics add-on', 'Aurora Analytics', 'Lead', 'Maya Chen', 8500, 20],
      ['Evergreen supplier portal', 'Evergreen Manufacturing', 'Lead', 'Tomás Ruiz', 41000, 15],
      ['Juniper reporting', 'Juniper Clinics', 'Closed won', 'Arjun Patel', 11200, 100],
      ['Lumen loyalty analytics', 'Lumen Retail Group', 'Qualified', 'Lena Fischer', 67000, 30],
    ] as const
  ).map(([name, account, stage, owner, value, probability], i) => ({
    id: i + 1,
    name,
    account,
    stage,
    owner,
    value,
    probability,
  }))
}

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

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isClosed(stage: string) {
  return stage === 'Closed won' || stage === 'Closed lost'
}

function cellFocus(row: number, field: keyof Deal) {
  return focus.value && focus.value.row === row && focus.value.field === field ? focus.value : null
}

function cellFlash(row: number, field: keyof Deal) {
  return flash.value && flash.value.row === row && flash.value.field === field ? flash.value : null
}

// values glide to their new number, as on the marketing site's live dashboards
function glide(deal: Deal, to: number) {
  const from = deal.value
  const start = performance.now()
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / 600)
    deal.value = from + (to - from) * (1 - (1 - p) ** 3)
    if (p < 1 && !loop.stopped) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

// the teammate's edits, cycled: advance a stage, update a value after a call, close a deal
function nextEdit(n: number): { deal: Deal; field: keyof Deal; apply: () => void } | null {
  const open = deals.value.slice(0, 12).filter((d) => !isClosed(d.stage))
  const pick = (offset: number) => open[(Math.floor(n / 3) + offset) % Math.max(1, open.length)]

  if (n % 3 === 0) {
    const deal = pick(0)
    const next = stages[stages.findIndex((s) => s.title === deal?.stage) + 1]
    if (!deal || !next || next.title === 'Closed won') return null
    return {
      deal,
      field: 'stage',
      apply: () => {
        deal.stage = next.title
        deal.probability = next.odds
      },
    }
  }

  if (n % 3 === 1) {
    const deal = pick(3)
    if (!deal) return null
    return { deal, field: 'value', apply: () => glide(deal, Math.round((deal.value * 1.12) / 500) * 500) }
  }

  const ready = deals.value.filter((d) => d.stage === 'Negotiation')
  const deal = ready[Math.floor(n / 3) % Math.max(1, ready.length)]
  if (!deal) return null
  return {
    deal,
    field: 'stage',
    apply: () => {
      deal.stage = 'Closed won'
      deal.probability = 100
    },
  }
}

async function run() {
  await wait(800)
  let n = 0
  while (!loop.stopped) {
    if (document.hidden) {
      await wait(500)
      continue
    }

    // the teammate closes deals as they go; start the pipeline over before it runs dry
    if (deals.value.slice(0, 12).filter((d) => !isClosed(d.stage)).length < 3) {
      deals.value = seedDeals()
      n = 0
    }

    const edit = nextEdit(n)
    n += 1
    if (!edit) {
      await wait(400)
      continue
    }

    const at = { row: edit.deal.id, field: edit.field }
    focus.value = { ...at, editing: false }
    await wait(700)
    if (loop.stopped) return
    focus.value = { ...at, editing: true }
    await wait(900)
    if (loop.stopped) return
    edit.apply()
    focus.value = { ...at, editing: false }
    flash.value = { ...at, at: Date.now() }
    await wait(900)

    if (n % 5 === 0) {
      focus.value = null
      await wait(1200)
    }
  }
}

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  run()
})

onBeforeUnmount(() => {
  loop.stopped = true
})
</script>

<template>
  <div aria-hidden="true" class="nc-auth-live h-full flex bg-nc-bg-default text-nc-content-gray select-none pointer-events-none">
    <!-- rail -->
    <div
      class="w-12 flex-none flex flex-col items-center gap-3 pt-3 border-r-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight"
    >
      <GeneralNocoIcon inline :size="26" />
      <span class="mt-1 w-8 h-8 rounded-lg flex items-center justify-center bg-nc-bg-brand text-nc-content-brand">
        <GeneralIcon icon="ncDatabase" class="w-4 h-4" />
      </span>
      <GeneralIcon icon="ncAutomation" class="w-4 h-4 text-nc-content-gray-muted" />
      <GeneralIcon icon="ncLayout" class="w-4 h-4 text-nc-content-gray-muted" />
      <GeneralIcon icon="ncSettings" class="w-4 h-4 text-nc-content-gray-muted" />
    </div>

    <!-- main -->
    <div class="flex-1 min-w-0 flex flex-col">
      <div class="h-[46px] flex-none flex items-center gap-2 px-4 border-b-1 border-nc-border-gray-medium text-bodyDefaultSm">
        <span class="w-4 h-4 rounded bg-[#36bfff]" />
        <span class="text-nc-content-gray-muted">Sales CRM</span>
        <span class="text-nc-content-gray-muted">/</span>
        <span class="text-nc-content-gray-muted">Deals</span>
        <span class="text-nc-content-gray-muted">/</span>
        <GeneralIcon icon="grid" class="w-4 h-4 text-[#36bfff]" />
        <span class="text-bodyDefaultSmBold text-nc-content-gray-emphasis">All deals</span>
        <div class="ml-6 flex items-center -space-x-1.5">
          <span
            v-for="(peer, i) of [lena, arjun]"
            :key="peer.name"
            class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white ring-2 ring-[var(--nc-bg-default)]"
            :style="{ backgroundColor: peer.color, zIndex: 2 - i }"
          >
            {{ initials(peer.name) }}
          </span>
        </div>
      </div>

      <div
        class="h-10 flex-none flex items-center gap-4 px-4 border-b-1 border-nc-border-gray-medium text-bodyDefaultSm text-nc-content-gray-subtle"
      >
        <span class="flex items-center gap-1.5"><GeneralIcon icon="fields" class="w-4 h-4" />{{ $t('objects.fields') }}</span>
        <span class="flex items-center gap-1.5"><GeneralIcon icon="filter" class="w-4 h-4" />{{ $t('activity.filter') }}</span>
        <span class="flex items-center gap-1.5"><GeneralIcon icon="group" class="w-4 h-4" />{{ $t('activity.group') }}</span>
        <span class="flex items-center gap-1.5"><GeneralIcon icon="sort" class="w-4 h-4" />{{ $t('activity.sort') }}</span>
      </div>

      <!-- grid -->
      <div class="flex-1 min-h-0 overflow-hidden">
        <div :style="{ width: `${gridWidth}px` }">
          <div class="h-8 flex border-b-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight">
            <div
              class="w-14 flex-none flex items-center pl-3 border-r-1 border-nc-border-gray-medium text-captionSmBold text-nc-content-gray-muted"
            >
              #
            </div>
            <div
              v-for="(col, c) of columns"
              :key="col.id"
              class="flex-none flex items-center gap-1.5 px-2 border-nc-border-gray-medium text-captionSmBold text-nc-content-gray-muted"
              :class="c === 0 ? 'border-r-2' : 'border-r-1'"
              :style="{ width: `${col.width}px` }"
            >
              <GeneralIcon :icon="col.icon" class="w-[13px] h-[13px] flex-none" />
              <span class="truncate">{{ col.title }}</span>
            </div>
          </div>

          <div v-for="(deal, r) of deals" :key="deal.id" class="h-8 flex">
            <div
              class="w-14 flex-none flex items-center pl-3 border-r-1 border-b-1 border-nc-border-gray-medium text-bodyDefaultSm text-nc-content-gray-muted tabular-nums"
            >
              {{ r + 1 }}
            </div>
            <div
              v-for="(col, c) of columns"
              :key="col.id"
              class="relative flex-none flex items-center px-2.5 overflow-hidden border-b-1 border-nc-border-gray-medium"
              :class="c === 0 ? 'border-r-2' : 'border-r-1'"
              :style="{ width: `${col.width}px` }"
            >
              <span v-if="col.id === 'name'" class="truncate text-bodyDefaultSmBold text-nc-content-brand">{{ deal.name }}</span>
              <span
                v-else-if="col.id === 'account'"
                class="h-[22px] max-w-full inline-flex items-center px-1.5 rounded-md border-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight text-bodyDefaultSm text-nc-content-gray truncate"
              >
                {{ deal.account }}
              </span>
              <span
                v-else-if="col.id === 'stage'"
                class="h-[22px] inline-flex items-center px-2 rounded-xl text-bodyDefaultSm leading-none transition-colors duration-300"
                :style="chip(stages.find((s) => s.title === deal.stage)?.color ?? '#eeeeee')"
              >
                {{ deal.stage }}
              </span>
              <span
                v-else-if="col.id === 'owner'"
                class="h-[22px] max-w-full inline-flex items-center gap-1 pl-[3px] pr-2 rounded-xl bg-nc-bg-gray-medium text-bodyDefaultSm text-nc-content-gray"
              >
                <span
                  class="w-4 h-4 flex-none rounded-full flex items-center justify-center text-[8px] font-semibold"
                  :style="chip(userColors[deal.owner] ?? '#eeeeee')"
                >
                  {{ initials(deal.owner) }}
                </span>
                <span class="truncate">{{ deal.owner }}</span>
              </span>
              <span v-else-if="col.id === 'value'" class="ml-auto text-bodyDefaultSm text-nc-content-gray-subtle tabular-nums">
                {{ usd(deal.value) }}
              </span>
              <span v-else class="ml-auto text-bodyDefaultSm text-nc-content-gray-subtle tabular-nums"
                >{{ deal.probability }}%</span
              >

              <!-- teammate presence: save flash, border and name tab, as the product's grid canvas draws them -->
              <span
                v-if="cellFlash(deal.id, col.id)"
                :key="cellFlash(deal.id, col.id)?.at"
                class="nc-auth-live-flash absolute inset-0 z-10"
                :style="{ backgroundColor: `${lena.color}33` }"
              />
              <span
                v-if="cellFocus(deal.id, col.id)"
                class="absolute inset-0 z-20 border-1 rounded-[2px]"
                :style="{
                  borderColor: lena.color,
                  backgroundColor: cellFocus(deal.id, col.id)?.editing ? `${lena.color}1a` : undefined,
                }"
              >
                <span
                  class="absolute right-0 bottom-0 h-4 flex items-center px-[5px] rounded-tl-md text-[11px] leading-4 font-semibold text-white whitespace-nowrap"
                  :style="{ backgroundColor: lena.color }"
                >
                  {{ cellFocus(deal.id, col.id)?.editing ? $t('labels.userIsTyping', { name: 'Lena' }) : lena.name }}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-auth-live-flash {
  animation: nc-auth-live-flash 1.4s ease-out forwards;
}

@keyframes nc-auth-live-flash {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
}
</style>
