<template>
  <AppLayout>
    <div class="custom-page-layout">
      <div class="card flex-1 min-h-0 overflow-hidden">
        <div v-if="loading" class="flex h-full items-center justify-center py-12">
          <div
            class="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"
          ></div>
        </div>

        <div
          v-else-if="!menuItem"
          class="flex h-full items-center justify-center p-10 text-center"
        >
          <div class="max-w-md">
            <div
              class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-dark-700"
            >
              <Icon name="link" size="lg" class="text-gray-400" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('customPage.notFoundTitle') }}
            </h3>
            <p class="mt-2 text-sm text-gray-500 dark:text-dark-400">
              {{ t('customPage.notFoundDesc') }}
            </p>
          </div>
        </div>

        <!-- Markdown mode with TOC -->
        <div v-else-if="isMarkdownMode" class="flex h-full overflow-hidden">
          <!-- TOC Sidebar -->
          <aside
            v-show="tocVisible"
            class="toc-sidebar"
          >
            <div class="toc-header">
              <span class="toc-title">目录</span>
              <button class="toc-close-btn" @click="tocVisible = false">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
            </div>
            <nav class="toc-nav">
              <a
                v-for="item in tocItems"
                :key="item.id"
                :href="'#' + item.id"
                class="toc-item"
                :class="[
                  `toc-level-${item.level}`,
                  { 'toc-active': activeHeadingId === item.id }
                ]"
                @click.prevent="scrollToHeading(item.id)"
              >
                {{ item.text }}
              </a>
            </nav>
          </aside>

          <!-- TOC Toggle Button (when collapsed) -->
          <button
            v-show="!tocVisible && tocItems.length > 0"
            class="toc-toggle-btn"
            @click="tocVisible = true"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            <span class="ml-1 text-xs">目录</span>
          </button>

          <!-- Content -->
          <div
            ref="markdownContainer"
            class="markdown-page-content flex-1 h-full overflow-auto p-6 md:p-10"
            v-html="renderedHtml"
            @scroll="onContentScroll"
          ></div>
        </div>

        <div v-else-if="isOfficialStatusPage" class="official-status-shell">
          <div class="official-status-page-head">
            <div class="official-status-brand">
              <span class="official-status-brand-mark">OpenAI</span>
              <p class="official-status-brand-caption">{{ t('customPage.officialStatus.subtitle') }}</p>
            </div>
            <div class="official-status-actions">
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                :disabled="officialStatusLoading"
                @click="refreshOfficialStatus()"
              >
                <Icon name="refresh" size="sm" class="mr-1.5" :stroke-width="2" />
                {{ t('customPage.officialStatus.refresh') }}
              </button>
              <a
                :href="menuItem?.url || 'https://status.openai.com/'"
                target="_blank"
                rel="noopener noreferrer"
                class="official-status-primary-link"
              >
                {{ t('customPage.openInNewTab') }}
              </a>
            </div>
          </div>

          <div v-if="officialStatusLoading && !officialStatusSummary" class="flex flex-1 items-center justify-center py-12">
            <div
              class="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"
            ></div>
          </div>

          <div v-else-if="officialStatusError && !officialStatusSummary" class="official-status-empty">
            <div class="official-status-empty-icon">
              <Icon name="exclamationTriangle" size="lg" class="text-amber-500" />
            </div>
            <h3>{{ t('customPage.officialStatus.loadFailedTitle') }}</h3>
            <p>{{ officialStatusError }}</p>
          </div>

          <div v-else-if="officialStatusSummary" class="official-status-content">
            <div class="official-status-banner" :class="officialStatusBannerClass">
              <div class="official-status-banner-head">
                <div class="official-status-banner-title">
                  <span class="official-status-banner-icon" :class="officialStatusBadgeClass">
                    <Icon name="check" size="sm" :stroke-width="2.4" />
                  </span>
                  <strong>{{ overallStatusHeadline }}</strong>
                </div>
                <span class="official-status-banner-meta">
                  {{ t('customPage.officialStatus.lastUpdated', { time: formattedOfficialStatusUpdatedAt }) }}
                </span>
              </div>
              <div class="official-status-banner-body">
                {{ overallStatusBody }}
              </div>
            </div>

            <div class="official-status-panel">
              <div class="official-status-panel-head">
                <div>
                  <h3>{{ t('customPage.officialStatus.servicesSection') }}</h3>
                  <p>{{ t('customPage.officialStatus.samplingHint') }}</p>
                </div>
                <span class="official-status-section-count">
                  {{ t('customPage.officialStatus.groupCount', { count: groupedOfficialComponents.length }) }}
                </span>
              </div>

              <div class="official-group-list">
                <article
                  v-for="group in groupedOfficialComponents"
                  :key="group.id"
                  class="official-group-row"
                >
                  <div class="official-group-topline">
                    <div class="official-group-meta">
                      <span class="official-group-icon" :class="componentStatusClass(group.worstStatus)">
                        <Icon name="check" size="xs" :stroke-width="2.6" />
                      </span>
                      <div class="official-group-title-row">
                        <h4>{{ group.name }}</h4>
                        <span v-if="group.description" class="official-group-description">
                          {{ group.description }}
                        </span>
                      </div>
                    </div>
                    <div class="official-group-stats">
                      <span class="official-group-summary">{{ summarizeGroupStatus(group.components) }}</span>
                      <span class="official-group-uptime" :class="uptimeClass(group.id)">{{ groupUptime(group.id) }}% uptime</span>
                    </div>
                  </div>

                  <div class="official-group-pills" :aria-label="`${group.name} status history`">
                    <div
                      v-for="(status, index) in groupHistoryStatuses(group.id)"
                      :key="`${group.id}-${index}`"
                      class="official-group-pill"
                      :class="historyBarClass(status)"
                      :title="groupHistoryTitle(status)"
                    ></div>
                  </div>
                </article>
              </div>
            </div>

            <div v-if="activeIncidents.length > 0" class="official-status-panel">
              <div class="official-status-panel-head">
                <div>
                  <h3>{{ t('customPage.officialStatus.activeIncidentsSection') }}</h3>
                  <p>{{ t('customPage.officialStatus.activeIncidentsHint') }}</p>
                </div>
                <span class="official-status-section-count">{{ activeIncidents.length }}</span>
              </div>
              <div class="official-incident-list">
                <article
                  v-for="incident in activeIncidents"
                  :key="incident.id"
                  class="official-incident-card"
                >
                  <div class="official-incident-topline">
                    <h4>{{ incident.name }}</h4>
                    <span class="official-status-chip official-status-chip-incident">{{ formatIncidentStatus(incident.status) }}</span>
                  </div>
                  <p class="official-incident-meta">
                    {{ formatIncidentImpact(incident.impact) }}
                    <span v-if="incident.updated_at"> · {{ formatDateTime(incident.updated_at) }}</span>
                  </p>
                  <a
                    v-if="incident.shortlink"
                    :href="incident.shortlink"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="official-status-link"
                  >
                    {{ t('customPage.officialStatus.viewIncident') }}
                  </a>
                </article>
              </div>
            </div>
          </div>
        </div>

        <!-- URL not configured -->
        <div v-else-if="!isValidUrl" class="flex h-full items-center justify-center p-10 text-center">
          <div class="max-w-md">
            <div
              class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-dark-700"
            >
              <Icon name="link" size="lg" class="text-gray-400" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('customPage.notConfiguredTitle') }}
            </h3>
            <p class="mt-2 text-sm text-gray-500 dark:text-dark-400">
              {{ t('customPage.notConfiguredDesc') }}
            </p>
          </div>
        </div>

        <!-- Iframe embed mode -->
        <div v-else class="custom-embed-shell">
          <a
            :href="embeddedUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-secondary btn-sm custom-open-fab"
          >
            <Icon name="externalLink" size="sm" class="mr-1.5" :stroke-width="2" />
            {{ t('customPage.openInNewTab') }}
          </a>
          <iframe
            :src="embeddedUrl"
            class="custom-embed-frame"
            allowfullscreen
          ></iframe>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import { useAdminSettingsStore } from '@/stores/adminSettings'
