<script setup lang="ts">
// Decorative, aria-hidden copy of the marketing site's live "Sales overview" dashboard (landing-page nc/dashboard.tsx):
// a teammate edits deals and every widget glides to its new value. Demo data is sample content, not UI copy.

interface Deal {
  id: number
  name: string
  stage: string
  owner: string
  value: number
}

interface Delta {
  text: string
  up: boolean
  at: number
}

type MetricKey = 'open' | 'won' | 'rate' | 'count'

const { isDark } = useTheme()

// presence palette from ee/composables/usePresence.ts
const peers = [
  { name: 'Lena Fischer', color: '#10b981' },
  { name: 'Arjun Patel', color: '#f59e0b' },
]

// CHART_PALETTES.default in lib/constants.ts
const palette = ['#2A78D6', '#1BAF7A', '#EDA100', '#008300', '#4A3AA7', '#E34948']

const stages = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed won', 'Closed lost']

const owners = ['Maya Chen', 'Arjun Patel', 'Lena Fischer', 'Tomás Ruiz']

// metric tile themes from the dashboard widget colour config
const themes = {
  purple: { light: ['#f3ecfa', '#4b177b'], dark: ['#2a2038', '#d6bdf5'] },
  green: { light: ['#ecfff2', '#17803d'], dark: ['#16301f', '#8ee0aa'] },
  blue: { light: ['#edf9ff', '#207399'], dark: ['#152c38', '#93d4f2'] },
  orange: { light: ['#fff5ef', '#c86827'], dark: ['#38261a', '#f4b78c'] },
}

const metrics: { key: MetricKey; title: string; theme: keyof typeof themes }[] = [
  { key: 'open', title: 'Open pipeline', theme: 'purple' },
  { key: 'won', title: 'Won', theme: 'green' },
  { key: 'rate', title: 'Win rate', theme: 'blue' },
  { key: 'count', title: 'Deals', theme: 'orange' },
]

// chart plot box: a 2-column widget of the 888px grid, minus its padding and header
const chartW = 407

const chartH = 250

const deals = ref<Deal[]>(seedDeals())

const shown = ref<Record<string, number>>({})

const deltas = ref<Partial<Record<MetricKey, Delta>>>({})

// an object so the async loop reads the flag the unmount hook flips
const loop = { stopped: false, raf: 0 }

const stats = computed(() => {
  const rows = deals.value
  const won = rows.filter((d) => d.stage === 'Closed won')
  const lost = rows.filter((d) => d.stage === 'Closed lost')
  const open = rows.filter((d) => !isClosed(d.stage))
  const values: Record<string, number> = {
    open: sum(open),
    won: sum(won),
    rate: won.length + lost.length ? (won.length / (won.length + lost.length)) * 100 : 0,
    count: rows.length,
  }
  for (const stage of stages) values[`bar:${stage}`] = sum(rows.filter((d) => d.stage === stage))
  for (const owner of owners) values[`donut:${owner}`] = rows.filter((d) => d.owner === owner).length
  const subs: Record<MetricKey, string> = {
    open: `${open.length} open deals`,
    won: `${won.length} deals`,
    rate: `${won.length} won, ${lost.length} lost`,
    count: 'in Deals',
  }
  return { values, subs }
})

const barMax = computed(() => {
  // round up to 1, 2, 2.5 or 5 times a power of ten so the ticks are round numbers
  const top = Math.max(1, ...stages.map((s) => stats.value.values[`bar:${s}`] ?? 0))
  const step = 10 ** Math.floor(Math.log10(top))
  return ([1, 2, 2.5, 5, 10].find((m) => m * step >= top) ?? 10) * step
})

const barTicks = computed(() => [0, 0.25, 0.5, 0.75, 1].map((p) => p * barMax.value))

const barLeft = computed(() => Math.max(40, Math.max(...barTicks.value.map((v) => money(v).length)) * 6.6 + 10))

