---
title: 'Caching'
description: 'Caching'
position: 1300
category: 'Developer Resources'
menuTitle: 'Caching'
---

We introduced a Caching layer to store meta data by utilising Redis. By default, caching is enabled. If you prefer not to cache, you can configure it by setting environment variable `NC_DISABLE_CACHE` to `true`. You can also use your own Redis instance by setting environment variable `NC_REDIS_URL` (e.g. `redis://:authpassword@127.0.0.1:6380/4`). If you don't specify it, by default, it will be cached in memory.