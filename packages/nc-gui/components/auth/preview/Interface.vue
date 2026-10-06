<script setup lang="ts">
// Decorative, aria-hidden copy of the marketing site's published interface (landing-page components/nc/interface.tsx):
// a teammate works the deal desk's review queue. Demo data is sample content, not UI copy.

interface Deal {
  id: number
  name: string
  account: string
  stage: string
  value: number
}

interface Focus {
  id: number
  editing: boolean
}

interface Flash {
  id: number
  at: number
}

const { isDark } = useTheme()

const { t } = useI18n()

// presence palette from ee/composables/usePresence.ts
const arjun = { name: 'Arjun Patel', color: '#f59e0b' }

// interfaceThemeUtils.ts "sapphire" accent
const accent = { from: '#193D8F', to: '#153275' }

const stages = [
  { title: 'Lead', color: '#eeeeee' },
  { title: 'Qualified', color: '#cfdffe' },
  { title: 'Proposal', color: '#ede2fe' },
  { title: 'Negotiation', color: '#ffeab6' },
  { title: 'Closed won', color: '#d1f7c4' },
]

const interfaces = [
  { title: 'Deal desk', pages: ['All deals', 'Review queue', 'Overview', 'New lead'] },
  { title: 'Accounts directory', pages: [] },
]

// recycled forever: approved deals leave the top half, the next one from here joins at the bottom
const incoming: Omit<Deal, 'id'>[] = [
  { name: 'Aurora Analytics expansion', account: 'Aurora Analytics', stage: 'Negotiation', value: 48000 },
  { name: 'Bluepeak fleet tracking', account: 'Bluepeak Logistics', stage: 'Proposal', value: 126000 },
  { name: 'Evergreen quality tracking', account: 'Evergreen Manufacturing', stage: 'Negotiation', value: 61000 },
  { name: 'Cedar & Pine store rollout', account: 'Cedar & Pine Retail', stage: 'Qualified', value: 32000 },
  { name: 'Ironwood dispatch board', account: 'Ironwood Freight', stage: 'Proposal', value: 38000 },
  { name: 'Juniper clinic scheduling', account: 'Juniper Clinics', stage: 'Negotiation', value: 27500 },
  { name: 'Lumen Retail data platform', account: 'Lumen Retail Group', stage: 'Proposal', value: 184000 },
  { name: 'Driftwood records migration', account: 'Driftwood Health', stage: 'Qualified', value: 54000 },
  { name: 'Fieldstone reporting suite', account: 'Fieldstone Capital', stage: 'Lead', value: 18500 },
  { name: 'Helio Labs starter plan', account: 'Helio Labs', stage: 'Qualified', value: 9600 },
  { name: 'Kestrel parts inventory', account: 'Kestrel Robotics', stage: 'Lead', value: 12000 },
  { name: 'Lumen loyalty analytics', account: 'Lumen Retail Group', stage: 'Qualified', value: 67000 },
]

let nextId = 0

const queue = ref<Deal[]>(Array.from({ length: 7 }, () => takeIncoming()))

const selected = ref<number>(queue.value[0]!.id)

const focus = ref<Focus | null>(null)

const flash = ref<Flash | null>(null)

const shownTotal = ref(0)

// an object so the async loop reads the flag the unmount hook flips
const loop = { stopped: false }

const total = computed(() => queue.value.reduce((sum, deal) => sum + deal.value, 0))

const current = computed(() => queue.value.find((deal) => deal.id === selected.value) ?? queue.value[0])

const currentIndex = computed(() => queue.value.findIndex((deal) => deal.id === current.value?.id))

function takeIncoming(): Deal {
  const deal = incoming[nextId % incoming.length]!
  nextId += 1
  return { ...deal, id: nextId }
}

function stageColor(stage: string) {
  return stages.find((s) => s.title === stage)?.color ?? '#eeeeee'
}

function nextStage(stage: string) {
  return stages[stages.findIndex((s) => s.title === stage) + 1]?.title ?? 'Closed won'
}

function chip(color: string) {
  const { bg, ink } = getSelectChipColors(color, isDark.value)
  return { backgroundColor: bg, color: ink }
}

