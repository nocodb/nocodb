---
title: 'NocoDB SDK'
description: 'SDK'
position: 1400
category: 'Developer Resources'
menuTitle: 'NocoDB SDK'
---

We provide SDK for users to integrate with their applications. Currently only SDK for Javascript is supported.

<alert>
Note: The NocoDB SDK requires API token for authorization. If you haven't created an API token, please check out <a href="./api-tokens" target="_blank">API Tokens</a> and create one first.
</alert>

### SDK For Javascript

```js
import { Api } from 'nocodb-sdk'

const api = new Api({
  baseURL: 'http://<HOST>:<PORT>',
  headers: {
    'xc-token': '<API_TOKEN>'
  }
})

// await api.meta.something()
// await api.data.something()
```

