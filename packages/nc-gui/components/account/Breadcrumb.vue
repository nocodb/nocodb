<script lang="ts" setup>
const route = useRoute()

interface BreadcrumbType {
  title: string
  active?: boolean
}

const { t } = useI18n()

const breadcrumb = computed<BreadcrumbType[]>(() => {
  let payload: BreadcrumbType[] = [
    {
      title: 'Account',
    },
  ]
  
  switch (route.params.page) {
    case 'profile': {
      payload.push({
        title: t('labels.profile'),
        active: true,
      })
      break
    }
    case 'tokens': {
      payload.push({
        title: t('title.tokens'),
        active: true,
      })
      break
    }
    case 'audit': {
      payload.push({
        title: t('title.auditLogs'),
        active: true,
      })
      break
    }
    case 'apps': {
      payload.push({
        title: t('title.appStore'),
        active: true,
      })
      break
    }
  }

  switch (route.params.nestedPage) {
    case 'password-reset': {
      payload.push(
        ...[
          {
            title: t('objects.users'),
          },
          {
            title: t('title.resetPasswordMenu'),
            active: true,
          },
        ],
      )
      break
    }
    case 'settings': {
      payload.push(
        ...[
          {
            title: t('objects.users'),
          },
          {
            title: t('activity.settings'),
            active: true,
          },
        ],
      )
      break
    }
  }

  if ((route.params.page === undefined && route.params.nestedPage === '') || route.params.nestedPage === 'list') {
    payload.push(
      ...[
        {
          title: t('objects.users'),
        },
        {
          title: t('title.userManagement'),
          active: true,
        },
      ],
    )
  }

  return payload
})
</script>

<template>
  <div class="nc-breadcrumb">
    <template v-for="(item, i) of breadcrumb" :key="i">
      <div
        class="nc-breadcrumb-item"
        :class="{
          active: item.active,
        }"
      >
        {{ item.title }}
      </div>
      <GeneralIcon v-if="i !== breadcrumb.length - 1" icon="ncSlash" class="nc-breadcrumb-divider" />
    </template>
  </div>
</template>
