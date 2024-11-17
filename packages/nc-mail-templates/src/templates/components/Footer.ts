import {defineComponent, h} from "vue";
import Icons from "../assets";

export default defineComponent({
    name: "Header",
    setup() {
        return () => {
            return h(
                "div",
                {
                    style: {
                        width: "100%",
                        "max-width": "426px",
                        'padding-block': "24px",
                        'margin-block': "64px",
                        'text-justify': "distribute",
                    },
                },
                [
                    h(
                        "div",
                        {
                            style: {
                                width: "100%",
                                "max-width": "426px",
                                'padding-block': "24px",
                                display: "flex",
                                'justify-content': "space-between",
                                'align-items': "center",
                            },
                        },
                        [
                            h("img", {
                                src: "https://cdn.nocodb.com/email/logo.png",
                                alt: "NocoDB",
                                style: {
                                    height: "40px",
                                },
                            }),
                            h(
                                'div',
                                {
                                    style: {
                                        display: "flex",
                                        gap: "16px",
                                    },
                                },
                                [
                                    h(
                                        "a",
                                        {
                                            href: "https://github.com/nocodb",
                                            style: {
                                                'text-decoration': "none",
                                                color: "black",
                                                'margin-left': "4px",
                                            },
                                        },
                                        h(Icons.GithubIcon)
                                    ),
                                    h(
                                        "a",
                                        {
                                            href: "https://x.com/nocodb",
                                            style: {
                                                'text-decoration': "none",
                                                color: "black",
                                                'margin-left': "4px",
                                            },
                                        },
                                        h(Icons.TwitterIcon)
                                    ),
                                    h(
                                        "a",
                                        {
                                            href: "https://www.youtube.com/@nocodb/videos",
                                            style: {
                                                'text-decoration': "none",
                                                color: "black",
                                                'margin-left': "4px",
                                            },
                                        },
                                        h(Icons.YoutubeIcon)
                                    ),
                                    h(
                                        "a",
                                        {
                                            href: "https://discord.gg/c7GEYrvFtT",
                                            style: {
                                                'text-decoration': "none",
                                                color: "black",
                                                'margin-left': "4px",
                                            },
                                        },
                                        h(Icons.DiscordIcon)
                                    ),
                                    h(
                                        "a",
                                        {
                                            href: "https://www.linkedin.com/company/nocodb/",
                                            style: {
                                                'text-decoration': "none",
                                                color: "black",
                                                'margin-left': "4px",
                                            },
                                        },
                                        h(Icons.LinkedIcon)
                                    ),
                                ]
                            ),
                        ]
                    ),

                    h(
                        "div",
                        {
                            style: {
                                width: "100%",

                                'padding-top': "24px",
                            },
                        },
                        [
                            h(
                                "a",
                                {
                                    href: "https://blog.nocodb.com/",
                                    style: {
                                        'text-decoration': "none",
                                        color: "#6A7184",
                                        'font-size': "14px",
                                    },
                                },
                                "Blog"
                            ),
                            " | ",
                            h(
                                "a",
                                {
                                    href: "https://docs.nocodb.com/",
                                    style: {
                                        'text-decoration': "none",
                                        color: "#6A7184",
                                        'font-size': "14px",
                                    },
                                },
                                "Getting Started"
                            ),
                            " | ",
                            h(
                                "a",
                                {
                                    href: "https://docs.nocodb.com/",
                                    style: {
                                        'text-decoration': "none",
                                        color: "#6A7184",
                                        'font-size': "14px",
                                    },
                                },
                                "Documentation"
                            ),
                            " | ",
                            h(
                                "a",
                                {
                                    href: "https://nocodb.com/terms-of-service",
                                    style: {
                                        'text-decoration': "none",
                                        color: "#6A7184",
                                        'font-size': "14px",
                                    },
                                },
                                "Terms of Service"
                            ),
                        ]
                    ),

                    h(
                        "div",
                        {
                            style: {
                                'padding-top': "24px",

                                width: "100%",
                                'justify-content': "flex-start",
                                'align-items': "items-start",
                                color: "#6A7184",
                                'text-align': "left",
                            },
                        },
                        "2024 - NocoDB Inc "
                    ),
                    h(
                        "div",
                        {
                            style: {
                                'padding-top': "24px",

                                width: "100%",
                                'justify-content': "flex-start",
                                'align-items': "items-start",
                                color: "#6A7184",
                                'text-align': "left",
                            },
                        },
                        "All rights reserved "
                    ),
                ]
            );
        };
    },
});
