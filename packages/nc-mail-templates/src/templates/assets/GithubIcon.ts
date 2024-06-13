import {defineComponent, h} from "vue";

export default defineComponent({
    name: "GithubIcon",
    setup() {
        return () => {
            return h("img", {
                src: "https://app.nocodb.com/github.png",
                alt: "Github Icon",
                width: "24",
                height: "24",
            });
        };
    },
});
