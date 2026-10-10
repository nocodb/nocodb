<script setup lang="ts">
import { IconType, ViewTypes } from 'nocodb-sdk'
import type { TableType, TeamV3V3Type, ViewType, WorkspaceType } from 'nocodb-sdk'
import PgSection from '../../-components/PgSection.vue'
import PgDemo from '../../-components/PgDemo.vue'
import type { PresenceStackUser } from '~/lib/types'

const userSizes = ['small', 'medium', 'base', 'large', 'xlarge'] as const

const workspaceSizes = ['small', 'medium', 'large', 'xlarge'] as const

const users = [
  { id: 'u1', email: 'priya.raman@acme.io', display_name: 'Priya Raman' },
  { id: 'u2', email: 'marcus.lee@acme.io', display_name: 'Marcus Lee' },
  { id: 'u3', email: 'sofia.alvarez@acme.io', display_name: '' },
  { id: 'u4', email: 'kenji.tanaka@acme.io', display_name: 'Kenji Tanaka', meta: { icon: '🚀', iconType: IconType.EMOJI } },
  { id: 'u5', email: 'amara.okafor@acme.io', display_name: 'Amara Okafor', meta: { icon: 'ncStar', iconType: IconType.ICON } },
  { id: 'u6', email: 'li.wei@acme.io', display_name: 'Li Wei' },
]

const userVariants = [
  { label: 'Initials', user: users[0] },
  { label: 'Email only', user: users[2] },
  { label: 'Emoji', user: users[3] },
  { label: 'Icon', user: users[4] },
  { label: 'Placeholder', placeholder: true },
  { label: 'Disabled', user: users[0], disabled: true },
  { label: 'Deleted', user: users[1], deleted: true },
]

const presenceUsers: PresenceStackUser[] = users.map((u) => ({
  userId: u.id,
  email: u.email,
  display_name: u.display_name,
  meta: u.meta ?? null,
}))

const teams: TeamV3V3Type[] = [
  { id: 't1', title: 'Design', icon: '🎨', icon_type: IconType.EMOJI, members_count: 8 },
  { id: 't2', title: 'Platform Engineering', members_count: 23 },
  { id: 't3', title: 'Growth', icon: 'ncZap', icon_type: IconType.ICON, members_count: 4 },
] as TeamV3V3Type[]

const workspaces: Partial<WorkspaceType>[] = [
  { id: 'w1', title: 'Acme Corp', meta: { color: '#3366FF' } },
  { id: 'w2', title: 'Marketing', meta: { color: '#FA8231', icon: '📣', iconType: IconType.EMOJI } },
  { id: 'w3', title: 'Data team', meta: { color: '#27D665', icon: 'ncDatabase', iconType: IconType.ICON } },
  { id: 'w4', title: 'nocodb' },
]

const tables: TableType[] = [
  { id: 't1', title: 'Customers' },
  { id: 't2', title: 'Orders', meta: { icon: '📦' } },
  { id: 't3', title: 'Synced CRM', synced: true },
  { id: 't4', title: 'SQL view', type: 'view' },
] as TableType[]

const viewTypes = Object.entries(ViewTypes).filter(([, v]) => typeof v === 'number') as Array<[string, number]>

const projectIcons = [undefined, 'ncBox', 'ncDatabase', 'ncRocket']

function viewMeta(type: number, icon?: string) {
  return { id: `v${type}`, title: '', type, meta: icon ? { icon } : {} } as ViewType
}
</script>

