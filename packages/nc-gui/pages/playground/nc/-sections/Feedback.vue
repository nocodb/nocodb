<script setup lang="ts">
import PgDemo from '../../-components/PgDemo.vue'
import PgSection from '../../-components/PgSection.vue'

const ALERT_TYPES = ['info', 'success', 'warning', 'error'] as const

const PLACEMENTS = ['topLeft', 'top', 'topRight', 'left', 'right', 'bottomLeft', 'bottom', 'bottomRight'] as const

const ALERT_COPY: Record<(typeof ALERT_TYPES)[number], { message: string; description: string }> = {
  info: { message: 'Scheduled maintenance', description: 'NocoDB Cloud will be read-only on Sunday from 02:00 to 02:30 UTC.' },
  success: { message: 'Webhook delivered', description: 'The payload reached https://hooks.acme.dev in 184 ms.' },
  warning: { message: 'Approaching record limit', description: 'This workspace has used 92% of its 50,000 records.' },
  error: { message: 'Formula error', description: 'Unknown field {Budgett} — did you mean {Budget}?' },
}

const isDismissibleVisible = ref(true)

function showToast(type: 'success' | 'error' | 'info' | 'warning') {
  const copy = {
    success: 'Record saved',
    error: 'Could not reach the server',
    info: 'Copied to clipboard',
    warning: 'Some rows were skipped',
  }[type]
  message[type](copy)
}

function showRichToast() {
  message.success({ title: 'Table created', content: 'Campaigns is ready — 3 views were added.' })
}

function showToastType() {
  message.toast('Undo available for 10 seconds')
}
</script>

<template>
  <PgSection
    id="feedback"
    title="Alerts, toasts & tooltips"
    source="NcAlert · message (ncMessage) · NcTooltip · NcEmptyPlaceholder"
  >
    <PgDemo label="NcAlert" hint="bordered · background · closable · copy">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <NcAlert
          v-for="t in ALERT_TYPES"
          :key="t"
          :type="t"
          :message="ALERT_COPY[t].message"
          :description="ALERT_COPY[t].description"
        />
        <NcAlert
          v-for="t in ALERT_TYPES"
          :key="`bg-${t}`"
          :type="t"
          background
          :bordered="false"
          :message="`${ALERT_COPY[t].message} (background)`"
        />
        <NcAlert
          v-if="isDismissibleVisible"
          v-model:visible="isDismissibleVisible"
          type="info"
          closable
          message="Closable alert"
          description="Dismiss me with the × button."
        />
        <!-- holds the slot so the grid doesn't reflow when the alert closes -->
        <div
          v-else
          class="min-h-20 rounded-lg border-1 border-dashed border-nc-border-gray-medium flex items-center justify-center"
        >
          <NcButton size="xsmall" type="text" class="!px-2" @click="isDismissibleVisible = true">Restore closable alert</NcButton>
        </div>
        <NcAlert type="error" message="Copyable error" description="ERR_DATABASE_OP_FAILED" copy-text="ERR_DATABASE_OP_FAILED" />
        <!-- ncMessage.toast renders type="toast" with no icon (lib/ncMessage.ts initialToastTypeValue) -->
        <NcAlert type="toast" :show-icon="false" message="Toast-style alert" description="Used inside ncMessage.toast." />
        <NcAlert type="warning" align="center" message="Centre aligned, with action">
          <template #action>
            <NcButton size="xsmall" type="secondary" class="!px-2">Upgrade</NcButton>
          </template>
        </NcAlert>
      </div>
    </PgDemo>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <PgDemo label="Toasts" hint="message.* → ncMessage">
        <div class="flex flex-wrap gap-2">
          <NcButton size="small" type="secondary" @click="showToast('success')">success</NcButton>
          <NcButton size="small" type="secondary" @click="showToast('error')">error</NcButton>
          <NcButton size="small" type="secondary" @click="showToast('info')">info</NcButton>
          <NcButton size="small" type="secondary" @click="showToast('warning')">warning</NcButton>
          <NcButton size="small" type="secondary" @click="showRichToast">title + content</NcButton>
          <NcButton size="small" type="secondary" @click="showToastType">toast</NcButton>
        </div>
      </PgDemo>

      <PgDemo label="NcTooltip" hint="placements · light · truncate-only">
        <div class="flex flex-col gap-3">
          <div class="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
            <NcTooltip v-for="p in PLACEMENTS" :key="p" :title="`placement: ${p}`" :placement="p">
              <NcButton size="small" type="secondary" class="w-full">{{ p }}</NcButton>
            </NcTooltip>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <NcTooltip title="Light tooltip" color="light">
              <NcButton size="small" type="secondary">light</NcButton>
            </NcTooltip>
            <NcTooltip title="No arrow" :arrow="false">
              <NcButton size="small" type="secondary">no arrow</NcButton>
            </NcTooltip>
            <NcTooltip title="Shown only while Alt is held" modifier-key="Alt">
              <NcButton size="small" type="secondary">hold Alt + hover</NcButton>
            </NcTooltip>
            <NcTooltip disabled title="never shown">
              <NcButton size="small" type="secondary">disabled</NcButton>
            </NcTooltip>
          </div>
          <NcTooltip show-on-truncate-only class="truncate max-w-48 text-caption">
            <template #title>Quarterly marketing performance review — North America region</template>
            Quarterly marketing performance review — North America region
          </NcTooltip>
        </div>
      </PgDemo>
    </div>

    <PgDemo label="NcEmptyPlaceholder" stage="canvas">
      <NcEmptyPlaceholder
        title="No webhooks yet"
        subtitle="Trigger an HTTP request whenever a record is created, updated or deleted."
      >
        <template #icon>
          <GeneralIcon icon="ncWebhook" class="w-10 h-10 text-nc-content-gray-muted" />
        </template>
        <template #action>
          <NcButton size="small">
            <template #icon><GeneralIcon icon="plus" /></template>
            Create webhook
          </NcButton>
        </template>
      </NcEmptyPlaceholder>
    </PgDemo>
  </PgSection>
</template>
