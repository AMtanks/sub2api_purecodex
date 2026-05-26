export interface CustomMenuLike {
  label?: string | null
  url?: string | null
}

export interface OpenAIStatusSummary {
  page: {
    id: string
    name: string
    url: string
    updated_at: string
  }
  status: {
    description: string
    indicator: string
  }
  components?: Array<{
    id: string
    name: string
    status: string
    updated_at?: string
    position?: number
  }>
  incidents?: Array<{
    id: string
    name: string
    status: string
    impact?: string
    shortlink?: string
    updated_at?: string
  }>
  scheduled_maintenances?: Array<{
    id: string
    name: string
    status: string
    impact?: string
    shortlink?: string
    scheduled_for?: string
    scheduled_until?: string
  }>
}

export const OFFICIAL_STATUS_MENU_TITLE = '官渠状态'
export const OPENAI_STATUS_PAGE_HOST = 'status.openai.com'
export const OPENAI_STATUS_SUMMARY_URL = `https://${OPENAI_STATUS_PAGE_HOST}/api/v2/summary.json`

export function isOpenAIStatusUrl(rawUrl?: string | null): boolean {
  if (!rawUrl) return false
  try {
    const url = new URL(rawUrl)
    return url.hostname === OPENAI_STATUS_PAGE_HOST
  } catch {
    return false
  }
}

export function isOfficialStatusMenuItem(item?: CustomMenuLike | null): boolean {
  if (!item) return false
  if (item.label?.trim() === OFFICIAL_STATUS_MENU_TITLE) return true
  return isOpenAIStatusUrl(item.url)
}

export function resolveCustomPageDisplayTitle(item?: CustomMenuLike | null, fallback = ''): string {
  if (isOfficialStatusMenuItem(item)) return OFFICIAL_STATUS_MENU_TITLE
  return item?.label?.trim() || fallback
}

export async function fetchOpenAIStatusSummary(signal?: AbortSignal): Promise<OpenAIStatusSummary> {
  const response = await fetch(OPENAI_STATUS_SUMMARY_URL, {
    method: 'GET',
    signal,
  })
  if (!response.ok) {
    throw new Error(`OpenAI status request failed: ${response.status}`)
  }
  return response.json() as Promise<OpenAIStatusSummary>
}
