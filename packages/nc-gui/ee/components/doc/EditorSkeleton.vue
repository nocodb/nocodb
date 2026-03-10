<template>
  <div class="nc-doc-editor-skeleton flex flex-row h-full w-full overflow-hidden">
    <div class="relative flex-1 min-w-0 h-full overflow-hidden">
      <!-- Header bar skeleton — matches nc-doc-page-menu-left + nc-doc-page-menu -->
      <div class="h-[var(--topbar-height)] flex items-center justify-between px-3 border-b border-nc-border-gray-medium">
        <!-- Left: breadcrumb skeleton -->
        <a-skeleton-input active size="small" class="!w-40 children:rounded-md !h-4" />

        <!-- Right: action buttons skeleton -->
        <div class="flex items-center gap-2">
          <a-skeleton-avatar active shape="square" class="!h-6 !w-6 !children:(rounded-md w-6 h-6)" />
          <a-skeleton-avatar active shape="square" class="!h-6 !w-6 !children:(rounded-md w-6 h-6)" />
          <a-skeleton-avatar active shape="square" class="!h-6 !w-6 !children:(rounded-md w-6 h-6)" />
        </div>
      </div>

      <!-- Scrollable content area -->
      <div class="flex flex-col h-full overflow-y-auto nc-scrollbar-thin">
        <div class="w-full mx-auto px-6 sm:px-10 lg:px-16 max-w-[900px]">
          <!-- Title area -->
          <div class="pt-10 pb-4">
            <!-- Icon + Title -->
            <div class="flex items-center gap-3">
              <a-skeleton-avatar active shape="square" class="!h-7 !w-7 !children:(rounded-md w-7 h-7)" />
              <a-skeleton-input active size="small" class="!w-72 children:rounded-md !h-7" />
            </div>
            <!-- Subtitle: "Updated by ... · Comments" -->
            <div class="flex items-center gap-2 mt-3 ml-10">
              <a-skeleton-input active size="small" class="!w-48 children:rounded-md !h-3" />
            </div>
          </div>

          <!-- Content blocks -->
          <div class="flex flex-col gap-6 pb-48">
            <!-- H1 heading -->
            <a-skeleton-input active size="small" class="!w-48 children:rounded-md !h-5" />

            <!-- Paragraph block -->
            <div class="flex flex-col gap-2">
              <a-skeleton-input active size="small" class="!w-full children:rounded-md !h-3" />
              <a-skeleton-input active size="small" class="!w-11/12 children:rounded-md !h-3" />
              <a-skeleton-input active size="small" class="!w-4/5 children:rounded-md !h-3" />
            </div>

            <!-- H2 heading -->
            <a-skeleton-input active size="small" class="!w-40 children:rounded-md !h-4.5 mt-2" />

            <!-- Paragraph block -->
            <div class="flex flex-col gap-2">
              <a-skeleton-input active size="small" class="!w-full children:rounded-md !h-3" />
              <a-skeleton-input active size="small" class="!w-10/12 children:rounded-md !h-3" />
              <a-skeleton-input active size="small" class="!w-full children:rounded-md !h-3" />
              <a-skeleton-input active size="small" class="!w-3/5 children:rounded-md !h-3" />
            </div>

            <!-- Image placeholder -->
            <a-skeleton-avatar active shape="square" class="!w-full !h-44 !children:(rounded-lg w-full h-44)" />

            <!-- Paragraph block -->
            <div class="flex flex-col gap-2">
              <a-skeleton-input active size="small" class="!w-full children:rounded-md !h-3" />
              <a-skeleton-input active size="small" class="!w-9/12 children:rounded-md !h-3" />
            </div>

            <!-- Code block -->
            <div class="rounded-lg border border-nc-border-gray-light p-4 flex flex-col gap-2.5">
              <a-skeleton-input active size="small" class="!w-3/4 children:rounded-md !h-2.5" />
              <a-skeleton-input active size="small" class="!w-1/2 children:rounded-md !h-2.5" />
              <a-skeleton-input active size="small" class="!w-5/6 children:rounded-md !h-2.5" />
              <a-skeleton-input active size="small" class="!w-2/5 children:rounded-md !h-2.5" />
            </div>

            <!-- H2 heading -->
            <a-skeleton-input active size="small" class="!w-36 children:rounded-md !h-4.5 mt-2" />

            <!-- Paragraph block -->
            <div class="flex flex-col gap-2">
              <a-skeleton-input active size="small" class="!w-full children:rounded-md !h-3" />
              <a-skeleton-input active size="small" class="!w-11/12 children:rounded-md !h-3" />
              <a-skeleton-input active size="small" class="!w-7/12 children:rounded-md !h-3" />
            </div>

            <!-- Bulleted list -->
            <div class="flex flex-col gap-2.5 pl-4">
              <div v-for="i in 3" :key="i" class="flex items-center gap-2.5">
                <div class="w-1.5 h-1.5 rounded-full bg-nc-border-gray-medium flex-none" />
                <a-skeleton-input
                  active
                  size="small"
                  class="children:rounded-md !h-3"
                  :style="{ width: `${40 + (i % 3) * 15}%` }"
                />
              </div>
            </div>

            <!-- Paragraph block -->
            <div class="flex flex-col gap-2">
              <a-skeleton-input active size="small" class="!w-full children:rounded-md !h-3" />
              <a-skeleton-input active size="small" class="!w-4/6 children:rounded-md !h-3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
