<script setup lang="ts">
import PgDemo from '../../-components/PgDemo.vue'
import PgSection from '../../-components/PgSection.vue'

const TYPES = ['primary', 'secondary', 'text', 'danger', 'link'] as const

const SIZES = ['xxsmall', 'xsmall', 'xs', 'small', 'medium'] as const

const ICON_SIZES: ReadonlyArray<(typeof SIZES)[number]> = ['xxsmall', 'xsmall']

const THEMES = ['default', 'ai', 'orange'] as const

const isSaving = ref(false)

function simulateSave() {
  isSaving.value = true
  setTimeout(() => (isSaving.value = false), 1500)
}
</script>

<template>
  <PgSection
    id="buttons"
    :title="$t('labels.buttons')"
    source="NcButton"
    description="Every type across every size, plus the state and icon variants."
  >
    <PgDemo label="Type × size" hint="xxsmall · xsmall are square icon buttons; xs · small · medium carry a label">
      <div class="overflow-x-auto">
        <table class="border-separate border-spacing-x-3 border-spacing-y-2">
          <thead>
            <tr>
              <th />
              <th v-for="size in SIZES" :key="size" class="text-left text-captionXs text-nc-content-gray-muted font-mono">
                {{ size }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="type in TYPES" :key="type">
              <td class="text-captionXs text-nc-content-gray-muted font-mono pr-2">{{ type }}</td>
              <td v-for="size in SIZES" :key="size">
                <div v-if="ICON_SIZES.includes(size)" class="flex items-center gap-1.5">
                  <NcButton :type="type" :size="size" icon-only>
                    <template #icon>
                      <GeneralIcon icon="plus" />
                    </template>
                  </NcButton>
                  <NcButton :type="type" :size="size" icon-only>
                    <template #icon>
                      <GeneralIcon icon="threeDotVertical" />
                    </template>
                  </NcButton>
                </div>
                <NcButton v-else :type="type" :size="size">{{ $t('general.saveChanges') }}</NcButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </PgDemo>

    <PgDemo label="States">
      <div class="flex flex-col gap-3">
        <div v-for="type in TYPES" :key="type" class="flex items-start gap-3">
          <span class="w-20 flex-none h-8 flex items-center text-captionXs text-nc-content-gray-muted font-mono">{{ type }}</span>
          <div class="flex-1 min-w-0 flex flex-wrap items-center gap-3">
            <NcButton :type="type" size="small">{{ $t('general.default') }}</NcButton>
            <NcButton :type="type" size="small" disabled>{{ $t('general.disabled') }}</NcButton>
            <NcButton :type="type" size="small" show-as-disabled>Shown as disabled</NcButton>
            <NcButton :type="type" size="small" loading>Loading</NcButton>
            <NcButton :type="type" size="small">
              <template #icon>
                <GeneralIcon icon="plus" />
              </template>
              {{ $t('activity.newRecord') }}
            </NcButton>
            <NcButton :type="type" size="small" icon-position="right">
              <template #icon>
                <GeneralIcon icon="arrowRight" />
              </template>
              {{ $t('general.continue') }}
            </NcButton>
            <NcButton :type="type" size="small" icon-only>
              <template #icon>
                <GeneralIcon icon="threeDotVertical" />
              </template>
            </NcButton>
          </div>
        </div>
      </div>
    </PgDemo>

    <PgDemo label="Themes & modifiers" hint="theme, bordered, shadow, fullWidth, textColor">
      <div class="flex flex-col gap-3">
        <div v-for="theme in THEMES" :key="theme" class="flex items-center gap-3">
          <span class="w-20 flex-none text-captionXs text-nc-content-gray-muted font-mono">{{ theme }}</span>
          <div class="flex-1 min-w-0 flex flex-wrap items-center gap-3">
            <NcButton :theme="theme" size="small">Primary</NcButton>
            <NcButton :theme="theme" type="secondary" size="small">Secondary</NcButton>
            <NcButton :theme="theme" type="text" size="small">{{ $t('general.text') }}</NcButton>
          </div>
        </div>
        <div class="flex items-start gap-3">
          <span class="w-20 flex-none h-8 flex items-center text-captionXs text-nc-content-gray-muted font-mono">modifiers</span>
          <div class="flex-1 min-w-0 flex flex-wrap items-center gap-3">
            <NcButton type="secondary" size="small" :bordered="false">No border</NcButton>
            <NcButton type="secondary" size="small" :shadow="false">No shadow</NcButton>
            <NcButton type="text" size="small" text-color="primary">Primary text</NcButton>
            <NcButton type="primary" size="small" :loading="isSaving" @click="simulateSave">Click to load</NcButton>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span class="w-20 flex-none text-captionXs text-nc-content-gray-muted font-mono">fullWidth</span>
          <NcButton type="secondary" size="small" full-width class="flex-1">
            <div class="flex-1 flex items-center justify-between">
              Choose a role
              <GeneralIcon icon="arrowDown" />
            </div>
          </NcButton>
        </div>
      </div>
    </PgDemo>
  </PgSection>
</template>
