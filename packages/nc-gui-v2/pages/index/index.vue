<template>
  <NuxtLayout class="">
    <div
      class="min-h-[calc(100vh_-_var(--header-height))] h-auto bg-primary bg-opacity-5 flex flex-col lg:flex-row flex-wrap gap-6 py-6 px-12 pt-65px"
    >
      <div class="hidden xl:(block)">
        <GeneralSponsors />
      </div>

      <div class="min-w-2/4 xl:max-w-2/4 w-full flex-auto">
        <NuxtPage />
      </div>

      <div class="flex flex-1 justify-between gap-6 lg:block">
        <div>
          <GeneralSocialCard />
        </div>

        <div class="block mt-0 lg:(!mt-6) xl:hidden">
          <GeneralSponsors />
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>
