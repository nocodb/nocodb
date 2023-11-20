<script setup lang="ts">
import { useGlobal, useProfile, useRoute } from '#imports'

const route = useRoute()

const { user } = useGlobal()

const { loadProfile, profile, followUser, unfollowUser, isFollowing } = useProfile()

await loadProfile(route.params.username as string)
</script>

<template>
  <NuxtLayout>
    <a-layout class="h-[75vh] overflow-y-auto flex">
      <a-layout-sider :collapsed="false" width="320" class="h-max px-5" :trigger="null" collapsible theme="light">
        <div class="mx-2">
          <div class="my-3">
            <a-avatar v-if="profile.avatar" :size="150" :src="profile.avatar" />
            <a-avatar v-else :size="150">
              <template #icon>
                <MdiAccount class="w-full h-full p-[15px]" />
              </template>
            </a-avatar>
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
              <MdiAccountSupervisorOutline class="text-lg" />
              {{ profile.followerCount }} followers．{{ profile.followingCount }} Following
            </div>
          </div>

          <div v-if="profile.id !== user.id" class="nc-profile-follow-btn my-4">
            <a-button
              v-if="!isFollowing"
              class="!bg-primary !border-none w-full text-center !text-white rounded"
              size="large"
              @click="followUser(profile.id)"
            >
              Follow
            </a-button>
            <a-button
              v-else
              class="!bg-primary !border-none w-full text-center !text-white rounded"
              size="large"
              @click="unfollowUser(profile.id)"
            >
              Unfollow
            </a-button>
          </div>

          <div class="nc-profile-edit-btn my-4">
            <a-button class="!bg-primary !border-none w-full text-center !text-white rounded" size="large">
              Edit Profile
            </a-button>
          </div>

          <div v-if="profile.location" class="nc-profile-location my-2">
            <div class="flex items-center mr-4"><MdiMapMarkerOutline class="text-lg mr-2" /> {{ profile.location }}</div>
          </div>

          <div v-if="profile.website" class="nc-profile-website my-2">
            <div class="flex items-center mr-4">
              <MdiLinkVariant class="text-lg mr-2" />
              <a class="!no-underline" :href="profile.website" rel="noopener noreferrer" target="_blank">{{ profile.website }}</a>
            </div>
          </div>

          <div class="nc-profile-statistics my-10">
            <div class="text-[20px] font-bold">Statistics</div>
            <div class="mt-5">
              <div class="flex items-center mr-4">
                <MdiCircleMedium class="text-lg text-[#4E2BDC]" />
                <span class="text-[16px]">Database</span>
              </div>
              <div class="mt-2">
                <div class="nc-profile-statistics-badge inline-block m-1">
                  <a-button class="!rounded-2xl !bg-[#F2F4F7]" size="small"> Columns </a-button>
                  <span class="ml-2 text-[12px]">x5</span>
                </div>
                <div class="nc-profile-statistics-badge inline-block m-1">
                  <a-button class="!rounded-2xl !bg-[#F2F4F7]" size="small"> Views </a-button>
                  <span class="ml-2 text-[12px]">x21</span>
                </div>
                <div class="nc-profile-statistics-badge inline-block m-1">
                  <a-button class="!rounded-2xl !bg-[#F2F4F7]" size="small"> Tables </a-button>
                  <span class="ml-2 text-[12px]">x158</span>
                </div>
                <div class="nc-profile-statistics-badge inline-block m-1">
                  <a-button class="!rounded-2xl !bg-[#F2F4F7]" size="small"> Databases </a-button>
                  <span class="ml-2 text-[12px]">x9</span>
                </div>
              </div>
            </div>
            <div class="mt-5">
              <div class="flex items-center mr-4">
                <MdiCircleMedium class="text-lg text-[#E9ED2A]" />
                <span class="text-[16px]">Automations</span>
              </div>
              <div class="mt-2">
                <div class="nc-profile-statistics-badge inline-block m-1">
                  <a-button class="!rounded-2xl !bg-[#F2F4F7]" size="small"> Columns </a-button>
                  <span class="ml-2 text-[12px]">x5</span>
                </div>
                <div class="nc-profile-statistics-badge inline-block m-1">
                  <a-button class="!rounded-2xl !bg-[#F2F4F7]" size="small"> Views </a-button>
                  <span class="ml-2 text-[12px]">x21</span>
                </div>
                <div class="nc-profile-statistics-badge inline-block m-1">
                  <a-button class="!rounded-2xl !bg-[#F2F4F7]" size="small"> Tables </a-button>
                  <span class="ml-2 text-[12px]">x158</span>
                </div>
                <div class="nc-profile-statistics-badge inline-block m-1">
                  <a-button class="!rounded-2xl !bg-[#F2F4F7]" size="small"> Databases </a-button>
                  <span class="ml-2 text-[12px]">x9</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </a-layout-sider>
      <a-layout-content class="h-max px-5 py-2 scrollbar-thumb-gray-500">
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
  </NuxtLayout>
</template>
