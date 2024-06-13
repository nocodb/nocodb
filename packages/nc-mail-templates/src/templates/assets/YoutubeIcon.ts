import {defineComponent, h} from "vue";

export default defineComponent({
    name: "YoutubeIcon",
    setup() {
        return () => {
            return h("img", {
                src: "https://app.nocodb.com/youtube.png",
                alt: "Youtube Icon",
                width: "24",
                height: "24",
            });
        };
    },
});
