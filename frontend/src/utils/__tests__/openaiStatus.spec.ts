import {
  appendOpenAIStatusHistory,
  aggregateOpenAIStatusGroups,
  computeOpenAIGroupUptime,
  getOpenAIGroupHistoryStatuses,
  OFFICIAL_STATUS_MENU_TITLE,
  OPENAI_STATUS_SUMMARY_URL,
  groupOpenAIComponents,
  isOfficialStatusMenuItem,
  isOpenAIStatusUrl,
  resolveCustomPageDisplayTitle,
} from '../openaiStatus'

describe('openaiStatus', () => {
  it('detects status.openai.com URLs', () => {
    expect(isOpenAIStatusUrl('https://status.openai.com/')).toBe(true)
    expect(isOpenAIStatusUrl(OPENAI_STATUS_SUMMARY_URL)).toBe(true)
    expect(isOpenAIStatusUrl('https://platform.openai.com/')).toBe(false)
    expect(isOpenAIStatusUrl('not-a-url')).toBe(false)
  })

  it('detects official status menu items by label or url', () => {
    expect(isOfficialStatusMenuItem({ label: OFFICIAL_STATUS_MENU_TITLE, url: '' })).toBe(true)
    expect(isOfficialStatusMenuItem({ label: 'OpenAI Status', url: 'https://status.openai.com/' })).toBe(true)
    expect(isOfficialStatusMenuItem({ label: 'Docs', url: 'https://platform.openai.com/docs' })).toBe(false)
  })

  it('resolves the display title for the official status page', () => {
    expect(
      resolveCustomPageDisplayTitle({ label: 'Status', url: 'https://status.openai.com/' }, 'Fallback')
    ).toBe(OFFICIAL_STATUS_MENU_TITLE)
    expect(resolveCustomPageDisplayTitle({ label: 'Docs', url: 'https://platform.openai.com' }, 'Fallback')).toBe('Docs')
    expect(resolveCustomPageDisplayTitle(undefined, 'Fallback')).toBe('Fallback')
  })

  it('groups known components into official sections', () => {
    const groups = groupOpenAIComponents({
      page: { id: 'p', name: 'OpenAI', url: 'https://status.openai.com', updated_at: '2026-05-26T00:00:00Z' },
      status: { description: 'All Systems Operational', indicator: 'none' },
      components: [
        { id: '1', name: 'Responses', status: 'operational' },
        { id: '2', name: 'Chat Completions', status: 'operational' },
        { id: '3', name: 'Codex API', status: 'operational' },
        { id: '4', name: 'FedRAMP', status: 'operational' },
        { id: '5', name: 'Unmapped', status: 'operational' },
      ],
    })

    expect(groups.map((group) => group.name)).toEqual(['APIs', 'Codex', 'FedRAMP', 'Other'])
    expect(groups[0].components).toHaveLength(2)
    expect(groups[3].components[0]?.name).toBe('Unmapped')
  })

  it('aggregates groups to their worst status', () => {
    const groups = aggregateOpenAIStatusGroups({
      page: { id: 'p', name: 'OpenAI', url: 'https://status.openai.com', updated_at: '2026-05-26T00:00:00Z' },
      status: { description: 'x', indicator: 'none' },
      components: [
        { id: '1', name: 'Responses', status: 'operational' },
        { id: '2', name: 'Images', status: 'partial_outage' },
      ],
    })

    expect(groups[0]?.name).toBe('APIs')
    expect(groups[0]?.worstStatus).toBe('partial_outage')
  })

  it('stores five-minute history snapshots and computes uptime', () => {
    const storage = new Map<string, string>()
    const mockStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value) },
      removeItem: (key: string) => { storage.delete(key) },
      clear: () => { storage.clear() },
      key: () => null,
      get length() { return storage.size },
    } as Storage

    const summary = {
      page: { id: 'p', name: 'OpenAI', url: 'https://status.openai.com', updated_at: '2026-05-26T00:00:00Z' },
      status: { description: 'x', indicator: 'none' },
      components: [
        { id: '1', name: 'Responses', status: 'operational' },
        { id: '2', name: 'Conversations', status: 'operational' },
      ],
    }

    appendOpenAIStatusHistory(summary, 0, mockStorage)
    appendOpenAIStatusHistory(summary, 60_000, mockStorage)
    appendOpenAIStatusHistory({
      ...summary,
      components: [
        { id: '1', name: 'Responses', status: 'partial_outage' },
        { id: '2', name: 'Conversations', status: 'operational' },
      ],
    }, 301_000, mockStorage)

    const historyStatuses = getOpenAIGroupHistoryStatuses(
      JSON.parse(storage.values().next().value as string),
      'apis',
    )

    expect(historyStatuses).toEqual(['operational', 'partial_outage'])
    expect(
      computeOpenAIGroupUptime(JSON.parse(storage.values().next().value as string), 'apis')
    ).toBe(50)
  })
})
