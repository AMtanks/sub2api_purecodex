import { apiClient } from './client'

export interface PublicHomeUsageStats {
  window_hours: number
  total_tokens: number
  total_actual_cost: number
  tokens_per_cny: number
  tokens_per_cny_million: number
  updated_at: string
}

export async function getPublicHomeUsageStats(): Promise<PublicHomeUsageStats> {
  const { data } = await apiClient.get<PublicHomeUsageStats>('/public/home-usage')
  return data
}

export const homeAPI = {
  getPublicHomeUsageStats
}

export default homeAPI
