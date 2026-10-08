<script setup lang="ts">
import { PlanTitles } from 'nocodb-sdk'
import PgSection from '../../-components/PgSection.vue'
import PgDemo from '../../-components/PgDemo.vue'

const shareUrl = ref('https://app.nocodb.com/#/nc/form/7f3c2a1e-9b8d-4c6e-a2f1-0d5b8e7c4a19')

const shortcuts = [['Meta', 'K'], ['Ctrl', 'Shift', 'F'], ['Alt', 'Enter'], ['ArrowUp'], ['Esc']]

const plans = [PlanTitles.PLUS, PlanTitles.BUSINESS, PlanTitles.ENTERPRISE]

const badgeSizes = ['xs', 'sm', 'md', 'lg'] as const
</script>

<template>
  <PgSection id="copy" title="Copy helpers" source="GeneralCopyButton · GeneralCopyInput · GeneralCopyUrl">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <PgDemo label="CopyButton" hint="icon-only; extends NcButton props">
        <div class="flex items-center gap-2">
          <GeneralCopyButton content="sk_live_51Hx…" />
          <GeneralCopyButton content="sk_live_51Hx…" type="secondary" size="small" />
          <GeneralCopyButton content="sk_live_51Hx…" size="xs" class="!px-1" />
        </div>
      </PgDemo>
      <PgDemo label="CopyInput">
        <div class="flex flex-col gap-2">
          <GeneralCopyInput model-value="nc_pat_8Y2k9QmZr4LxVb" />
          <GeneralCopyInput model-value="nc_pat_8Y2k9QmZr4LxVb" password />
        </div>
      </PgDemo>
      <PgDemo label="CopyUrl" class="md:col-span-2">
        <GeneralCopyUrl v-model:url="shareUrl" />
      </PgDemo>
    </div>
  </PgSection>

  <PgSection id="text" title="Text & hints" source="GeneralTruncateText · GeneralTooltip · GeneralShortcutLabel">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <PgDemo label="TruncateText" hint="length=20, tooltip on overflow">
        <div class="flex flex-col gap-1 text-caption">
          <GeneralTruncateText>Short title</GeneralTruncateText>
          <GeneralTruncateText>Quarterly revenue forecast by region and product line</GeneralTruncateText>
          <GeneralTruncateText :length="10" placement="right">Ten chars max here</GeneralTruncateText>
        </div>
      </PgDemo>
      <PgDemo :label="$t('labels.themeConfig.tooltip')" hint="hover, or hold Shift while hovering">
        <div class="flex items-center gap-3">
          <GeneralTooltip>
            <template #title>Plain hover tooltip</template>
            <NcButton size="small" type="secondary">Hover me</NcButton>
          </GeneralTooltip>
          <GeneralTooltip modifier-key="Shift">
            <template #title>Shown only with Shift</template>
            <NcButton size="small" type="secondary">Shift + hover</NcButton>
          </GeneralTooltip>
        </div>
      </PgDemo>
      <PgDemo label="ShortcutLabel" hint="mac glyphs on macOS">
        <div class="flex flex-col gap-2">
          <GeneralShortcutLabel v-for="keys in shortcuts" :key="keys.join('+')" :keys="keys" />
        </div>
      </PgDemo>
    </div>
    <PgDemo label="SourceRestrictionTooltip" hint="hover the disabled button">
      <div class="flex items-center gap-3">
        <GeneralSourceRestrictionTooltip enabled :message="$t('tooltip.dataSourceReadOnly')">
          <NcButton size="small" type="secondary" disabled>Add field</NcButton>
        </GeneralSourceRestrictionTooltip>
        <GeneralSourceRestrictionTooltip enabled is-sql-view>
          <NcButton size="small" type="secondary" disabled>{{ $t('labels.editSqlView') }}</NcButton>
        </GeneralSourceRestrictionTooltip>
      </div>
    </PgDemo>
  </PgSection>

  <PgSection id="language" title="Language picker" source="GeneralLanguage · GeneralLanguageMenu">
    <PgDemo label="Button variant" hint="changes the app language">
      <GeneralLanguage button />
    </PgDemo>
  </PgSection>

  <PgSection
    v-if="isEeUI"
    id="upgrade-badge"
    title="Upgrade badges"
    source="PaymentUpgradeBadge"
    description="Forced to the locked state via featureEnabledCallback. They still hide when the current runtime has neither payment nor on-prem enabled."
  >
    <PgDemo>
      <div class="flex flex-col gap-3">
        <div v-for="size in badgeSizes" :key="size" class="flex items-center gap-3">
          <span class="w-10 text-captionSm text-nc-content-gray-muted">{{ size }}</span>
          <PaymentUpgradeBadge
            v-for="plan in plans"
            :key="plan"
            :plan-title="plan"
            :size="size"
            :feature-enabled-callback="() => false"
            remove-click
          />
          <PaymentUpgradeBadge :plan-title="PlanTitles.BUSINESS" :feature-enabled-callback="() => false" icon-only remove-click />
        </div>
      </div>
    </PgDemo>
  </PgSection>

  <PgSection v-if="isEeUI" id="misc-buttons" title="Misc buttons" source="GeneralCreateLinkedFieldButton">
    <PgDemo label="CreateLinkedFieldButton" hint="default · loading · disabled">
      <div class="flex flex-wrap items-start gap-6">
        <div v-for="state in ['default', 'loading', 'disabled'] as const" :key="state" class="flex flex-col items-start gap-1.5">
          <GeneralCreateLinkedFieldButton :loading="state === 'loading'" :disabled="state === 'disabled'" />
          <span class="text-captionXs font-mono text-nc-content-gray-muted">{{ state }}</span>
        </div>
      </div>
    </PgDemo>
  </PgSection>
</template>
