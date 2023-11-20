<script lang="ts" setup>
import { computed } from '#imports'

interface Props {
  url: string
  socialMedias: string[]
  title?: string
  summary?: string
  hashTags?: string
  css?: string
  iconClass?: string
  width?: string
}

const {
  url,
  socialMedias,
  title = 'NocoDB',
  summary,
  hashTags = '',
  css = '',
  iconClass = '',
  width = '45px',
} = defineProps<Props>()

const summaryArr = [
  'Instant #Rest & #GraphQL APIs on any #SQL Database (Supports : MySQL, PostgresSQL, MsSQL, SQLite, MariaDB) #nocodb ',
  'Instantly generate #Rest & #GraphQL APIs on any #SQL Database (Supports : MySQL, PostgresSQL, MsSQL, SQLite, MariaDB) #nocodb',
  'Instant #serverless Rest & #GraphQL APIs on any Database #nocodb',
  'Instant APIs on any SQL Database (Supports : #REST #GraphQL #MySQL, #PostgresSQL, #MsSQL, #SQLite, #MariaDB) #nocodb',
  'Generate Instant APIs on any SQL Database (Supports : #REST #GraphQL #MySQL, #PostgresSQL, #MsSQL, #SQLite, #MariaDB) #nocodb',
]

const shareUrl = computed(() => encodeURIComponent(url))

const encodedTitle = computed(() => encodeURIComponent(title || 'NocoDB'))

const encodedSummary = computed(() => encodeURIComponent(summary || summaryArr[Math.floor(Math.random() * summaryArr.length)]))

const fbHashTags = computed(() => hashTags && `%23${hashTags}`)

const openUrl = (url: string) => {
  window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div class="flex gap-2">
    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('twitter')"
      href="#"
      :class="iconClass"
      class="px-2"
      @click.prevent="openUrl(`https://twitter.com/intent/tweet?url=${shareUrl}&text=${encodedSummary}&hashtags=${hashTags}`)"
    >
      <img
        src="~/assets/img/social/twitter.png"
        class="img-responsive"
        alt="Twitter"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>

    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('linkedin')"
      href="#"
      :class="iconClass"
      class="px-2"
      @click.prevent="
        openUrl(`https://www.linkedin.com/shareArticle?mini=true&url=${shareUrl}&title=${encodedTitle}&summary=${encodedSummary}`)
      "
    >
      <img
        src="~/assets/img/social/linkedin.png"
        class="img-responsive"
        alt="Linkedin"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>

    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('facebook')"
      href="#"
      :class="iconClass"
      class="px-2"
      @click.prevent="
        openUrl(
          `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}&title=${encodedTitle}&summary=${encodedSummary}&quote=${encodedTitle}&hashtag=${fbHashTags}`,
        )
      "
    >
      <img
        src="~/assets/img/social/facebook.png"
        class="img-responsive"
        alt="Facebook"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>

    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('reddit')"
      href="#"
      :class="iconClass"
      class="px-2"
      @click.prevent="openUrl(`https://www.reddit.com/submit?url=${shareUrl}&title=${encodedSummary}`)"
    >
      <img
        src="~/assets/img/social/reddit.png"
        class="img-responsive"
        alt="Reddit"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>

    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('pinterest')"
      href="#"
      :class="iconClass"
      class="px-2"
      @click.prevent="openUrl(`https://pinterest.com/pin/create/button/?url=${shareUrl}&description==${encodedSummary}`)"
    >
      <img
        src="~/assets/img/social/pinterest.png"
        class="img-responsive"
        alt="Printrest"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>

    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('whatsapp')"
      href="#"
      :class="iconClass"
      class="px-2"
      @click.prevent="openUrl(`https://api.whatsapp.com/send?text=${encodedSummary}%0D%0A${shareUrl}`)"
    >
      <img
        src="~/assets/img/social/whatsapp.png"
        class="img-responsive"
        alt="Whatsapp"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>
    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('telegram')"
      href="#"
      :class="iconClass"
      class="px-2"
      @click.prevent="openUrl(`https://telegram.me/share/url?url=${shareUrl}&text=${encodedSummary}`)"
    >
      <img
        src="~/assets/img/social/png/telegram.png"
        class="img-responsive"
        alt="Telegram"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>
    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('wechat')"
      :class="iconClass"
      class="px-2"
      @click.prevent="openUrl(`https://www.addtoany.com/add_to/wechat?linkurl=${shareUrl}&linkname=${encodedTitle}`)"
    >
      <img
        src="~/assets/img/social/png/wechat.png"
        class="img-responsive"
        alt="Wechat"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>
    <a v-if="!socialMedias || !socialMedias.length || socialMedias.includes('line')" href="#" :class="iconClass" class="px-2">
      <img
        src="~/assets/img/social/png/line.png"
        class="img-responsive"
        alt="Line"
        :width="width"
        :style="css"
        title="Social Media Share"
        @click.prevent="openUrl(`http://line.me/R/msg/text/?${encodedTitle}%0D%0A${shareUrl}`)"
      />
    </a>
    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('odnoklassniki')"
      href="#"
      :class="iconClass"
      class="px-2"
    >
      <img
        src="~/assets/img/social/png/odnoklassniki.png"
        class="img-responsive"
        alt="Odnoklassniki"
        :width="width"
        :style="css"
        title="Social Media Share"
        @click.prevent="
          openUrl(`https://connect.ok.ru/dk?st.cmd=WidgetSharePreview&st.shareUrl=${shareUrl}&st.comments=${encodedSummary}`)
        "
      />
    </a>
    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('weibo')"
      href="#"
      :class="iconClass"
      class="px-2"
      @click.prevent="openUrl(`http://service.weibo.com/share/share.php?url=${shareUrl})&title=${encodedTitle}`)"
    >
      <img
        src="~/assets/img/social/png/weibo.png"
        class="img-responsive"
        alt="Weibo"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>
    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('renren')"
      :class="iconClass"
      class="px-2"
      @click.prevent="
        openUrl(
          `http://widget.renren.com/dialog/share?resourceUrl=${shareUrl}&srcUrl=${shareUrl}&title=${encodedTitle}&description=${encodedSummary}`,
        )
      "
    >
      <img
        src="~/assets/img/social/png/renren.png"
        class="img-responsive"
        alt="Renren"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>
    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('douban')"
      :class="iconClass"
      class="px-2"
      @click.prevent="openUrl(`http://www.douban.com/recommend/?url=${shareUrl}&title=${encodedTitle}`)"
    >
      <img
        src="~/assets/img/social/png/douban.png"
        class="img-responsive"
        alt="Douban"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>
    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('vk')"
      href="#"
      :class="iconClass"
      class="px-2"
      @click.prevent="
        openUrl(`https://vk.com/share.php?url=${shareUrl})&title=${encodedTitle}&description=${encodedSummary}&noparse=true`)
      "
    >
      <img
        src="~/assets/img/social/png/vk.png"
        class="img-responsive"
        alt="VK"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>
    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('wykop')"
      :class="iconClass"
      class="px-2"
      @click.prevent="openUrl(`https://www.addtoany.com/add_to/wykop?linkurl=${shareUrl}&linkname=${encodedTitle}`)"
    >
      <img
        src="~/assets/img/social/png/wykop.jpg"
        class="img-responsive"
        alt="Wykop"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>
  </div>
</template>

<style scoped>
.img-responsive {
  width: 30px;
}
.small .img-responsive {
  width: 25px;
}

a {
  @apply cursor-pointer text-3xl rounded-full p-2 bg-gray-100 shadow-md hover:(shadow-lg bg-gray-200);
}
</style>