import AppLayout from '@/components/layout/AppLayout.vue'
import Icon from '@/components/icons/Icon.vue'
import { buildEmbeddedUrl, detectTheme } from '@/utils/embedded-url'
import {
  appendOpenAIStatusHistory,
  aggregateOpenAIStatusGroups,
  computeOpenAIGroupUptime,
  fetchOpenAIStatusSummary,
  getWorstStatus,
  getOpenAIGroupHistoryStatuses,
  OPENAI_STATUS_HISTORY_INTERVAL_MS,
  OPENAI_STATUS_HISTORY_MAX_ENTRIES,
  readOpenAIStatusHistory,
  isOfficialStatusMenuItem,
  type OpenAIStatusHistoryEntry,
  type OpenAIStatusSummary,
} from '@/utils/openaiStatus'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

interface TocItem {
  id: string
  text: string
  level: number
}

const { t, locale } = useI18n()
const route = useRoute()
const appStore = useAppStore()
const authStore = useAuthStore()
const adminSettingsStore = useAdminSettingsStore()

const loading = ref(false)
const pageTheme = ref<'light' | 'dark'>('light')
const renderedHtml = ref('')
const markdownContainer = ref<HTMLElement | null>(null)
const tocItems = ref<TocItem[]>([])
const tocVisible = ref(typeof window !== 'undefined' ? window.innerWidth > 768 : true)
const activeHeadingId = ref('')
const officialStatusSummary = ref<OpenAIStatusSummary | null>(null)
const officialStatusHistory = ref<OpenAIStatusHistoryEntry[]>([])
const officialStatusLoading = ref(false)
const officialStatusError = ref('')
let themeObserver: MutationObserver | null = null
let officialStatusAbortController: AbortController | null = null
let officialStatusRefreshTimer: number | null = null

