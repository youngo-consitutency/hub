import { describe, expect, it } from 'vitest'
import { matchHubRoute } from '../../src/member/hub/routes'
import { isPanelPath } from '../../src/member/lib/router'

// a record opens in the side panel over its list: both paths must resolve to the same component,
// or React would remount the list and lose its filters when the panel opens
const PANELS = ['calendar', 'coys', 'groups', 'submissions', 'opportunities', 'council']

describe('hub side panels', () => {
  it.each(PANELS)('/%s and /%s/:slug share one page', (base) => {
    const list = matchHubRoute(`/${base}`)
    const open = matchHubRoute(`/${base}/some-record`)
    expect(list?.kind).toBe('page')
    expect(open?.kind).toBe('page')
    if (list?.kind !== 'page' || open?.kind !== 'page') return
    expect(open.Page).toBe(list.Page)
    expect(open.props).toEqual({ slug: 'some-record' })
    expect(list.props).toEqual({})
    expect(isPanelPath(`/${base}/some-record`)).toBe(true)
    expect(isPanelPath(`/${base}`)).toBe(false)
  })

  it('keeps the fixed submission paths ahead of the panel', () => {
    for (const path of [
      '/submissions/new',
      '/submissions/workspace',
      '/submissions/amendments/new',
    ]) {
      const match = matchHubRoute(path)
      expect(match?.kind === 'page' && 'slug' in match.props).toBe(false)
    }
  })

  it('sends an old task-force page to its group panel', () => {
    expect(matchHubRoute('/groups/finance/climate-finance')).toEqual({
      kind: 'redirect',
      to: '/groups/finance',
    })
  })
})
