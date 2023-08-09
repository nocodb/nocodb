---
title: "Development Setup"
description: "How to set-up your development environment"
position: 3200
category: "Engineering"
menuTitle: "Development Setup"
---

## Clone the repo

```bash
git clone https://github.com/nocodb/nocodb
```

## Install dependencies

```bash
# run under the root of the project
pnpm boostrap
```

## Start Frontend

```bash
cd packages/nc-gui
pnpm run dev
# Or
pnpm --filter=nc-gui run dev
```

## Start Backend

```bash
cd packages/nocodb
pnpm run start
# Or
pnpm --filter=nocodb run start
```

Any changes made to frontend and backend will be automatically reflected in the browser.

## Enabling CI-CD for Draft PR

CI-CD will be triggered on moving a PR from draft state to `Ready for review` state & on pushing changes to `Develop`. To verify CI-CD before requesting for review, add label `trigger-CI` on Draft PR. 

## Accessing CI-CD Failure Screenshots

For Playwright tests, screenshots are captured on the tests. These will provide vital clues for debugging possible issues observed in CI-CD. To access screenshots, Open link associated with CI-CD run & click on `Artifacts`
  
![Screenshot 2022-09-29 at 12 43 37 PM](https://user-images.githubusercontent.com/86527202/192965070-dc04b952-70fb-4197-b4bd-ca7eda066e60.png)

## Accessing 'Easter egg' menu

Double click twice on empty space between `View list` & `Share` button to the left top of Grid view; following options become accessible
1. Export Cache
2. Delete Cache
3. Debug Meta
4. Toggle Beta Features

![Screenshot 2023-05-23 at 8 35 14 PM](https://github.com/nocodb/nocodb/assets/86527202/fe2765fa-5796-4d26-8c12-e71b8226872e)


