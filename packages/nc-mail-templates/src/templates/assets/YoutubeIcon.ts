import {defineComponent, h} from "vue";

export default defineComponent({
    name: "YoutubeIcon",
    setup() {
        return () => {
            return h("img", {
                src: "https://cdn.nocodb.com/email/youtube.png",
                alt: "Youtube Icon",
                width: "24",
                height: "24",
            });
        };
    },
});
