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

export interface OpenAIStatusGroupSnapshot {
  groupId: string
  status: string
  sampledAt: number
}

export interface OpenAIStatusHistoryEntry {
  sampledAt: number
  groups: Record<string, string>
}

export interface OpenAIStatusGroupAggregate extends OpenAIStatusGroupedComponents {
  worstStatus: string
}

export const OFFICIAL_STATUS_MENU_TITLE = '官渠状态'
export const OPENAI_STATUS_PAGE_HOST = 'status.openai.com'
export const OPENAI_STATUS_SUMMARY_URL = `https://${OPENAI_STATUS_PAGE_HOST}/api/v2/summary.json`
export const OPENAI_STATUS_HISTORY_STORAGE_KEY = 'openai-status-history-v1'
export const OPENAI_STATUS_HISTORY_INTERVAL_MS = 5 * 60 * 1000
export const OPENAI_STATUS_HISTORY_MAX_ENTRIES = 288

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

const STATUS_SEVERITY: Record<string, number> = {
  operational: 0,
  none: 0,
  degraded_performance: 1,
  minor: 1,
  under_maintenance: 2,
  partial_outage: 2,
  major: 2,
  major_outage: 3,
  critical: 3,
}

export function getWorstStatus(statuses: string[]): string {
  if (statuses.length === 0) return 'operational'
  return statuses.reduce((worst, current) => {
    const worstSeverity = STATUS_SEVERITY[worst] ?? 99
    const currentSeverity = STATUS_SEVERITY[current] ?? 99
    return currentSeverity > worstSeverity ? current : worst
  }, statuses[0] ?? 'operational')
}

export function aggregateOpenAIStatusGroups(summary: OpenAIStatusSummary | null): OpenAIStatusGroupAggregate[] {
  return groupOpenAIComponents(summary).map((group) => ({
    ...group,
    worstStatus: getWorstStatus(group.components.map((component) => component.status)),
  }))
}

export function readOpenAIStatusHistory(storage?: Storage): OpenAIStatusHistoryEntry[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(OPENAI_STATUS_HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is OpenAIStatusHistoryEntry => {
      return typeof entry === 'object'
        && entry !== null
        && typeof (entry as OpenAIStatusHistoryEntry).sampledAt === 'number'
        && typeof (entry as OpenAIStatusHistoryEntry).groups === 'object'
        && (entry as OpenAIStatusHistoryEntry).groups !== null
    })
  } catch {
    return []
  }
}

export function writeOpenAIStatusHistory(entries: OpenAIStatusHistoryEntry[], storage?: Storage) {
  if (!storage) return
  storage.setItem(OPENAI_STATUS_HISTORY_STORAGE_KEY, JSON.stringify(entries))
}

export function appendOpenAIStatusHistory(
  summary: OpenAIStatusSummary | null,
  now = Date.now(),
  storage?: Storage,
): OpenAIStatusHistoryEntry[] {
  const history = readOpenAIStatusHistory(storage)
  const aggregated = aggregateOpenAIStatusGroups(summary)
  if (aggregated.length === 0) return history

  const latest = history[history.length - 1]
  if (latest && now - latest.sampledAt < OPENAI_STATUS_HISTORY_INTERVAL_MS) {
    return history
  }

  const nextEntry: OpenAIStatusHistoryEntry = {
    sampledAt: now,
    groups: Object.fromEntries(
      aggregated.map((group) => [group.id, group.worstStatus]),
    ),
  }

  const nextHistory = [...history, nextEntry].slice(-OPENAI_STATUS_HISTORY_MAX_ENTRIES)
  writeOpenAIStatusHistory(nextHistory, storage)
  return nextHistory
}

export function computeOpenAIGroupUptime(
  history: OpenAIStatusHistoryEntry[],
  groupId: string,
): number | null {
  const samples = history.filter((entry) => typeof entry.groups[groupId] === 'string')
  if (samples.length === 0) return null
  const operational = samples.filter((entry) => entry.groups[groupId] === 'operational').length
  return (operational / samples.length) * 100
}

export function getOpenAIGroupHistoryStatuses(
  history: OpenAIStatusHistoryEntry[],
  groupId: string,
  limit = 60,
): string[] {
  return history
    .map((entry) => entry.groups[groupId])
    .filter((status): status is string => typeof status === 'string')
    .slice(-limit)
}
