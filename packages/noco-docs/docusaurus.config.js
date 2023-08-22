// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'NocoDB',
  tagline: 'The Open Source Airtable Alternative',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://nocodb.com',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'nocodb', // Usually your GitHub org/user name.
  projectName: 'nocodb', // Usually your repo name.

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          routeBasePath: '/',
          editUrl: 'https://github.com/nocodb/nocodb/tree/develop/packages/noco-docs/docs/',
          lastVersion: 'current',
          versions: {
            current: {
              label: 'Latest',
            },
            '0.109.7': {
              label: '0.109.7 - Old UI',
            }
          },
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/docusaurus-social-card.jpg',
      navbar: {
        title: 'NocoDB',
        logo: {
          alt: 'NocoDB',
          src: 'img/icon.png',
        },
        items: [
          {
            type: 'docsVersionDropdown',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        logo: {
          alt: 'NocoDB',
          src: 'img/icon.png',
          width: 50,
        },
        links: [
          {
            label: 'GitHub',
            href: 'https://github.com/facebook/docusaurus',
          },
          {
            label: 'Website',
            href: 'https://nocodb.com/',
          },
          {
            label: 'Community',
            href: 'https://community.nocodb.com/',
          },
          {
            label: 'Discord',
            href: 'https://discord.gg/5RgZmkW',
          },
          {
            label: 'Twitter',
            href: 'https://twitter.com/nocodb',
          }
        ],
        copyright: `Copyright © ${new Date().getFullYear()} NocoDB`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
