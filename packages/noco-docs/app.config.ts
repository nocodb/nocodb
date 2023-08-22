export default defineAppConfig({
  docus: {
    title: "NocoDB",
    description: "The best place to start your documentation.",
    image: "/icon.png",
    socials: {
      github: "nocodb/nocodb",
      twitter: "@nocodb",
    },
    github: {
      dir: "packages/noco-docs",
      branch: "develop",
      repo: "nocodb",
      owner: "nocodb",
      edit: true,
    },
    aside: {
      level: 0,
      collapsed: false,
      exclude: [],
    },
    main: {
      padded: true,
      fluid: true,
    },
    header: {
      title: "NocoDB",
      logo: true,
      exclude: [],
      fluid: true,
    },
  },
});
