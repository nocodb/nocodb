/**
 * Regression coverage for NC-FE-SEC-001 — stored XSS in the table-deletion
 * dependency notice. The notice is built from persisted schema metadata
 * (column / related-table titles) which is attacker-controllable on an external
 * data source. It must render as TEXT, never via innerHTML.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { buildTableDeleteDependencyMessage } from '~/utils/tableDeleteDependencyMessage'

describe('buildTableDeleteDependencyMessage — table-delete notice XSS', () => {
  const payload = '<img src=x onerror="window.__NC_TABLE_DELETE_XSS=1">'

  it('renders an attacker-controlled dependency line as inert text', () => {
    const vnode = buildTableDeleteDependencyMessage([`1. ${payload} is a LinkToAnotherRecord of parent`])
    const wrapper = mount({ render: () => vnode })

    // The payload appears verbatim as text …
    expect(wrapper.text()).toContain(payload)
    // … and NOT as a live element (no <img> node was created from the metadata).
    expect(wrapper.html()).not.toContain('<img')
    expect(wrapper.html()).toContain('&lt;img')
    // The inline handler must never have fired.
    expect((window as any).__NC_TABLE_DELETE_XSS).not.toBe(1)
  })

  it('keeps the surrounding notice copy', () => {
    const wrapper = mount({ render: () => buildTableDeleteDependencyMessage(['1. A is a LinkToAnotherRecord of B']) })
    expect(wrapper.text()).toContain('Unable to delete tables because of the following.')
    expect(wrapper.text()).toContain('Delete them & try again')
  })
})
