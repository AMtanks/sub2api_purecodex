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

export interface OpenAIStatusComponentGroup {
  id: string
  name: string
  description?: string
  componentNames: string[]
}

export interface OpenAIStatusGroupedComponents {
  id: string
  name: string
  description?: string
  components: NonNullable<OpenAIStatusSummary['components']>
}

export const OFFICIAL_STATUS_MENU_TITLE = '官渠状态'
export const OPENAI_STATUS_PAGE_HOST = 'status.openai.com'
export const OPENAI_STATUS_SUMMARY_URL = `https://${OPENAI_STATUS_PAGE_HOST}/api/v2/summary.json`

export const OPENAI_STATUS_COMPONENT_GROUPS: OpenAIStatusComponentGroup[] = [
  {
    id: 'apis',
    name: 'APIs',
    description: 'api.openai.com',
    componentNames: [
      'Chat Completions',
      'Responses',
      'Fine-tuning',
      'Embeddings',
      'Images',
      'Batch',
      'Audio',
      'Moderations',
      'Realtime',
      'Files',
      'Login',
      'Sora',
    ],
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    description: 'chatgpt.com',
    componentNames: [
      'Conversations',
      'Login',
      'Compliance API',
      'Search',
      'File uploads',
      'Voice mode',
      'GPTs',
      'Image Generation',
      'Deep Research',
      'Agent',
      'ChatGPT Atlas',
      'Connectors/Apps',
    ],
  },
  {
    id: 'codex',
    name: 'Codex',
    componentNames: [
      'Codex Web',
      'App',
      'Codex API',
      'CLI',
      'VS Code extension',
    ],
  },
  {
    id: 'fedramp',
    name: 'FedRAMP',
    componentNames: ['FedRAMP'],
  },
]

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

export function groupOpenAIComponents(summary: OpenAIStatusSummary | null): OpenAIStatusGroupedComponents[] {
  const components = summary?.components ?? []
  const byName = new Map(components.map((component) => [component.name, component]))
  const consumed = new Set<string>()

  const groups = OPENAI_STATUS_COMPONENT_GROUPS.map((group) => {
    const grouped = group.componentNames
      .map((name) => byName.get(name))
      .filter((component): component is NonNullable<typeof component> => Boolean(component))

    for (const component of grouped) {
      consumed.add(component.id)
    }

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      components: grouped,
    }
  }).filter((group) => group.components.length > 0)

  const remaining = components.filter((component) => !consumed.has(component.id))
  if (remaining.length > 0) {
    groups.push({
      id: 'other',
      name: 'Other',
      description: undefined,
      components: remaining,
    })
  }

  return groups
}
