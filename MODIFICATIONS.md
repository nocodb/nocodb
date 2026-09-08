# Modifications in this development branch

This branch modifies upstream NocoDB `develop` at commit
`5eed724de3c2e0a6c4bd94a5e331a40b24f8fb8c` to address
[saved-view record counts, #9135](https://github.com/nocodb/nocodb/issues/9135).
The modifications were prepared on September 8, 2026, with AI assistance under
the `sabre-coder` account. The upstream [license](LICENSE.md) and notices remain in
place. This source branch is available for review without charge.

Users can enable a record count, bold text when the count is nonzero, or both,
while creating a non-form view or through its **Record count** menu. The refresh
interval is configurable in hours or days and defaults to one day. Each count
reflects saved filters and the current user's access; temporary filters on the
currently open view are not included.

The browser refreshes counts while the sidebar nodes and browser tab are
visible. Counts are cached in memory across sidebar collapse, limited to four
concurrent requests, and invalidated or isolated when authentication or roles
change. Numeric counts are never persisted in view metadata. Temporary failures
hide the count and retry after five minutes; denied or removed views stop
retrying until their session or permission scope changes.

Validation: 30 focused Vitest tests, compilation of five changed Vue components,
strict TypeScript checking of the pure cache/settings helper, Prettier formatting,
and whitespace checks. A full application build, live backend integration test,
and end-to-end browser test have not been run.
