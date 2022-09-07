<template>
  <div>
    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('twitter')"
      v-ge="['twitter', '']"
      href="#"
      :class="iconClass"
      class="px-2"
      @click.prevent="
        openUrl(`https://twitter.com/intent/tweet?url=${shareUrl}&text=${encodedSummary}&hashtags=${hashTags}`)
      "
    >
      <img
        src="social/twitter.png"
        class="img-responsive"
        alt="Twitter"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>

    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('linkedin')"
      v-ge="['linkedin', '']"
      href="#"
      :class="iconClass"
      class="px-2"
      @click.prevent="
        openUrl(
          `https://www.linkedin.com/shareArticle?mini=true&url=${shareUrl}&title=${encodedTitle}&summary=${encodedSummary}`
        )
      "
    >
      <img
        src="social/linkedin.png"
        class="img-responsive"
        alt="Linkedin"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>

    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('facebook')"
      v-ge="['facebook', '']"
      href="#"
      :class="iconClass"
      class="px-2"
      @click.prevent="
        openUrl(
          `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}&title=${encodedTitle}&summary=${encodedSummary}&quote=${encodedTitle}&hashtag=${fbHashTags}`
        )
      "
    >
      <img
        src="social/facebook.png"
        class="img-responsive"
        alt="Facebook"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>

    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('reddit')"
      v-ge="['reddit', '']"
      href="#"
      :class="iconClass"
      class="px-2"
      @click.prevent="openUrl(`https://www.reddit.com/submit?url=${shareUrl}&title=${encodedSummary}`)"
    >
      <img
        src="social/reddit.png"
        class="img-responsive"
        alt="Reddit"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>

    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('pinterest')"
      v-ge="['pinterest', '']"
      href="#"
      :class="iconClass"
      class="px-2"
      @click.prevent="
        openUrl(`https://pinterest.com/pin/create/button/?url=${shareUrl}&description==${encodedSummary}`)
      "
    >
      <img
        src="social/pinterest.png"
        class="img-responsive"
        alt="Printrest"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>

    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('whatsapp')"
      v-ge="['whatsapp', '']"
      href="#"
      :class="iconClass"
      class="px-2"
      @click.prevent="openUrl(`https://api.whatsapp.com/send?text=${encodedSummary}%0D%0A${shareUrl}`)"
    >
      <img
        src="social/whatsapp.png"
        class="img-responsive"
        alt="Whatsapp"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>
    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('telegram')"
      v-ge="['telegram', '']"
      href="#"
      :class="iconClass"
      class="px-2"
      @click.prevent="openUrl(`https://telegram.me/share/url?url=${shareUrl}&text=${encodedSummary}`)"
    >
      <img
        src="social/png/telegram.png"
        class="img-responsive"
        alt="Telegram"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>
    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('wechat')"
      v-ge="['wechat', '']"
      :class="iconClass"
      class="px-2"
      @click.prevent="openUrl(`https://www.addtoany.com/add_to/wechat?linkurl=${shareUrl}&linkname=${encodedTitle}`)"
    >
      <img
        src="social/png/wechat.png"
        class="img-responsive"
        alt="Wechat"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>
    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('line')"
      v-ge="['line', '']"
      href="#"
      :class="iconClass"
      class="px-2"
    >
      <img
        src="social/png/line.png"
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
      v-ge="['odnoklassniki', '']"
      href="#"
      :class="iconClass"
      class="px-2"
    >
      <img
        src="social/png/odnoklassniki.png"
        class="img-responsive"
        alt="Odnoklassniki"
        :width="width"
        :style="css"
        title="Social Media Share"
        @click.prevent="
          openUrl(
            `https://connect.ok.ru/dk?st.cmd=WidgetSharePreview&st.shareUrl=${shareUrl}&st.comments=${encodedSummary}`
          )
        "
      />
    </a>
    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('weibo')"
      v-ge="['weibo', '']"
      href="#"
      :class="iconClass"
      class="px-2"
      @click.prevent="openUrl(`http://service.weibo.com/share/share.php?url=${shareUrl})&title=${encodedTitle}`)"
    >
      <img
        src="social/png/weibo.png"
        class="img-responsive"
        alt="Weibo"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>
    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('renren')"
      v-ge="['renren', '']"
      :class="iconClass"
      class="px-2"
      @click.prevent="
        openUrl(
          `http://widget.renren.com/dialog/share?resourceUrl=${shareUrl}&srcUrl=${shareUrl}&title=${encodedTitle}&description=${encodedSummary}`
        )
      "
    >
      <img
        src="social/png/renren.png"
        class="img-responsive"
        alt="Renren"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>
    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('douban')"
      v-ge="['douban', '']"
      :class="iconClass"
      class="px-2"
      @click.prevent="openUrl(`http://www.douban.com/recommend/?url=${shareUrl}&title=${encodedTitle}`)"
    >
      <img
        src="social/png/douban.png"
        class="img-responsive"
        alt="Douban"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>
    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('vk')"
      v-ge="['vk', '']"
      href="#"
      :class="iconClass"
      class="px-2"
      @click.prevent="
        openUrl(
          `https://vk.com/share.php?url=${shareUrl})&title=${encodedTitle}&description=${encodedSummary}&noparse=true`
        )
      "
    >
      <img
        src="social/png/vk.png"
        class="img-responsive"
        alt="VK"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>
    <a
      v-if="!socialMedias || !socialMedias.length || socialMedias.includes('wykop')"
      v-ge="['wykop', '']"
      :class="iconClass"
      class="px-2"
      @click.prevent="openUrl(`https://www.addtoany.com/add_to/wykop?linkurl=${shareUrl}&linkname=${encodedTitle}`)"
    >
      <img
        src="social/png/wykop.jpg"
        class="img-responsive"
        alt="Wykop"
        :width="width"
        :style="css"
        title="Social Media Share"
      />
    </a>
  </div>
