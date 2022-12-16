<script setup lang="ts">
import { useProfile, useRoute } from '#imports'

const route = useRoute()

const { loadProfile, profile } = useProfile()

await loadProfile(route.params.username as string)
</script>

<template>
  <NuxtLayout>
    <a-layout class="mt-3 h-[75vh] overflow-y-auto flex">
      <a-layout>
        <a-layout-sider
          :collapsed="false"
          width="280"
          class="relative shadow-md h-full z-1 nc-docs-left-sidebar px-3"
          :trigger="null"
          collapsible
          theme="light"
        >
          <div class="mx-2">
            <div class="my-3">
              <a-avatar :size="150" :src="profile.avatar" />
            </div>
            <div class="nc-profile-display-name text-[30px] my-2 font-bold">
              {{ profile.display_name }}
            </div>

            <div class="nc-profile-user-name text-[18px] my-2">@{{ profile.user_name }}</div>

            <div class="nc-profile-bio text-[15px] my-4">
              {{ profile.bio }}
            </div>

            <div class="nc-profile-follower my-2">
              <div class="flex items-center mr-4">
                <MdiAccountSupervisorOutline class="text-lg" /> 256 followers．41 Following
              </div>
            </div>

            <div class="nc-profile-follow-btn my-4">
              <a-button class="!bg-primary !border-none w-full text-center !text-white rounded" size="large"> Follow </a-button>
            </div>

            <div class="nc-profile-edit-btn my-4">
              <a-button class="!bg-primary !border-none w-full text-center !text-white rounded" size="large">
                Edit Profile
              </a-button>
            </div>

            <div class="nc-profile-location my-2">
              <div class="flex items-center mr-4"><MdiMapMarkerOutline class="text-lg mr-2" /> {{ profile.location }}</div>
            </div>

            <div class="nc-profile-website my-2">
              <div class="flex items-center mr-4">
                <MdiLinkVariant class="text-lg mr-2" />
                <a class="!no-underline" :href="profile.website" target="_blank">{{ profile.website }}</a>
              </div>
            </div>
          </div>
        </a-layout-sider>
        <a-layout-content class="h-auto px-5 py-2 scrollbar-thumb-gray-500">
          <a-tabs>
            <a-tab-pane key="overview" class="w-full">
              <template #tab>
                <div class="flex items-center mr-4">
                  <MdiBookOpenBlankVariant class="text-lg mr-2" />
                  Overview
                </div>
              </template>
              <LazyProfileOverview />
            </a-tab-pane>
            <a-tab-pane key="stars" class="w-full">
              <template #tab>
                <div class="flex items-center mr-4">
                  <MdiStarOutline class="text-lg mr-2" />
                  <span class="mr-2">Stars</span>
                  <a-badge
                    count="25"
                    :number-style="{
                      backgroundColor: '#B5B5B7',
                      color: '#FFFFFF',
                    }"
                  />
                </div>
              </template>
              <LazyProfileStars />
            </a-tab-pane>
          </a-tabs>
        </a-layout-content>
      </a-layout>
    </a-layout>
  </NuxtLayout>
</template>

<style scoped lang="scss"></style>