const menuItemId = computed(() => route.params.id as string)

const menuItem = computed(() => {
  const id = menuItemId.value
  const publicItems = appStore.cachedPublicSettings?.custom_menu_items ?? []
  const found = publicItems.find((item) => item.id === id) ?? null
  if (found) return found
  if (authStore.isAdmin) {
    return adminSettingsStore.customMenuItems.find((item) => item.id === id) ?? null
  }
  return null
})

const markdownSlug = computed(() => {
  const item = menuItem.value
  if (!item) return ''
  if (item.page_slug) return item.page_slug
  if (item.url?.startsWith('md:')) return item.url.slice(3)
  return ''
})

const isMarkdownMode = computed(() => !!markdownSlug.value)
const isOfficialStatusPage = computed(() => isOfficialStatusMenuItem(menuItem.value))

const embeddedUrl = computed(() => {
  if (!menuItem.value || isMarkdownMode.value || isOfficialStatusPage.value) return ''
  return buildEmbeddedUrl(
    menuItem.value.url,
    authStore.user?.id,
    authStore.token,
    pageTheme.value,
    locale.value,
  )
})

const isValidUrl = computed(() => {
  if (isMarkdownMode.value || isOfficialStatusPage.value) return false
  const url = embeddedUrl.value
  return url.startsWith('http://') || url.startsWith('https://')
})

const activeIncidents = computed(() =>
  (officialStatusSummary.value?.incidents ?? []).filter((incident) => incident.status !== 'resolved')
)

const activeIncidentCount = computed(() => activeIncidents.value.length)
const groupedOfficialComponents = computed(() => aggregateOpenAIStatusGroups(officialStatusSummary.value))
const nonOperationalComponentCount = computed(() =>
  groupedOfficialComponents.value.filter((group) => group.worstStatus !== 'operational').length
)

const formattedOfficialStatusUpdatedAt = computed(() => {
  const updatedAt = officialStatusSummary.value?.page.updated_at
  if (!updatedAt) return '--'
  return formatDateTime(updatedAt)
})

