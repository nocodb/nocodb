<script setup lang="ts">
import { ClientType } from 'nocodb-sdk'
import PgSection from '../../-components/PgSection.vue'
import PgDemo from '../../-components/PgDemo.vue'
import type { IconMapKey } from '#imports'

const { integrationsIconMap } = useIntegrationStore()

const sampleIcons: IconMapKey[] = [
  'ncPlus',
  'ncEdit',
  'ncTrash',
  'ncSearch',
  'ncFilter',
  'ncSettings',
  'ncUsers',
  'ncLock',
  'ncLink',
  'ncCopy',
  'ncDownload',
  'ncUpload',
  'ncCalendar',
  'ncMail',
  'ncBell',
  'ncStar',
  'ncHeart',
  'ncZap',
  'ncAutomation',
  'ncUser',
  'ncArrowRight',
  'ncChevronDown',
  'ncMoreVertical',
  'ncInfo',
]

const colouredIcons: Array<{ icon: IconMapKey; cls: string }> = [
  { icon: 'ncInfo', cls: 'text-nc-content-brand' },
  { icon: 'ncCheckCircle', cls: 'text-nc-content-green-dark' },
  { icon: 'ncAlertTriangle', cls: 'text-nc-content-yellow-dark' },
  { icon: 'ncAlertCircle', cls: 'text-nc-content-red-dark' },
  { icon: 'ncStar', cls: 'text-nc-content-purple-dark' },
  { icon: 'ncHeart', cls: 'text-nc-content-pink-dark' },
]

const fillIcons: IconMapKey[] = [
  'checkFill',
  'ncUpgradeSparkle',
  'nocodb1',
  'ncGithub',
  'ncLogoGoogleColored',
  'ncLogoSlackColored',
  'ncLogoFigmaColored',
]

const iconSizes = ['w-3 h-3', 'w-4 h-4', 'w-5 h-5', 'w-6 h-6', 'w-8 h-8']

const dbTypes = [
  ClientType.PG,
  ClientType.MYSQL,
  ClientType.SQLITE,
  ClientType.MSSQL,
  ClientType.SNOWFLAKE,
  ClientType.ORACLE,
  '',
]

const integrationTypes = computed(() => Object.keys(integrationsIconMap.value).slice(0, 32))

// the first entry is the composite NocoDB-sync mark; a plain logo reads better across sizes
const sizeDemoType = computed(() => integrationTypes.value.find((t) => t === ClientType.PG) ?? integrationTypes.value[0])

function iconExists(icon: string) {
  return icon in iconMap
}
</script>

<template>
  <PgSection id="icons" title="Icon" source="GeneralIcon" description="Pass any iconMap key. Colour follows currentColor.">
    <PgDemo label="Outline icons">
      <div class="grid grid-cols-8 md:grid-cols-12 gap-3">
        <NcTooltip v-for="icon in sampleIcons.filter(iconExists)" :key="icon" :title="icon" :arrow="false">
          <div class="h-10 rounded-lg flex items-center justify-center text-nc-content-gray-subtle hover:bg-nc-bg-gray-light">
            <GeneralIcon :icon="icon" class="w-4 h-4" />
          </div>
        </NcTooltip>
      </div>
    </PgDemo>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <PgDemo label="Coloured" hint="text-nc-content-*">
        <div class="flex gap-4">
          <GeneralIcon
            v-for="c in colouredIcons.filter((i) => iconExists(i.icon))"
            :key="c.icon"
            :icon="c.icon"
            class="w-5 h-5"
            :class="c.cls"
          />
        </div>
      </PgDemo>
      <PgDemo label="Fill / logo" hint="stroke: transparent">
        <div class="flex gap-4">
          <GeneralIcon v-for="icon in fillIcons.filter(iconExists)" :key="icon" :icon="icon" class="w-5 h-5" />
        </div>
      </PgDemo>
      <PgDemo label="Sizes">
        <div class="flex items-end gap-4 text-nc-content-gray">
          <GeneralIcon v-for="s in iconSizes" :key="s" icon="ncSettings" :class="s" />
        </div>
      </PgDemo>
    </div>
  </PgSection>

  <PgSection id="brand" title="Brand marks" source="GeneralNocodbLogo · GeneralNocoIcon · GeneralAiSparkleHero">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <PgDemo label="NocodbLogo" hint="mono in dark mode">
        <div class="flex items-center gap-4">
          <GeneralNocodbLogo class="!h-5 !w-5" />
          <GeneralNocodbLogo class="!h-7 !w-7" />
          <GeneralNocodbLogo class="!h-10 !w-10" />
        </div>
      </PgDemo>
      <PgDemo label="NocoIcon" hint="click to ping · animate while loading">
        <!-- NocoIcon straddles its parent's top edge (top: -size/2), as on the sign-in card -->
        <div class="flex items-end gap-4 pt-8">
          <div class="relative w-24 h-12 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight">
            <GeneralNocoIcon :size="48" />
          </div>
          <div class="relative w-28 h-12 rounded-lg border-1 border-nc-border-gray-medium bg-nc-bg-gray-extralight">
            <GeneralNocoIcon :size="64" animate />
          </div>
        </div>
      </PgDemo>
      <PgDemo v-if="isEeUI" label="AiSparkleHero">
        <div class="flex items-center gap-4">
          <GeneralAiSparkleHero :size="24" />
          <GeneralAiSparkleHero />
          <GeneralAiSparkleHero :size="56" />
        </div>
      </PgDemo>
    </div>
  </PgSection>

  <PgSection id="source-logos" title="Database & integration logos" source="GeneralBaseLogo · GeneralIntegrationIcon">
    <PgDemo label="BaseLogo" hint="per ClientType, empty = fallback">
      <div class="flex items-center gap-5">
        <NcTooltip v-for="t in dbTypes" :key="t" :title="t || 'default'" :arrow="false">
          <GeneralBaseLogo :source-type="t" class="w-6 h-6" />
        </NcTooltip>
      </div>
    </PgDemo>
    <PgDemo label="IntegrationIcon" :hint="`${integrationTypes.length} of ${Object.keys(integrationsIconMap).length} registered`">
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap gap-3">
          <NcTooltip v-for="t in integrationTypes" :key="t" :title="t" :arrow="false">
            <div class="w-10 h-10 rounded-lg border-1 border-nc-border-gray-medium flex items-center justify-center">
              <GeneralIntegrationIcon :type="t" size="md" />
            </div>
          </NcTooltip>
        </div>
        <div v-if="sizeDemoType" class="flex items-end gap-4">
          <GeneralIntegrationIcon
            v-for="s in ['sx', 'sm', 'md', 'lg', 'xl', 'xxl'] as const"
            :key="s"
            :type="sizeDemoType"
            :size="s"
          />
        </div>
      </div>
    </PgDemo>
  </PgSection>
</template>
