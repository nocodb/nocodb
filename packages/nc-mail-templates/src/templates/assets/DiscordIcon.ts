import {defineComponent, h} from "vue";

export default defineComponent({
    name: "Discord Icon",
    setup() {
        return () => {
            return h("img", {
                src: "https://app.nocodb.com/discord.png",
                width: "24",
                height: "24",
                alt: "Discord Icon",
            });
        };
    },
});
