<script setup lang="ts">
import { useExpandedFormStoreOrThrow } from '#imports'
import { timeAgo } from '~/utils'
import MdiKeyboardReturnIcon from '~icons/mdi/keyboard-return'
import MdiAccountIcon from '~icons/mdi/account-circle'
import {colors}

const { loadCommentsAndLogs, commentsAndLogs, isCommentsLoading, commentsOnly, saveComment,isYou } = useExpandedFormStoreOrThrow()

await loadCommentsAndLogs()
</script>

<template>
  <div>
    <v-skeleton-loader v-if="isCommentsLoading && !commentsAndLogs" type="list-item-avatar-two-line@8" />

    <div v-else class="blue-grey">
      <div v-for="log of commentsAndLogs" :key="log.id" class="d-flex">


        <MdiAccountIcon :class="isYou(log.user) ? 'text-pink-300' : 'text-blue-300 '"/>

        <p class="mb-1 caption edited-text">
          {{ isYou(log.user) ? 'You' : log.user == null ? 'Shared base' : log.user }}
          {{ log.op_type === 'COMMENT' ? 'commented' : log.op_sub_type === 'INSERT' ? 'created' : 'edited' }}
        </p>
<!--        :style="{ background: colors[2] }" -->
                 <p v-if="log.op_type === 'COMMENT'" class="caption mb-0 nc-chip" >
        {{ log.description }}
      </p>

        <p v-else v-dompurify-html="log.details" class="caption mb-0" style="word-break: break-all" />

        <p class="time text-right text-[10px] mb-0">
          {{ timeAgo(log.created_at) }}
        </p>
        </div>
<!--      <div v-for="log of commentsAndLogs" :key="log.id" class="d-flex">
        &lt;!&ndash;          <v-list-item-icon class="ma-0 mr-2">
            <v-icon :color="isYou(log.user) ? 'pink lighten-2' : 'blue lighten-2'">
              mdi-account-circle
            </v-icon>
          </v-list-item-icon> &ndash;&gt;
        <div class="flex-grow-1" style="min-width: 0">
          <p class="mb-1 caption edited-text">
            {{ // isYou(log.user) ? 'You' : log.user == null ? 'Shared base' : log.user }}
            {{ // log.op_type === 'COMMENT' ? 'commented' : log.op_sub_type === 'INSERT' ? 'created' : 'edited' }}
          </p>
          &lt;!&ndash;          <p v-if="log.op_type === 'COMMENT'" class="caption mb-0 nc-chip" :style="{ background: colors[2] }">
            {{ log.description }}
          </p>

          <p v-else v-dompurify-html="log.details" class="caption mb-0" style="word-break: break-all" />

          <p class="time text-right mb-0">
            {{ timeAgo(log.created_at) }}
          </p> &ndash;&gt;
        </div>
      </div>-->
    </div>
    <!--  </div> -->

    <!--  <v-spacer />
  <v-divider />
  <div class="d-flex align-center justify-center">
    <v-switch
      v-model="commentsOnly"
      v-t="['c:row-expand:comment-only']"
      class="mt-1"
      dense
      hide-details
      @change="getAuditsAndComments"
    >
      <template #label>
        <span class="caption grey&#45;&#45;text">Comments only</span>
      </template>
    </v-switch>
  </div> -->
      <div class="flex-shrink-1 mt-2 d-flex pl-4">
    <v-icon color="pink lighten-2" class="mr-2"> mdi-account-circle </v-icon>
    <a-input
      v-model="comment"
      class="caption comment-box"
      :class="{ focus: showborder }"
      @focusin="showborder = true"
      @focusout="showborder = false"
      @keyup.enter.prevent="saveComment"
    >
      <template v-if="comment" #addonAfter>
        <MdiKeyboardReturnIcon class="text-sm" small @click="saveComment" />
      </template>
    </a-input>
  </div>
  </div>
</template>

<style scoped></style>
