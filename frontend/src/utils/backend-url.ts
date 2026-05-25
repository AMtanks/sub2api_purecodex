import { useAppStore } from '@/stores'

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function ensureLeadingSlash(value: string): string {
  if (!value) return '/'
  return value.startsWith('/') ? value : `/${value}`
}

export function getConfiguredAPIBaseURL(): string {
  const envValue = (import.meta.env.VITE_API_BASE_URL || '').trim()
  if (envValue) {
    return trimTrailingSlash(envValue)
  }

  try {
    const appStore = useAppStore()
    const storeValue = (appStore.apiBaseUrl || appStore.cachedPublicSettings?.api_base_url || '').trim()
    if (storeValue) {
      return trimTrailingSlash(storeValue)
    }
  } catch {
    // Store may be unavailable during isolated evaluation.
  }

  return '/api/v1'
}

export function getBackendOrigin(): string {
  const apiBase = getConfiguredAPIBaseURL()

  if (/^https?:\/\//i.test(apiBase)) {
    try {
      return new URL(apiBase).origin
    } catch {
      return trimTrailingSlash(apiBase).replace(/\/api\/v1$/i, '')
    }
  }

  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return ''
}

export function buildBackendURL(path: string): string {
  const normalizedPath = ensureLeadingSlash(path)
  const apiBase = getConfiguredAPIBaseURL()

  if (/^https?:\/\//i.test(apiBase)) {
    return `${getBackendOrigin()}${normalizedPath}`
  }

  return normalizedPath
}

export function buildBackendAPIURL(pathAfterApiV1: string): string {
  const normalizedPath = ensureLeadingSlash(pathAfterApiV1)
  return `${getConfiguredAPIBaseURL()}${normalizedPath}`
}
