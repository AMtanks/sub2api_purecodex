import {
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
})