const donut = computed(() => {
  const r = 112
  const inner = r * 0.62
  const total = owners.reduce((acc, o) => acc + val(`donut:${o}`), 0) || 1
  const at = (a: number, rr: number) => `${r + rr * Math.cos(a)} ${r + rr * Math.sin(a)}`
  let angle = -Math.PI / 2
  const arcs = owners.map((owner, i) => {
    const sweep = (val(`donut:${owner}`) / total) * Math.PI * 2
    const [a0, a1] = [angle, angle + sweep]
    angle = a1
    const large = sweep > Math.PI ? 1 : 0
    return {
      owner,
      color: palette[i % palette.length],
      share: Math.round((val(`donut:${owner}`) / total) * 100),
      d: `M${at(a0, r)} A${r} ${r} 0 ${large} 1 ${at(a1, r)} L${at(a1, inner)} A${inner} ${inner} 0 ${large} 0 ${at(
        a0,
        inner,
      )} Z`,
    }
  })
  return { r, total, arcs }
})

function seedDeals(): Deal[] {
  return (
    [
      ['Aurora Analytics expansion', 'Negotiation', 'Maya Chen', 48000],
      ['Bluepeak fleet tracking', 'Proposal', 'Arjun Patel', 126000],
      ['Cedar & Pine store rollout', 'Qualified', 'Lena Fischer', 32000],
      ['Driftwood patient intake', 'Closed won', 'Tomás Ruiz', 92000],
      ['Evergreen quality tracking', 'Negotiation', 'Tomás Ruiz', 61000],
      ['Fieldstone reporting suite', 'Lead', 'Arjun Patel', 18500],
      ['Granite Ridge renewal', 'Closed won', 'Maya Chen', 14400],
      ['Helio Labs starter plan', 'Qualified', 'Tomás Ruiz', 9600],
      ['Ironwood dispatch board', 'Proposal', 'Maya Chen', 38000],
      ['Juniper clinic scheduling', 'Negotiation', 'Tomás Ruiz', 27500],
      ['Kestrel parts inventory', 'Lead', 'Arjun Patel', 12000],
      ['Lumen Retail data platform', 'Proposal', 'Lena Fischer', 184000],
      ['Bluepeak warehouse pilot', 'Closed lost', 'Lena Fischer', 22000],
      ['Driftwood records migration', 'Qualified', 'Lena Fischer', 54000],
    ] as const
  ).map(([name, stage, owner, value], i) => ({ id: i + 1, name, stage, owner, value }))
}

function isClosed(stage: string) {
  return stage === 'Closed won' || stage === 'Closed lost'
}

function sum(list: Deal[]) {
  return list.reduce((acc, d) => acc + d.value, 0)
}

function val(key: string) {
  return shown.value[key] ?? stats.value.values[key] ?? 0
}