<template>
  <PgSection id="user-icon" title="User avatars" source="GeneralUserIcon · GeneralUserName">
    <PgDemo label="Sizes" :hint="userSizes.join(' · ')">
      <div class="flex flex-wrap items-end gap-6">
        <div v-for="size in userSizes" :key="size" class="flex flex-col items-center gap-2">
          <GeneralUserIcon :user="users[0]" :size="size" />
          <span class="text-captionXs font-mono text-nc-content-gray-muted">{{ size }}</span>
        </div>
      </div>
    </PgDemo>
    <PgDemo label="Variants" hint="initials, emoji, icon, placeholder, disabled, deleted · size base">
      <div class="flex flex-wrap items-start gap-5">
        <div v-for="v in userVariants" :key="v.label" class="w-16 flex flex-col items-center gap-2">
          <GeneralUserIcon
            :user="v.user"
            size="base"
            :show-placeholder-icon="v.placeholder"
            :disabled="v.disabled"
            :is-deleted="v.deleted"
          />
          <span class="text-captionXs text-nc-content-gray-muted text-center">{{ v.label }}</span>
        </div>
      </div>
    </PgDemo>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <PgDemo label="Initials length">
        <div class="flex items-center gap-3">
          <GeneralUserIcon :user="users[0]" size="large" :initials-length="1" />
          <GeneralUserIcon :user="users[0]" size="large" :initials-length="2" />
        </div>
      </PgDemo>
      <PgDemo label="UserName" hint="display name → email fallback, truncates with tooltip">
        <div class="flex flex-col gap-1 max-w-56 text-caption">
          <GeneralUserName v-for="u in users.slice(0, 3)" :key="u.id" :user="u" />
          <GeneralUserName :user="null" fallback="Unknown user" />
          <div class="w-28"><GeneralUserName :user="{ email: 'a.really.long.email.address@example.com' }" /></div>
        </div>
      </PgDemo>
    </div>
  </PgSection>

  <PgSection id="presence" title="Presence stack" source="GeneralPresenceAvatarStack">
    <PgDemo>
      <div class="flex items-center gap-8">
        <GeneralPresenceAvatarStack :users="presenceUsers.slice(0, 2)" />
        <GeneralPresenceAvatarStack :users="presenceUsers" />
        <GeneralPresenceAvatarStack :users="presenceUsers" size="small" :max-visible="4" />
      </div>
    </PgDemo>
  </PgSection>

  <PgSection id="team" :title="$t('general.teams')" source="GeneralTeamIcon · GeneralTeamInfo">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <PgDemo label="TeamIcon">
        <div class="flex flex-col gap-3">
          <div v-for="t in teams" :key="t.id" class="flex items-center gap-3">
            <GeneralTeamIcon v-for="size in userSizes" :key="size" :team="t" :size="size" />
          </div>
        </div>
      </PgDemo>
      <PgDemo label="TeamInfo">
        <div class="flex flex-col gap-3">
          <GeneralTeamInfo v-for="t in teams" :key="t.id" :team="t" />
          <GeneralTeamInfo :team="teams[0]" disabled />
        </div>
      </PgDemo>
    </div>
  </PgSection>

  <PgSection id="workspace-icon" title="Workspace & base icons" source="GeneralWorkspaceIcon · GeneralProjectIcon">
    <PgDemo label="WorkspaceIcon">
      <div class="flex flex-col gap-3">
        <div v-for="size in workspaceSizes" :key="size" class="flex items-center gap-3">
          <span class="w-16 text-captionSm text-nc-content-gray-muted">{{ size }}</span>
          <GeneralWorkspaceIcon v-for="w in workspaces" :key="w.id" :workspace="w" :size="size" />
          <GeneralWorkspaceIcon :workspace="workspaces[0]" :size="size" is-rounded />
        </div>
      </div>
    </PgDemo>
    <PgDemo label="ProjectIcon" hint="every baseIconColors entry × icon">
      <div class="flex flex-col gap-3">
        <div v-for="icon in projectIcons" :key="icon ?? 'default'" class="flex items-center gap-3">
          <GeneralProjectIcon v-for="color in baseIconColors" :key="color" :color="color" :icon="icon" class="w-5 h-5" />
        </div>
      </div>
    </PgDemo>
  </PgSection>

  <PgSection id="table-view-icon" title="Table & view icons" source="GeneralTableIcon · GeneralViewIcon">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <PgDemo label="TableIcon" hint="default, emoji, synced, sql view">
        <div class="flex flex-col gap-2">
          <div v-for="t in tables" :key="t.id" class="flex items-center gap-2 text-caption">
            <GeneralTableIcon :meta="t" />
            {{ t.title }}
          </div>
        </div>
      </PgDemo>
      <PgDemo label="ViewIcon" hint="all ViewTypes">
        <div class="grid grid-cols-2 gap-2">
          <div v-for="[name, type] in viewTypes" :key="type" class="flex items-center gap-2 text-caption">
            <GeneralViewIcon :meta="viewMeta(type)" />
            <GeneralViewIcon :meta="viewMeta(type)" ignore-color class="text-nc-content-gray-muted" />
            <span class="capitalize">{{ name.toLowerCase() }}</span>
          </div>
          <div class="flex items-center gap-2 text-caption">
            <GeneralViewIcon :meta="viewMeta(ViewTypes.GRID, '🔥')" />
            emoji icon
          </div>
        </div>
      </PgDemo>
    </div>
  </PgSection>
</template>
