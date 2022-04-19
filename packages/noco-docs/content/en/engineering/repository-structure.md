---
title: "Repository Structure"
description: "Repository Structure"
position: 3000
category: "Engineering"
menuTitle: "Repository Structure"
---

We use ``Lerna`` to manage multi-packages. We have the following [packages](https://github.com/nocodb/nocodb/tree/master/packages).

- ``packages/nc-cli`` : A CLI to create NocoDB app.

- ``packages/nocodb-sdk``: API client sdk of nocodb.

- ``packages/nc-gui``: NocoDB Frontend.

- ``packages/nc-lib-gui``: The build version of ``nc-gui`` which will be used in ``packages/nocodb``.

- ``packages/nc-migrator-archived``: SQL based schema migrations or evolutions.

- ``packages/nc-plugin``: Plugin template.

- ``packages/noco-blog``: NocoDB Blog which will be auto-released to [nocodb/noco-blog](https://github.com/nocodb/noco-blog).

- ``packages/noco-book``: NocoDB Handbook which will be auto-released to [nocodb/noco-book](https://github.com/nocodb/noco-book).

- ``packages/noco-docs``: NocoDB Documentation which will be auto-released to [nocodb/noco-docs](https://github.com/nocodb/noco-docs).

- ``packages/noco-docs-prev``: NocoDB Documentation for previous versions which will be auto-released to [nocodb/noco-docs-prev](https://github.com/nocodb/noco-docs-prev) and will be completely removed on 30 Jun 2022.

- ``packages/nocodb``: NocoDB Backend, hosted in [NPM](https://www.npmjs.com/package/nocodb).