<script setup lang="ts">
//
</script>

<template>
  <div class="prose-2xl font-bold">Contribution Activity</div>
  <div class="nc-profile-timeline">
    <a-divider orientation="left" orientation-margin="0">December 2022</a-divider>
    <a-timeline>
      <a-timeline-item color="red">
        <div>Created 21 activities in 2 projects</div>
        <div class="text-primary">
          slair.xyz / project_1
          <span class="text-gray-600"> 12 activities </span>
        </div>
        <div class="text-primary">
          slair.xyz / project_2
          <span class="text-gray-600"> 9 activities </span>
        </div>
      </a-timeline-item>
      <a-timeline-item>
        <div>Answered 2 discussions in 1 base</div>
        <div class="text-primary">slair.xyz / project_8</div>
        <div class="prose-xs">
          <div class="flex items-center mr-4">
            <MdiStickerCheckOutline class="mr-2 text-[#13B140]" />
            How can i create automation?
          </div>
          <div class="flex items-center mr-4">
            <MdiStickerCheckOutline class="mr-2 text-[#13B140]" />
            How can i create database?
          </div>
        </div>
      </a-timeline-item>
    </a-timeline>
  </div>
  <div class="nc-profile-timeline">
    <a-divider orientation="left" orientation-margin="0">November 2022</a-divider>
    <a-timeline>
      <a-timeline-item color="red">
        <div>Created 21 activities in 2 projects</div>
        <div class="text-primary">
          slair.xyz / project_1
          <span class="text-gray-600"> 12 activities </span>
        </div>
        <div class="text-primary">
          slair.xyz / project_2
          <span class="text-gray-600"> 9 activities </span>
        </div>
      </a-timeline-item>
      <a-timeline-item>
        <div>Answered 2 discussions in 1 base</div>
        <div class="text-primary">slair.xyz / project_8</div>
        <div class="prose-xs">
          <div class="flex items-center mr-4">
            <MdiStickerCheckOutline class="mr-2 text-[#13B140]" />
            How can i create automation?
          </div>
          <div class="flex items-center mr-4">
            <MdiStickerCheckOutline class="mr-2 text-[#13B140]" />
            How can i create database?
          </div>
        </div>
      </a-timeline-item>
    </a-timeline>
  </div>
  <div class="nc-profile-more-activity-btn">
    <a-button class="!bg-primary !border-none w-1/2 text-center !text-white rounded" size="large"> Show More Activity </a-button>
  </div>
</template>
