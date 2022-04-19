---
title: 'GraphQL APIs'
position: 1020
category: 'Developer Resources'
menuTitle: 'GraphQL APIs'
---

<alert type="danger">
GraphQL APIs, unfortunately, has been deprecated form v0.90 onwards - which means

- Users won't be able to create a GraphQL project nor use the GraphQL queries.
- For projects created before v0.90, we will convert it to REST API projects.
- The rationale behind is that GraphQL is a really small use case of NocoDB users and smart spreadsheet are usually flat representation of data (may be one level nested) which means there will be additional wrangling of json and GQL schema when users are changing the schema dynamically.
</alert>