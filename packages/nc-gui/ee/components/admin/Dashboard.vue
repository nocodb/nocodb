<script lang="ts" setup>
const orgStore = useOrg()

const { org } = storeToRefs(orgStore)

const { loadOrg } = orgStore

const { members, fetchOrganizationMembers, workspaces, listWorkspaces, bases, fetchOrganizationBases } = useOrganization()

onMounted(async () => {
  await Promise.all([loadOrg(), fetchOrganizationMembers(), listWorkspaces(), fetchOrganizationBases()])
})
</script>

<template>
  <div v-if="org" class="flex flex-col" data-test-id="nc-admin-dashboard">
    <div class="nc-breadcrumb px-2">
      <div class="nc-breadcrumb-item">
        {{ org.title }}
      </div>
      <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />
      <div class="nc-breadcrumb-item active">
        {{ $t('labels.dashboard') }}
      </div>
    </div>
    <NcPageHeader>
      <template #icon>
        <GeneralIcon icon="home1" class="flex-none h-5 w-5 !text-gray-700" />
      </template>
      <template #title>
        <span data-rec="true">
          {{ $t('labels.dashboard') }}
        </span>
      </template>
    </NcPageHeader>

    <div
      class="nc-content-max-w flex-1 max-h-[calc(100vh_-_100px)] overflow-y-auto nc-scrollbar-thin flex flex-col items-center gap-6 p-6"
    >
      <div class="flex flex-col gap-6 w-150">
        <span class="font-bold text-xl" data-rec="true">
          {{ $t('general.general') }}
        </span>
        <div class="flex flex-col border-1 rounded-2xl border-gray-200 p-6 gap-y-5">
          <div class="flex items-center gap-5">
            <GeneralWorkspaceIcon
              :workspace="{
                id: org.id,
                title: org?.title,
                ...(org.image ? { meta: { icon: parseProp(org.image), iconType: WorkspaceIconType.IMAGE } } : {}),
              }"
              :class="{
                'w-24 h-24': !org.image,
              }"
              :is-rounded="!org.image"
              size="xlarge"
            />
            <span class="text-gray-900 text-2xl font-semibold"> {{ org.title }} </span>
          </div>
          <div class="flex border-1 rounded-lg border-gray-200">
            <div class="w-1/3 px-4 border-r-1 py-3">
              <div class="text-[40px] font-semibold">{{ workspaces.length }}</div>
              <div class="text-gray-600 mt-2">
                Total {{ workspaces.length > 1 ? $t('labels.workspaces') : $t('labels.workspace') }}
              </div>
            </div>
            <div class="w-1/3 px-4 border-r-1 py-3">
              <div class="text-[40px] font-semibold">{{ members.length }}</div>
              <div class="text-gray-600 mt-2">Total {{ members.length > 1 ? $t('labels.members') : $t('objects.member') }}</div>
            </div>
            <div class="w-1/3 px-4 py-3">
              <div class="text-[40px] font-semibold">{{ bases.length }}</div>
              <div class="text-gray-600 mt-2">Total {{ bases.length > 1 ? $t('objects.projects') : $t('labels.project') }}</div>
            </div>
          </div>
          <!--
           <div class="border-1 rounded-lg">
             <div class="flex items-center px-4 py-3 gap-4">
               <div class="flex gap-2 items-center text-gray-600">
                 <component :is="iconMap.users" class="w-4 h-4" />
                 <span class="text-gray-600">Total Members</span>
               </div>
               <div class="text-2xl font-semibold">{{ members.length }}</div>
             </div>
               <div class="flex border-t-1">
               <div class="w-1/4 border-r-1 px-4 py-3">
                 <div class="text-2xl mb-2 font-semibold">16</div>
                 <RolesBadge :border="false" role="creator" />
               </div>
               <div class="w-1/4 border-r-1 px-4 py-3">
                 <div class="text-2xl mb-2 font-semibold">34</div>
                 <RolesBadge :border="false" role="editor" />
               </div>
               <div class="w-1/4 border-r-1 px-4 py-3">
                 <div class="text-2xl mb-2 font-semibold">89</div>
                 <RolesBadge :border="false" role="commenter" />
               </div>
               <div class="w-1/4 px-4 py-3">
                 <div class="text-2xl mb-2 font-semibold">1087</div>
                 <RolesBadge :border="false" role="viewer" />
               </div>
             </div>
        </div> -->
        </div>

        <!--      <div class="flex flex-col border-1 rounded-2xl border-gray-200 p-6">
        <div class="font-bold text-base" data-rec="true">
          {{ $t('labels.members') }}
        </div>
        <span class="text-gray-600 mt-2"> 23 new members have been added to the organisation since your last invoice. </span>
        <a-divider class="text-gray-200" />

        <div class="flex justify-end">
          <NcButton size="small" type="secondary" @click="navigateTo(`/admin/${$route.params.orgId}/members`)">
            <div class="flex items-center gap-2">
              <span> {{ $t('labels.goToMembers') }} </span>
              <component :is="iconMap.arrowUpRight" />
            </div>
          </NcButton>
        </div>
      </div> -->
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
