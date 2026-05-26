import {
  OFFICIAL_STATUS_MENU_TITLE,
  OPENAI_STATUS_SUMMARY_URL,
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
})