function money(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 2 })}M`
  if (value >= 1000) return `$${(value / 1000).toLocaleString('en-US', { maximumFractionDigits: value >= 10000 ? 0 : 1 })}k`
  return `$${Math.round(value)}`
}

function format(key: MetricKey, value: number) {
  if (key === 'open' || key === 'won') return money(value)
  return key === 'rate' ? `${Math.round(value)}%` : String(Math.round(value))
}

function tile(theme: keyof typeof themes) {
  const [bg, ink] = themes[theme][isDark.value ? 'dark' : 'light']
  return { backgroundColor: bg, color: ink }
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
}

// rounded top, square base, as the product's bar chart draws it
function bar(i: number) {
  const plotH = chartH - 28
  const slot = (chartW - barLeft.value) / stages.length
  const w = Math.min(32, slot * 0.6)
  const h = (val(`bar:${stages[i]}`) / barMax.value) * plotH
  const x = barLeft.value + slot * i + (slot - w) / 2
  const y = 6 + plotH - h
  const r = Math.min(4, h)
  return {
    cx: x + w / 2,
    d: `M${x} ${6 + plotH} V${y + r} Q${x} ${y} ${x + 4} ${y} H${x + w - 4} Q${x + w} ${y} ${x + w} ${y + r} V${6 + plotH} Z`,
  }
}

function tickY(value: number) {
  return 6 + (chartH - 28) * (1 - value / barMax.value)
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// values glide to their new size instead of jumping
function glide(from: Record<string, number>, to: Record<string, number>) {
  cancelAnimationFrame(loop.raf)
  const start = performance.now()
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / 600)
    const e = 1 - (1 - p) ** 3
    const next: Record<string, number> = {}
    for (const [key, end] of Object.entries(to)) {
      const begin = from[key] ?? end
      next[key] = begin + (end - begin) * e
    }
    shown.value = next
    if (p < 1 && !loop.stopped) loop.raf = requestAnimationFrame(step)
  }
  loop.raf = requestAnimationFrame(step)
}

// the teammate's edits, cycled: advance a stage, update a value after a call, close a deal
function edit(n: number) {
  const open = deals.value.filter((d) => !isClosed(d.stage))
  const deal = open[(n * 5) % open.length]
  if (!deal) return
  if (n % 4 === 1) {
    deal.value = Math.round((deal.value * 1.15) / 500) * 500
  } else if (n % 4 === 3 || deal.stage === 'Negotiation') {
    const closing = open.find((d) => d.stage === 'Negotiation') ?? deal
    closing.stage = n % 8 === 7 ? 'Closed lost' : 'Closed won'
  } else {
    deal.stage = stages[stages.indexOf(deal.stage) + 1] ?? deal.stage
  }
}

async function run() {
  await wait(1200)
  let n = 0
  while (!loop.stopped) {
    if (document.hidden) {
      await wait(500)
      continue
    }
    // closing deals drains the pipeline; start over before it runs dry
    if (deals.value.filter((d) => !isClosed(d.stage)).length < 4) {
      deals.value = seedDeals()
      n = 0
    }
    edit(n)
    n += 1
    await wait(n % 5 === 0 ? 3200 : 2000)
  }
}

watch(
  () => stats.value.values,
  (to, from) => {
    for (const { key } of metrics) {
      const d = (to[key] ?? 0) - (from[key] ?? 0)
      if (!d) continue
      const at = Date.now()
      deltas.value = { ...deltas.value, [key]: { text: `${d > 0 ? '+' : '−'}${format(key, Math.abs(d))}`, up: d > 0, at } }
      setTimeout(() => {
        if (deltas.value[key]?.at === at) deltas.value = { ...deltas.value, [key]: undefined }
      }, 1600)
    }
    glide({ ...from, ...shown.value }, to)
  },
)

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  run()
})

onBeforeUnmount(() => {
  loop.stopped = true
  cancelAnimationFrame(loop.raf)
})
</script>

<template>
  <div aria-hidden="true" class="h-full flex bg-nc-bg-default text-nc-content-gray select-none pointer-events-none">
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
        <GeneralIcon icon="dashboards" class="w-4 h-4 text-nc-content-gray-subtle" />
        <span class="text-bodyDefaultSmBold text-nc-content-gray-emphasis">Sales overview</span>
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
        <span
          class="ml-3 h-7 flex items-center gap-1.5 px-2 rounded-lg border-1 border-nc-border-gray-medium text-bodyDefaultSmBold text-nc-content-gray-subtle"
        >
          <GeneralIcon icon="ncEdit3" class="w-4 h-4" />{{ $t('labels.editDashboard') }}
        </span>
      </div>

      <div class="flex-1 min-h-0 overflow-hidden bg-nc-bg-gray-light p-4">
        <div class="w-[920px] rounded-lg bg-nc-bg-default p-4 shadow-[0_0_4px_rgba(0,0,0,0.12)]">
          <div class="w-[888px] grid grid-cols-4 gap-2.5" :style="{ gridAutoRows: '80px' }">
            <!-- metric tiles -->
            <div
              v-for="metric of metrics"
              :key="metric.key"
              class="relative row-span-2 flex flex-col justify-center gap-1 p-4 rounded-xl border-1 border-nc-border-gray-medium overflow-hidden"
              :style="tile(metric.theme)"
            >
              <span
                v-if="deltas[metric.key]"
                :key="`glow-${deltas[metric.key]?.at}`"
                class="nc-auth-live-flash absolute inset-0 rounded-[11px]"
                :style="{ boxShadow: 'inset 0 0 0 2px currentColor' }"
              />
              <span class="truncate text-bodyBold">{{ metric.title }}</span>
              <span class="truncate text-[28px] leading-[1.2] font-bold tabular-nums">
                {{ format(metric.key, val(metric.key)) }}
              </span>
              <span class="flex min-w-0 items-center gap-1.5 text-bodySm">
                <span class="truncate opacity-80">{{ stats.subs[metric.key] }}</span>
                <span
                  v-if="deltas[metric.key]"
                  :key="`chip-${deltas[metric.key]?.at}`"
                  class="nc-auth-dash-fade flex-none px-1.5 rounded-md text-bodySmBold tabular-nums"
                  :style="{ backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.75)' }"
                >
                  {{ deltas[metric.key]?.up ? '↑' : '↓' }} {{ deltas[metric.key]?.text }}
                </span>
              </span>
            </div>

            <!-- bar chart -->
            <div class="col-span-2 row-span-4 flex flex-col rounded-xl border-1 border-nc-border-gray-medium overflow-hidden">
              <div class="px-4 pt-4 pb-3">
                <div class="truncate text-subHeading2 text-nc-content-gray-emphasis">Pipeline by stage</div>
                <div class="truncate text-bodyDefaultSm text-nc-content-gray-subtle2">Sum of Value for each stage</div>
              </div>
              <svg class="mx-4" :width="chartW" :height="chartH">
                <g v-for="tick of barTicks" :key="tick">
                  <line
                    :x1="barLeft"
                    :x2="chartW"
                    :y1="tickY(tick)"
                    :y2="tickY(tick)"
                    style="stroke: var(--nc-border-gray-light)"
                  />
                  <text
                    :x="barLeft - 6"
                    :y="tickY(tick) + 3"
                    text-anchor="end"
                    font-size="11"
                    style="fill: var(--nc-content-gray-muted)"
                  >
                    {{ money(tick) }}
                  </text>
                </g>
                <g v-for="(stage, i) of stages" :key="stage">
                  <path :d="bar(i).d" :fill="palette[0]" />
                  <text
                    :x="bar(i).cx"
                    :y="chartH - 6"
                    text-anchor="middle"
                    font-size="11"
                    style="fill: var(--nc-content-gray-muted)"
                  >
                    {{
                      stage.startsWith('Closed ')
                        ? `${stage.charAt(7).toUpperCase()}${stage.slice(8)}`
                        : stage.length > 9
                        ? `${stage.slice(0, 8)}…`
                        : stage
                    }}
                  </text>
                </g>
              </svg>
            </div>

            <!-- donut -->
            <div class="col-span-2 row-span-4 flex flex-col rounded-xl border-1 border-nc-border-gray-medium overflow-hidden">
              <div class="px-4 pt-4 pb-3">
                <div class="truncate text-subHeading2 text-nc-content-gray-emphasis">Deals by owner</div>
                <div class="truncate text-bodyDefaultSm text-nc-content-gray-subtle2">Count of deals per owner</div>
              </div>
              <div class="mx-4 flex items-center gap-4">
                <svg :width="donut.r * 2" :height="donut.r * 2" class="flex-none">
                  <path
                    v-for="arc of donut.arcs"
                    :key="arc.owner"
                    :d="arc.d"
                    :fill="arc.color"
                    stroke-width="2"
                    style="stroke: var(--nc-bg-default)"
                  />
                  <text
                    :x="donut.r"
                    :y="donut.r - 2"
                    text-anchor="middle"
                    font-size="20"
                    font-weight="700"
                    style="fill: var(--nc-content-gray-emphasis)"
                  >
                    {{ Math.round(donut.total) }}
                  </text>
                  <text
                    :x="donut.r"
                    :y="donut.r + 16"
                    text-anchor="middle"
                    font-size="11"
                    style="fill: var(--nc-content-gray-muted)"
                  >
                    deals
                  </text>
                </svg>
                <div class="flex min-w-0 flex-col gap-1.5 text-bodySm">
                  <div v-for="arc of donut.arcs" :key="arc.owner" class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 flex-none rounded-sm" :style="{ backgroundColor: arc.color }" />
                    <span class="truncate text-nc-content-gray">{{ arc.owner }}</span>
                    <span class="ml-auto pl-2 text-nc-content-gray-muted tabular-nums">{{ arc.share }}%</span>
                  </div>
                </div>
              </div>
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

.nc-auth-dash-fade {
  animation: nc-auth-dash-fade 150ms ease-out both;
}

@keyframes nc-auth-live-flash {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
}

@keyframes nc-auth-dash-fade {
  from {
    opacity: 0;
  }
}
</style>