const officialStatusBadgeClass = computed(() => statusIndicatorClass(officialStatusSummary.value?.status.indicator))
const officialStatusBannerClass = computed(() => {
  return nonOperationalComponentCount.value === 0 && activeIncidentCount.value === 0
    ? 'official-status-banner-operational'
    : 'official-status-banner-degraded'
})
const overallStatusHeadline = computed(() => {
  if (nonOperationalComponentCount.value === 0 && activeIncidentCount.value === 0) {
    return t('customPage.officialStatus.fullyOperational')
  }
  return officialStatusSummary.value?.status.description || t('customPage.officialStatus.degradedHeadline')
})
const overallStatusBody = computed(() => {
  if (activeIncidentCount.value > 0) {
    return t('customPage.officialStatus.activeIncidentSummary', {
      incidents: activeIncidentCount.value,
      services: nonOperationalComponentCount.value,
    })
  }
  if (nonOperationalComponentCount.value > 0) {
    return t('customPage.officialStatus.degradedSummary', {
      services: nonOperationalComponentCount.value,
    })
  }
  return t('customPage.officialStatus.noIssues')
})

function generateHeadingId(text: string, index: number): string {
  const base = text
    .toLowerCase()
    .replace(/[^\w一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base ? `${base}-${index}` : `heading-${index}`
}

function isRelativeMarkdownAsset(src: string): boolean {
  const trimmed = src.trim()
  if (!trimmed || /^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith('//') || trimmed.startsWith('/')) {
    return false
  }
  const [pathPart] = trimmed.split(/([?#].*)/, 2)
  return pathPart
    .split('/')
    .filter((part) => part && part !== '.')
    .every((part) => part !== '..' && !part.includes('\\'))
}

function buildPageImageUrl(slug: string, src: string): string {
  const trimmed = src.trim()
  const [pathPart, suffix = ''] = trimmed.split(/([?#].*)/, 2)
  const encodedPath = pathPart
    .split('/')
    .filter((part) => part && part !== '.')
    .map((part) => encodeURIComponent(part))
    .join('/')
  return `/api/v1/pages/${encodeURIComponent(slug)}/images/${encodedPath}${suffix}`
}

async function fetchAndRenderMarkdown(slug: string) {
  loading.value = true
  tocItems.value = []
  activeHeadingId.value = ''
  try {
    const resp = await fetch(`/api/v1/pages/${encodeURIComponent(slug)}`, {
      headers: authStore.token ? { Authorization: `Bearer ${authStore.token}` } : {},
    })
    if (!resp.ok) {
      renderedHtml.value = '<p class="text-red-500">Page not found</p>'
      return
    }
    let raw = await resp.text()

    raw = raw.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (match, alt, src) => isRelativeMarkdownAsset(src) ? `![${alt}](${buildPageImageUrl(slug, src)})` : match
    )

    const html = marked.parse(raw) as string
    const sanitized = DOMPurify.sanitize(html, {
      ADD_TAGS: ['iframe'],
      ADD_ATTR: ['allowfullscreen', 'frameborder', 'src'],
    })

    // Inject IDs into headings and build TOC
    const toc: TocItem[] = []
    let headingIndex = 0
    const withIds = sanitized.replace(
      /<(h[1-4])[^>]*>(.*?)<\/h[1-4]>/gi,
      (_, tag: string, content: string) => {
        const level = parseInt(tag[1])
        const text = content.replace(/<[^>]+>/g, '').trim()
        const id = generateHeadingId(text, headingIndex++)
        toc.push({ id, text, level })
        return `<${tag} id="${id}">${content}</${tag}>`
      }
    )

    renderedHtml.value = withIds
    tocItems.value = toc
  } catch {
    renderedHtml.value = '<p class="text-red-500">Failed to load page</p>'
  } finally {
    loading.value = false
    await nextTick()
    await nextTick()
    injectCopyButtons()
  }
}

function clearOfficialStatusTimer() {
  if (officialStatusRefreshTimer !== null) {
    window.clearInterval(officialStatusRefreshTimer)
    officialStatusRefreshTimer = null
  }
}

function stopOfficialStatusFetch() {
  officialStatusAbortController?.abort()
  officialStatusAbortController = null
}

async function refreshOfficialStatus() {
  if (!isOfficialStatusPage.value) return
  stopOfficialStatusFetch()
  officialStatusAbortController = new AbortController()
  officialStatusLoading.value = true
  officialStatusError.value = ''

  try {
    officialStatusSummary.value = await fetchOpenAIStatusSummary(officialStatusAbortController.signal)
    officialStatusHistory.value = appendOpenAIStatusHistory(
      officialStatusSummary.value,
      Date.now(),
      typeof window !== 'undefined' ? window.localStorage : undefined,
    )
  } catch (error) {
    if ((error as Error).name === 'AbortError') return
    officialStatusError.value = t('customPage.officialStatus.loadFailedDesc')
  } finally {
    officialStatusLoading.value = false
  }
}

function ensureOfficialStatusRefresh() {
  clearOfficialStatusTimer()
  if (!isOfficialStatusPage.value || typeof window === 'undefined') return
  officialStatusRefreshTimer = window.setInterval(() => {
    void refreshOfficialStatus()
  }, OPENAI_STATUS_HISTORY_INTERVAL_MS)
}

function formatDateTime(value?: string): string {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale.value === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatComponentStatus(status: string): string {
  const key = `customPage.officialStatus.componentStatus.${status}`
  const translated = t(key)
  return translated === key ? status : translated
}

function formatIncidentStatus(status: string): string {
  const key = `customPage.officialStatus.incidentStatus.${status}`
  const translated = t(key)
  return translated === key ? status : translated
}

function formatIncidentImpact(impact?: string): string {
  if (!impact) return t('customPage.officialStatus.impactUnknown')
  const key = `customPage.officialStatus.impact.${impact}`
  const translated = t(key)
  return translated === key ? impact : translated
}

function componentStatusClass(status: string): string {
  return statusIndicatorClass(status)
}

function summarizeGroupStatus(components: Array<{ status: string }>): string {
  const worstStatus = aggregateGroupWorstStatus(components)
  return formatComponentStatus(worstStatus)
}

function aggregateGroupWorstStatus(components: Array<{ status: string }>): string {
  return getWorstStatus(components.map((component) => component.status))
}

function groupUptime(groupId: string): string {
  const visibleHistory = officialStatusHistory.value.slice(-OPENAI_STATUS_HISTORY_MAX_ENTRIES)
  const uptime = computeOpenAIGroupUptime(visibleHistory, groupId)
  if (uptime === null) return '--'
  return uptime.toFixed(2)
}

function groupHistoryStatuses(groupId: string): string[] {
  const statuses = getOpenAIGroupHistoryStatuses(
    officialStatusHistory.value,
    groupId,
    OPENAI_STATUS_HISTORY_MAX_ENTRIES,
  )
  const padCount = Math.max(0, OPENAI_STATUS_HISTORY_MAX_ENTRIES - statuses.length)
  return [
    ...Array.from({ length: padCount }, () => 'empty'),
    ...statuses,
  ]
}

function groupHistoryTitle(status: string): string {
  return formatComponentStatus(status)
}

function historyBarClass(status: string): string {
  switch (status) {
    case 'operational':
    case 'none':
      return 'official-history-bar-ok'
    case 'minor':
    case 'degraded_performance':
      return 'official-history-bar-warn'
    case 'major':
    case 'partial_outage':
    case 'under_maintenance':
      return 'official-history-bar-issue'
    case 'critical':
    case 'major_outage':
      return 'official-history-bar-critical'
    default:
      return 'official-history-bar-empty'
  }
}

function uptimeClass(groupId: string): string {
  const uptime = computeOpenAIGroupUptime(
    officialStatusHistory.value.slice(-OPENAI_STATUS_HISTORY_MAX_ENTRIES),
    groupId,
  )
  if (uptime === null) return 'official-uptime-empty'
  if (uptime >= 99.9) return 'official-uptime-ok'
  if (uptime >= 99) return 'official-uptime-warn'
  return 'official-uptime-critical'
}

function statusIndicatorClass(indicator?: string): string {
  switch (indicator) {
    case 'none':
    case 'operational':
      return 'official-status-chip-ok'
    case 'minor':
    case 'degraded_performance':
      return 'official-status-chip-warn'
    case 'major':
    case 'partial_outage':
    case 'under_maintenance':
      return 'official-status-chip-issue'
    case 'critical':
    case 'major_outage':
      return 'official-status-chip-critical'
    default:
      return 'official-status-chip-neutral'
  }
}

function scrollToHeading(id: string) {
  const container = markdownContainer.value
  if (!container) return
  const el = container.querySelector(`#${CSS.escape(id)}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    activeHeadingId.value = id
    if (window.innerWidth <= 640) {
      tocVisible.value = false
    }
  }
}

let scrollRafId = 0
function onContentScroll() {
  if (scrollRafId) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = 0
    const container = markdownContainer.value
    if (!container || tocItems.value.length === 0) return

    const containerRect = container.getBoundingClientRect()
    let current = ''

    for (const item of tocItems.value) {
      const el = container.querySelector(`#${CSS.escape(item.id)}`) as HTMLElement | null
      if (el) {
        const elRect = el.getBoundingClientRect()
        if (elRect.top - containerRect.top <= 100) {
          current = item.id
        }
      }
    }
    activeHeadingId.value = current
  })
}

function injectCopyButtons() {
  const container = markdownContainer.value
  if (!container) return

  container.querySelectorAll('pre').forEach((pre) => {
    if (pre.querySelector('.copy-btn')) return
    const btn = document.createElement('button')
    btn.className = 'copy-btn'
    btn.textContent = '复制'
    btn.addEventListener('click', async () => {
      const code = pre.querySelector('code')?.textContent ?? pre.textContent ?? ''
      try {
        await navigator.clipboard.writeText(code)
        btn.textContent = '已复制 ✓'
        setTimeout(() => { btn.textContent = '复制' }, 2000)
      } catch {
        btn.textContent = '失败'
        setTimeout(() => { btn.textContent = '复制' }, 2000)
      }
    })
    pre.style.position = 'relative'
    pre.appendChild(btn)
  })
}

watch(markdownSlug, (slug) => {
  if (slug) {
    fetchAndRenderMarkdown(slug)
  } else {
    renderedHtml.value = ''
    tocItems.value = []
  }
}, { immediate: true })

watch(isOfficialStatusPage, (enabled) => {
  if (!enabled) {
    officialStatusSummary.value = null
    officialStatusHistory.value = []
    officialStatusError.value = ''
    stopOfficialStatusFetch()
    clearOfficialStatusTimer()
    return
  }
  void refreshOfficialStatus()
  ensureOfficialStatusRefresh()
}, { immediate: true })

onMounted(async () => {
  pageTheme.value = detectTheme()
  if (typeof window !== 'undefined') {
    officialStatusHistory.value = readOpenAIStatusHistory(window.localStorage)
  }

  if (typeof document !== 'undefined') {
    themeObserver = new MutationObserver(() => {
      pageTheme.value = detectTheme()
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
  }

  if (appStore.publicSettingsLoaded) return
  loading.value = true
  try {
    await appStore.fetchPublicSettings()
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  if (themeObserver) {
    themeObserver.disconnect()
    themeObserver = null
  }
  stopOfficialStatusFetch()
  clearOfficialStatusTimer()
})
</script>

<style scoped>
.custom-page-layout {
  @apply flex flex-col;
  height: calc(100vh - 64px - 4rem);
}

.toc-sidebar {
  @apply flex flex-col h-full border-r border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-800;
  width: min(240px, 30%);
  min-width: 160px;
  max-width: 280px;
  overflow: hidden;
}

@media (max-width: 640px) {
  .toc-sidebar {
    position: absolute;
    left: 0;
    top: 0;
    z-index: 20;
    width: 70%;
    max-width: 240px;
    height: 100%;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  }
}

.toc-header {
  @apply flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-600;
}

.toc-title {
  @apply text-sm font-semibold text-gray-700 dark:text-dark-200;
}

.toc-close-btn {
  @apply p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-dark-200 hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors;
}

.toc-nav {
  @apply flex-1 overflow-y-auto py-2 px-2;
}

.toc-item {
  @apply block px-2 py-1.5 text-sm rounded transition-colors truncate;
  @apply text-gray-600 dark:text-dark-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-dark-600;
}

.toc-item.toc-active {
  @apply text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 font-medium;
}

.toc-level-1 { padding-left: 8px; }
.toc-level-2 { padding-left: 20px; }
.toc-level-3 { padding-left: 32px; }
.toc-level-4 { padding-left: 44px; }

.toc-toggle-btn {
  @apply absolute left-2 top-2 z-10 flex items-center px-2 py-1.5 rounded-md text-sm;
  @apply bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-500;
  @apply text-gray-600 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-600;
  @apply shadow-sm transition-colors cursor-pointer;
}

.custom-embed-shell {
  @apply relative;
  @apply h-full w-full overflow-hidden rounded-2xl;
  @apply bg-gradient-to-b from-gray-50 to-white dark:from-dark-900 dark:to-dark-950;
  @apply p-0;
}

.custom-open-fab {
  @apply absolute right-3 top-3 z-10;
  @apply shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:supports-[backdrop-filter]:bg-dark-800/80;
}

.custom-embed-frame {
  display: block;
  margin: 0;
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}

.official-status-shell {
  @apply flex h-full flex-col gap-6 overflow-auto p-6 md:p-7;
  @apply bg-[#fbfbf8] text-[#111827] dark:bg-[#0f1720] dark:text-white;
}

.official-status-page-head {
  @apply flex flex-col gap-4 md:flex-row md:items-start md:justify-between;
}

.official-status-brand-mark {
  @apply text-[2rem] font-semibold tracking-tight text-[#111827] dark:text-white;
}

.official-status-brand-caption {
  @apply mt-2 text-sm text-gray-500 dark:text-dark-300;
}

.official-status-actions {
  @apply flex flex-wrap items-center gap-2;
}

.official-status-primary-link {
  @apply inline-flex items-center rounded-xl bg-[#2d2d34] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1f1f25];
}

.official-status-content {
  @apply flex flex-col gap-6;
}

.official-status-banner {
  @apply overflow-hidden rounded-2xl border shadow-sm;
}

.official-status-banner-operational {
  @apply border-emerald-400/80 bg-white dark:bg-dark-900;
}

.official-status-banner-degraded {
  @apply border-amber-400/80 bg-white dark:bg-dark-900;
}

.official-status-banner-head {
  @apply flex flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between;
}

.official-status-banner-operational .official-status-banner-head {
  @apply bg-emerald-100/80 dark:bg-emerald-500/15;
}

.official-status-banner-degraded .official-status-banner-head {
  @apply bg-amber-100/80 dark:bg-amber-500/15;
}

.official-status-banner-title {
  @apply flex items-center gap-3 text-2xl font-semibold text-[#111827] dark:text-white;
}

.official-status-banner-meta {
  @apply text-sm text-gray-500 dark:text-dark-300;
}

.official-status-banner-icon {
  @apply inline-flex h-8 w-8 items-center justify-center rounded-full;
}

.official-status-banner-body {
  @apply px-6 py-5 text-lg text-[#111827] dark:text-dark-100;
}

.official-status-badge,
.official-status-chip {
  @apply inline-flex items-center rounded-full px-3 py-1 text-sm font-medium;
}

.official-status-chip-ok {
  @apply bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300;
}

.official-status-chip-warn {
  @apply bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300;
}

.official-status-chip-issue {
  @apply bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300;
}

.official-status-chip-critical {
  @apply bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300;
}

.official-status-chip-neutral {
  @apply bg-gray-100 text-gray-700 dark:bg-dark-700 dark:text-dark-200;
}

.official-status-chip-incident {
  @apply bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300;
}

.official-status-panel {
  @apply overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-dark-600 dark:bg-dark-900;
}

.official-status-panel-head {
  @apply flex flex-col gap-2 border-b border-gray-200 px-6 py-5 md:flex-row md:items-center md:justify-between dark:border-dark-700;
}

.official-status-panel-head h3 {
  @apply text-[1.8rem] font-semibold leading-none text-[#111827] dark:text-white;
}

.official-status-panel-head p {
  @apply mt-2 text-sm text-gray-400 dark:text-dark-400;
}

.official-status-section-count {
  @apply rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-dark-700 dark:text-dark-300;
}

.official-group-list {
  @apply divide-y divide-gray-100 dark:divide-dark-700;
}

.official-group-row {
  @apply px-6 py-5;
}

.official-group-topline,
.official-incident-topline {
  @apply flex items-start justify-between gap-3;
}

.official-group-meta {
  @apply flex min-w-0 items-start gap-3;
}

.official-group-icon {
  @apply mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full;
}

.official-group-title-row {
  @apply flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1;
}

.official-group-title-row h4 {
  @apply text-[1.05rem] font-semibold text-[#111827] dark:text-white;
}

.official-group-components,
.official-group-description,
.official-group-summary {
  @apply text-sm text-gray-400 dark:text-dark-400;
}

.official-group-stats {
  @apply flex flex-col items-end gap-1;
}

.official-group-uptime {
  @apply text-[1.05rem] font-medium text-gray-500 dark:text-dark-300;
}

.official-uptime-ok {
  @apply text-emerald-500 dark:text-emerald-400;
}

.official-uptime-warn {
  @apply text-amber-500 dark:text-amber-400;
}

.official-uptime-critical {
  @apply text-red-500 dark:text-red-400;
}

.official-uptime-empty {
  @apply text-gray-500 dark:text-dark-300;
}

.official-group-pills {
  @apply mt-4 flex flex-wrap gap-[4px];
}

.official-group-pill {
  @apply h-6 w-[7px] rounded-[2px];
}

.official-history-bar-ok {
  @apply bg-emerald-500;
}

.official-history-bar-warn {
  @apply bg-amber-500;
}

.official-history-bar-issue {
  @apply bg-orange-500;
}

.official-history-bar-critical {
  @apply bg-red-500;
}

.official-history-bar-empty {
  @apply bg-gray-600 dark:bg-dark-600;
}

.official-incident-list {
  @apply grid gap-3 p-4 md:grid-cols-2;
}

.official-incident-card {
  @apply rounded-2xl border border-gray-200/80 bg-gray-50/80 p-4;
  @apply dark:border-dark-600 dark:bg-dark-800/75;
}

.official-incident-topline h4 {
  @apply text-sm font-semibold text-gray-900 dark:text-white;
}

.official-incident-meta {
  @apply mt-2 text-sm text-gray-500 dark:text-dark-400;
}

.official-status-link {
  @apply mt-3 inline-flex text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400;
}

.official-status-empty {
  @apply flex flex-1 flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 px-6 py-12 text-center;
  @apply dark:border-dark-600;
}

.official-status-empty-icon {
  @apply mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10;
}
</style>

<style>
.markdown-page-content {
  line-height: 1.7;
  color: inherit;
}
.markdown-page-content h1 { @apply text-3xl font-bold mt-8 mb-4 pb-2 border-b border-gray-200 dark:border-dark-600; }
.markdown-page-content h2 { @apply text-2xl font-bold mt-6 mb-3; }
.markdown-page-content h3 { @apply text-xl font-semibold mt-5 mb-2; }
.markdown-page-content h4 { @apply text-lg font-semibold mt-4 mb-2; }
.markdown-page-content p { @apply mb-4; }
.markdown-page-content ul { @apply list-disc pl-6 mb-4; }
.markdown-page-content ol { @apply list-decimal pl-6 mb-4; }
.markdown-page-content li { @apply mb-1; }
.markdown-page-content a { @apply text-primary-500 hover:text-primary-600 underline; }
.markdown-page-content blockquote { @apply border-l-4 border-gray-300 dark:border-dark-500 pl-4 italic text-gray-600 dark:text-dark-300 my-4; }
.markdown-page-content img { @apply max-w-full h-auto rounded-lg my-4; }
.markdown-page-content table { @apply w-full border-collapse my-4; }
.markdown-page-content th { @apply border border-gray-300 dark:border-dark-500 px-3 py-2 bg-gray-50 dark:bg-dark-700 font-semibold text-left; }
.markdown-page-content td { @apply border border-gray-300 dark:border-dark-500 px-3 py-2; }
.markdown-page-content code { @apply bg-gray-100 dark:bg-dark-700 px-1.5 py-0.5 rounded text-sm font-mono; }
.markdown-page-content pre { @apply bg-gray-900 dark:bg-dark-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4 relative; }
.markdown-page-content pre code { @apply bg-transparent p-0 text-inherit; }
.markdown-page-content hr { @apply my-6 border-gray-200 dark:border-dark-600; }

.copy-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.15);
  color: #e2e8f0;
  border: 1px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s, background 0.2s;
  font-family: inherit;
}
.copy-btn:hover { background: rgba(255, 255, 255, 0.25); }
pre:hover .copy-btn { opacity: 1; }
</style>