function usd(value: number) {
  return `$${Math.round(value).toLocaleString('en-US')}`
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// the queue total glides to its new number, as on the marketing site's live dashboards
function glideTotal(to: number) {
  const from = shownTotal.value
  const start = performance.now()
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / 600)
    shownTotal.value = from + (to - from) * (1 - (1 - p) ** 3)
    if (p < 1 && !loop.stopped) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

// mostly closes a deal that's ready; otherwise moves one of the top rows a stage on
function pick(n: number) {
  const top = queue.value.slice(0, 5)
  const ready = top.find((deal) => deal.stage === 'Negotiation')
  if (ready && n % 3 !== 2) return ready
  return top[n % top.length]!
}

async function run() {
  await wait(800)
  let n = 0
  while (!loop.stopped) {
    if (document.hidden) {
      await wait(500)
      continue
    }

    const deal = pick(n)
    n += 1
    selected.value = deal.id
    focus.value = { id: deal.id, editing: false }
    await wait(800)
    if (loop.stopped) return
    focus.value = { id: deal.id, editing: true }
    await wait(1000)
    if (loop.stopped) return

    deal.stage = nextStage(deal.stage)
    focus.value = null
    flash.value = { id: deal.id, at: Date.now() }
    await wait(1000)
    if (loop.stopped) return

    if (deal.stage === 'Closed won') {
      queue.value = queue.value.filter((d) => d.id !== deal.id)
      selected.value = queue.value[0]!.id
      await wait(700)
      queue.value = [...queue.value, takeIncoming()]
    }
    await wait(1200)
  }
}

watch(total, (to) => glideTotal(to))

onMounted(() => {
  shownTotal.value = total.value
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  run()
})

onBeforeUnmount(() => {
  loop.stopped = true
})
</script>

<template>
  <div aria-hidden="true" class="nc-auth-iface h-full flex bg-nc-bg-default text-nc-content-gray select-none pointer-events-none">
    <!-- painted app sidebar (AppSidebar.vue, "bold" chrome) -->
    <div
      class="w-[220px] flex-none flex flex-col text-white"
      :style="{ background: `linear-gradient(180deg, ${accent.from}, ${accent.to})` }"
    >
      <div class="flex items-center gap-3 px-4 pt-4 pb-3">
        <span class="w-8 h-8 flex-none flex items-center justify-center rounded-lg border-1 border-white/30 bg-white/15">
          <span class="w-5 h-5 flex items-center justify-center rounded-[5px]" :class="isDark ? 'bg-[#16161a]' : 'bg-white'">
            <GeneralNocoIcon inline :size="16" />
          </span>
        </span>
        <span class="truncate text-bodyBold">Sales CRM</span>
        <GeneralIcon icon="ncChevronDown" class="w-4 h-4 flex-none text-white/80" />
      </div>

      <div class="flex-1 min-h-0 flex flex-col gap-1 px-5">
        <div v-for="(iface, i) of interfaces" :key="iface.title">
          <div
            class="h-7 flex items-center gap-3 px-1"
            :class="i === 0 ? 'text-bodyDefaultSmBold text-white' : 'text-bodyDefaultSm text-white/80'"
          >
            <GeneralIcon icon="ncLayout" class="w-4 h-4 flex-none" />
            <span class="truncate">{{ iface.title }}</span>
          </div>
          <div v-if="iface.pages.length" class="my-1 ml-3 flex flex-col gap-0.5 border-l-1 border-white/25 pl-[9px]">
            <div
              v-for="page of iface.pages"
              :key="page"
              class="relative h-7 flex items-center px-2.5 rounded-md"
              :class="
                page === 'Review queue' ? 'bg-black/25 text-bodyDefaultSmBold text-white' : 'text-bodyDefaultSm text-white/80'
              "
            >
              <span
                v-if="page === 'Review queue'"
                class="absolute top-1 bottom-1 -left-[11px] w-[3px] rounded-[2px] bg-white/90"
              />
              <span class="truncate">{{ page }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="p-2">
        <span class="w-8 h-8 flex items-center justify-center text-white/80">
          <GeneralIcon icon="ncChevronsLeft" class="w-4 h-4" />
        </span>
      </div>
      <div class="flex items-center gap-2 px-3.5 py-2 border-t-1 border-white/15">
        <span
          class="w-7 h-7 flex-none flex items-center justify-center rounded-full text-[11px] font-semibold"
          :style="chip('#ffdaf6')"
        >
          MC
        </span>
        <span class="min-w-0 flex-1 leading-tight">
          <span class="block truncate text-captionSmBold text-white">Maya Chen</span>
          <span class="block truncate text-captionSm text-white/80">maya@northwind.io</span>
        </span>
        <GeneralIcon icon="ncBell" class="w-4 h-4 text-white/80" />
      </div>
    </div>

    <!-- page -->
    <div class="flex-1 min-w-0 flex flex-col">
      <div class="h-11 flex-none flex items-center gap-2 px-4 text-bodyDefaultSm">
        <span class="text-nc-content-gray-subtle">Deal desk</span>
        <GeneralIcon icon="ncChevronRight" class="w-3.5 h-3.5 text-nc-content-gray-muted" />
        <span class="text-bodyDefaultSmBold text-nc-content-gray-emphasis">Review queue</span>
      </div>

      <div class="flex-1 min-h-0 flex border-t-1 border-nc-border-gray-medium">
        <!-- open records -->
        <div class="w-[310px] flex-none flex flex-col border-r-1 border-nc-border-gray-medium">
          <div class="flex items-center justify-between px-4 pt-4 pb-2">
            <span class="text-bodyBold text-nc-content-gray-emphasis">Review queue</span>
            <span class="text-bodySm text-nc-content-gray-muted tabular-nums">
              {{ queue.length }} open · {{ usd(shownTotal) }}
            </span>
          </div>
          <div class="px-4 pb-3 border-b-1 border-nc-border-gray-light">
            <div
              class="h-8 flex items-center gap-2 px-2.5 rounded-lg border-1 border-nc-border-gray-medium text-bodyDefaultSm text-nc-content-gray-muted"
            >
              <GeneralIcon icon="ncSearch" class="w-4 h-4 flex-none" />
              {{ t('general.search') }}
            </div>
          </div>

          <div class="relative flex-1 min-h-0 overflow-hidden">
            <TransitionGroup name="nc-auth-iface-row">
              <div
                v-for="deal of queue"
                :key="deal.id"
                class="relative w-full flex flex-col gap-0.5 py-3 pl-5 pr-4 border-b-1 border-nc-border-gray-light"
                :class="deal.id === current?.id ? 'bg-nc-bg-gray-medium' : 'bg-nc-bg-default'"
              >
                <span
                  class="absolute top-1.5 bottom-1.5 left-1.5 w-1 rounded-full transition-colors duration-300"
                  :style="{ backgroundColor: chip(stageColor(deal.stage)).backgroundColor }"
                />
                <span class="truncate text-bodyDefaultSm text-nc-content-gray-emphasis">{{ deal.name }}</span>
                <span class="truncate text-bodySm text-nc-content-gray-subtle2">{{ deal.account }}</span>
                <span class="flex items-center justify-between gap-2">
                  <span
                    class="h-5 inline-flex items-center px-2 rounded-xl text-bodySm leading-none transition-colors duration-300"
                    :style="chip(stageColor(deal.stage))"
                  >
                    {{ deal.stage }}
                  </span>
                  <span class="text-bodySm text-nc-content-gray-subtle2 tabular-nums">{{ usd(deal.value) }}</span>
                </span>

                <!-- teammate presence: save flash, border and name tab, as in the grid scene -->
                <span
                  v-if="flash?.id === deal.id"
                  :key="flash?.at"
                  class="nc-auth-iface-flash absolute inset-0 z-10"
                  :style="{ backgroundColor: `${arjun.color}33` }"
                />
                <span
                  v-if="focus?.id === deal.id"
                  class="absolute inset-0 z-20 border-1 rounded-[2px]"
                  :style="{ borderColor: arjun.color, backgroundColor: focus?.editing ? `${arjun.color}1a` : undefined }"
                >
                  <span
                    class="absolute right-0 bottom-0 h-4 flex items-center px-[5px] rounded-tl-md text-[11px] leading-4 font-semibold text-white whitespace-nowrap"
                    :style="{ backgroundColor: arjun.color }"
                  >
                    {{ focus?.editing ? t('labels.userIsTyping', { name: 'Arjun' }) : arjun.name }}
                  </span>
                </span>
              </div>
            </TransitionGroup>
          </div>
        </div>

        <!-- the record in hand; mostly bleeds off the panel -->
        <div v-if="current" class="flex-1 min-w-0 px-8 pt-4">
          <div class="flex items-center gap-1 text-nc-content-gray-subtle">
            <GeneralIcon icon="ncChevronUp" class="w-4 h-4" />
            <GeneralIcon icon="ncChevronDown" class="w-4 h-4" />
            <span class="ml-1 text-bodySm text-nc-content-gray-muted tabular-nums">
              {{ currentIndex + 1 }} of {{ queue.length }}
            </span>
          </div>
          <div class="mt-3 flex items-start justify-between gap-3 pb-4 border-b-1 border-nc-border-gray-medium">
            <span class="whitespace-nowrap text-heading3 text-nc-content-gray-emphasis">{{ current.name }}</span>
            <div class="flex-none flex items-center gap-2">
              <span
                class="h-7 flex items-center px-3 rounded-lg text-bodyDefaultSm text-white"
                :style="{ backgroundColor: accent.from }"
              >
                {{ nextStage(current.stage) === 'Closed won' ? 'Mark as Closed won' : `Move to ${nextStage(current.stage)}` }}
              </span>
              <span
                class="h-7 flex items-center px-3 rounded-lg border-1 border-nc-border-gray-medium text-bodyDefaultSm text-nc-content-gray"
              >
                Mark as Closed lost
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-auth-iface-flash {
  animation: nc-auth-iface-flash 1.4s ease-out forwards;
}

@keyframes nc-auth-iface-flash {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
}

.nc-auth-iface-row-move,
.nc-auth-iface-row-enter-active,
.nc-auth-iface-row-leave-active {
  transition: transform 0.45s ease, opacity 0.45s ease;
}

.nc-auth-iface-row-enter-from {
  opacity: 0;
  transform: translateY(16px);
}

.nc-auth-iface-row-leave-to {
  opacity: 0;
  transform: translateX(48px);
}

// lets the rows below slide up while the approved one leaves
.nc-auth-iface-row-leave-active {
  position: absolute;
}
</style>