</template>

<script>
export default {
  name: 'ShareIcons',
  props: {
    url: String,
    socialMedias: {
      type: Array,
    },
    title: {
      default: 'NocoDB',
      type: String,
    },
    summary: {
      type: String,
    },
    hashTags: {
      default: '',
      type: String,
    },
    css: {
      default: '',
    },
    width: {
      default: '45px',
    },
    iconClass: {
      default: '',
    },
  },
  data() {
    return {
      summaryArr: [
        'Instant #Rest & #GraphQL APIs on any #SQL Database (Supports : MySQL, PostgresSQL, MsSQL, SQLite, MariaDB) #nocodb ',
        'Instantly generate #Rest & #GraphQL APIs on any #SQL Database (Supports : MySQL, PostgresSQL, MsSQL, SQLite, MariaDB) #nocodb',
        'Instant #serverless Rest & #GraphQL APIs on any Database #nocodb',
        'Instant APIs on any SQL Database (Supports : #REST #GraphQL #MySQL, #PostgresSQL, #MsSQL, #SQLite, #MariaDB) #nocodb',
        'Generate Instant APIs on any SQL Database (Supports : #REST #GraphQL #MySQL, #PostgresSQL, #MsSQL, #SQLite, #MariaDB) #nocodb',
      ],
    };
  },
  computed: {
    shareUrl() {
      return encodeURIComponent(this.url);
    },
    encodedSummary() {
      return ''; // encodeURIComponent(this.summary || this.summaryArr[Math.floor(Math.random() * this.summaryArr.length)])
    },
    encodedTitle() {
      return encodeURIComponent(this.title || 'NocoDB');
    },
    fbHashTags() {
      return this.hashTags && '%23' + this.hashTags;
    },
  },
  methods: {
    openUrl(url) {
      window.open(url, '_blank');
    },
  },
};
</script>

<style scoped>
.img-responsive {
  width: 30px;
}
.small .img-responsive {
  width: 25px;
}
</style>
