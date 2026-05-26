<template>
  <div v-if="homeContent" class="min-h-screen">
    <iframe
      v-if="isHomeContentUrl"
      :src="homeContent.trim()"
      class="h-screen w-full border-0"
      allowfullscreen
    ></iframe>
    <div v-else v-html="homeContent"></div>
  </div>

  <div v-else class="home-shell relative min-h-screen overflow-hidden bg-slate-950 text-white">
    <div class="absolute inset-0">
      <DarkVeil
        :hue-shift="14"
        :noise-intensity="0.075"
        :scanline-intensity="0.08"
        :scanline-frequency="0.7"
        :warp-amount="0.2"
        :speed="0.42"
      />
    </div>
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(20,184,166,0.18),transparent_32%),linear-gradient(180deg,rgba(2,6,23,0.3),rgba(2,6,23,0.96))]"></div>
    <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:72px_72px] opacity-35"></div>

    <header class="relative z-20 px-5 py-5 sm:px-8">
      <nav class="mx-auto flex max-w-7xl items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/10 shadow-2xl shadow-primary-500/20 backdrop-blur">
            <img :src="siteLogo || '/logo.png'" alt="Logo" class="h-8 w-8 object-contain" />
          </div>
          <div class="hidden leading-tight sm:block">
            <p class="text-sm font-semibold text-white">{{ siteName }}</p>
            <p class="text-xs text-teal-100/62">Sub2API Gateway</p>
          </div>
        </div>

        <div class="flex items-center gap-2 sm:gap-3">
          <LocaleSwitcher />
          <a
            v-if="docUrl"
            :href="docUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="home-icon-button"
            :title="t('home.viewDocs')"
          >
            <Icon name="book" size="md" />
          </a>
          <router-link :to="isAuthenticated ? dashboardPath : '/login'" class="home-login-link">
            <span v-if="isAuthenticated" class="home-login-avatar">{{ userInitial }}</span>
            <span>{{ isAuthenticated ? t('home.dashboard') : t('home.login') }}</span>
            <Icon name="arrowRight" size="sm" />
          </router-link>
        </div>
      </nav>
    </header>

    <main class="relative z-10 px-5 pb-14 pt-10 sm:px-8 lg:pb-20 lg:pt-14">
      <section class="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[minmax(0,1.02fr)_minmax(380px,0.78fr)] lg:gap-12">
        <div>
          <div class="mb-7 inline-flex items-center gap-2 border-b border-teal-300/35 pb-2 text-sm font-medium text-teal-100/85">
            <span class="h-1.5 w-1.5 rounded-full bg-teal-300 shadow-[0_0_18px_rgba(45,212,191,0.9)]"></span>
            以真实消耗定价的 AI API 网关
          </div>
          <h1 class="home-title">
            <span class="block">{{ siteName }}</span>
            <ShinyText
              text="便宜、高缓"
              color="#d8fff9"
              shine-color="#ffffff"
              :speed="2.8"
              :spread="115"
              class-name="block text-teal-95"
            />
          </h1>
          <p class="mt-7 max-w-2xl text-lg leading-9 text-slate-200/78 md:text-xl">
            <span class="text-white">PureCodex 把账号池、模型路由、计费扣减和接口兼容收束到同一条稳定链路。</span>
            让每一次请求被清楚记录、准确转发、高缓存率、按真实用量结算。
          </p>

          <div class="mt-6 inline-flex items-center gap-3 rounded-full border border-emerald-300/20 bg-white/6 px-4 py-2 text-sm text-emerald-100/92 backdrop-blur">
            <span class="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.95)]"></span>
            <span>约 ￥0.05 / 百万 tokens</span>
          </div>

          <div class="mt-9 flex flex-col gap-3 sm:flex-row">
            <router-link :to="isAuthenticated ? dashboardPath : '/login'" class="home-primary-cta">
              {{ isAuthenticated ? t('home.goToDashboard') : '立即接入' }}
              <Icon name="arrowRight" size="md" />
            </router-link>
            <a v-if="docUrl" :href="docUrl" target="_blank" rel="noopener noreferrer" class="home-secondary-cta">
              查看文档
              <Icon name="externalLink" size="sm" />
            </a>
          </div>

          <div class="mt-12 grid gap-4 sm:grid-cols-3">
            <div v-for="item in valueProps" :key="item.title" class="home-value-item">
              <Icon :name="item.icon" size="md" class="text-teal-200" />
              <h3>{{ item.title }}</h3>
              <p>{{ item.description }}</p>
            </div>
          </div>
        </div>

        <div class="lg:pl-4">
          <BorderGlow
            class-name="home-metric-frame"
            background-color="rgba(3, 22, 28, 0.88)"
            glow-color="176 86 62"
            :border-radius="26"
            :glow-radius="48"
            :glow-intensity="1.1"
            :animated="true"
            :colors="['#14b8a6', '#38bdf8', '#f59e0b']"
          >
            <div class="home-metric-panel">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <p class="text-sm font-medium text-teal-100/68">24h 费率估算</p>
                  <h2 class="mt-2 text-2xl font-semibold text-white">1元约等效</h2>
                </div>
                <div class="rounded-2xl border border-teal-300/20 bg-teal-300/10 p-3 text-teal-100">
                  <Icon name="bolt" size="lg" />
                </div>
              </div>

              <div class="mt-8">
                <div class="flex items-end gap-3">
                  <CountUp
                    :from="0"
                    :to="tokensPerCnyMillion"
                    :duration="1.6"
                    :separator="','"
                    class-name="home-token-number"
                  />
                  <span class="pb-3 text-2xl font-semibold text-teal-100/90">M tokens</span>
                </div>
                <p class="mt-3 text-sm text-slate-300/72">
                  基于后端近 24 小时总 Token 与实际扣费，每 1 分钟刷新一次。
                </p>
              </div>

              <div class="mt-7 flex items-center justify-between border-t border-white/10 pt-5 text-xs text-slate-300/68">
                <span>{{ statsStatusText }}</span>
                <span>Window {{ homeStats?.window_hours ?? 12 }}h</span>
              </div>
            </div>
          </BorderGlow>
        </div>
      </section>

      <section class="mx-auto mt-16 max-w-7xl lg:mt-20">
        <div class="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
          <div class="home-section-copy">
            <ShinyText
              text="已支持的 AI 模型"
              color="#8bded5"
              shine-color="#ffffff"
              :speed="3"
              :delay="0.4"
              :spread="125"
            />
            <h2>以 GPT-5.5 为首的高阶模型矩阵</h2>
            <p>主力模型优先调度，辅以轻量、编程与兼容场景模型，统一落到同一套 API 接入与计费链路。</p>
          </div>
          <div class="home-model-grid">
            <div v-for="model in supportedModels" :key="model.name" class="home-model-card" :class="{ primary: model.primary }">
              <span>{{ model.role }}</span>
              <strong>{{ model.name }}</strong>
              <p>{{ model.description }}</p>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer class="relative z-10 border-t border-white/10 px-5 py-7 sm:px-8">
      <div class="mx-auto flex max-w-7xl flex-col justify-between gap-3 text-sm text-slate-400 sm:flex-row">
        <span>&copy; {{ currentYear }} {{ siteName }}. {{ t('home.footer.allRightsReserved') }}</span>
        <a :href="githubUrl" target="_blank" rel="noopener noreferrer" class="transition-colors hover:text-white">GitHub</a>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore, useAppStore } from '@/stores'
import LocaleSwitcher from '@/components/common/LocaleSwitcher.vue'
import Icon from '@/components/icons/Icon.vue'
import ShinyText from '@/components/effects/ShinyText.vue'
import CountUp from '@/components/effects/CountUp.vue'
import DarkVeil from '@/components/effects/DarkVeil.vue'
import BorderGlow from '@/components/effects/BorderGlow.vue'
import { getPublicHomeUsageStats, type PublicHomeUsageStats } from '@/api/home'

const { t } = useI18n()

const authStore = useAuthStore()
const appStore = useAppStore()

const siteName = computed(() => appStore.cachedPublicSettings?.site_name || appStore.siteName || 'Sub2API')
const siteLogo = computed(() => appStore.cachedPublicSettings?.site_logo || appStore.siteLogo || '')
const docUrl = computed(() => appStore.cachedPublicSettings?.doc_url || appStore.docUrl || '')
const homeContent = computed(() => appStore.cachedPublicSettings?.home_content || '')

const isHomeContentUrl = computed(() => {
  const content = homeContent.value.trim()
  return content.startsWith('http://') || content.startsWith('https://')
})

const homeStats = ref<PublicHomeUsageStats | null>(null)
const statsError = ref(false)
let statsTimer: ReturnType<typeof setInterval> | null = null

const githubUrl = 'https://github.com/Wei-Shaw/sub2api'
const isAuthenticated = computed(() => authStore.isAuthenticated)
const isAdmin = computed(() => authStore.isAdmin)
const dashboardPath = computed(() => isAdmin.value ? '/admin/dashboard' : '/dashboard')
const userInitial = computed(() => {
  const user = authStore.user
  if (!user || !user.email) return ''
  return user.email.charAt(0).toUpperCase()
})
const currentYear = computed(() => new Date().getFullYear())

const valueProps = [
  {
    title: '永不掺水',
    description: '所有费用从后端真实 usage、Token 与扣费记录汇总，不用前端估算冒充账单口径。',
    icon: 'shield' as const
  },
  {
    title: '高缓存率',
    description: '缓存率高达99%，压缩上下文 Compact 也能缓存。',
    icon: 'link' as const
  },
  {
    title: '按量计费',
    description: '按请求实际消耗扣减余额或订阅额度，Token、成本、倍率和明细可追踪。',
    icon: 'dollar' as const
  }
]

const supportedModels = [
  {
    name: 'GPT-5.5',
    role: 'Primary',
    description: '主力高阶推理与生成模型，面向复杂任务优先调度。',
    primary: true
  },
  {
    name: 'GPT-5.4',
    role: 'Advanced',
    description: '稳定高质量输出，适合通用生产流量。',
    primary: false
  },
  {
    name: 'GPT-5.4-mini',
    role: 'Efficient',
    description: '更轻量的速度与成本平衡选项。',
    primary: false
  },
  {
    name: 'GPT-5.3-Codex',
    role: 'Code',
    description: '面向代码、Agent 与工程自动化场景。',
    primary: false
  }
]

const tokensPerCnyMillion = computed(() => {
  const baseTokensPerCnyMillion = homeStats.value?.tokens_per_cny_million ?? 0
  return Number((baseTokensPerCnyMillion * 11).toFixed(2))
})
const statsStatusText = computed(() => {
  if (statsError.value) return '统计暂不可用'
  if (!homeStats.value) return '正在读取后端统计'
  return `更新于 ${new Date(homeStats.value.updated_at).toLocaleTimeString()}`
})

async function refreshHomeStats() {
  try {
    homeStats.value = await getPublicHomeUsageStats()
    statsError.value = false
  } catch {
    statsError.value = true
  }
}

onMounted(() => {
  authStore.checkAuth()
  if (!appStore.publicSettingsLoaded) {
    appStore.fetchPublicSettings()
  }
  refreshHomeStats()
  statsTimer = setInterval(refreshHomeStats, 60 * 1000)
})

onBeforeUnmount(() => {
  if (statsTimer) clearInterval(statsTimer)
})
</script>

<style scoped>
.home-shell {
  letter-spacing: 0;
}

.home-icon-button {
  display: inline-flex;
  height: 2.5rem;
  width: 2.5rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid rgb(255 255 255 / 12%);
  background: rgb(255 255 255 / 7%);
  color: rgb(204 251 241 / 78%);
  backdrop-filter: blur(18px);
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
}

.home-icon-button:hover {
  border-color: rgb(94 234 212 / 42%);
  background: rgb(20 184 166 / 14%);
  color: white;
}

.home-login-link {
  display: inline-flex;
  min-height: 2.5rem;
  align-items: center;
  gap: 0.45rem;
  border-radius: 999px;
  border: 1px solid rgb(94 234 212 / 32%);
  background: rgb(8 47 73 / 46%);
  padding: 0.45rem 0.85rem;
  font-size: 0.82rem;
  font-weight: 700;
  color: white;
  box-shadow: 0 0 34px rgb(20 184 166 / 12%);
  backdrop-filter: blur(18px);
  transition: transform 0.2s ease, background 0.2s ease;
}

.home-login-link:hover {
  transform: translateY(-1px);
  background: rgb(13 148 136 / 26%);
}

.home-login-avatar {
  display: inline-flex;
  height: 1.35rem;
  width: 1.35rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: linear-gradient(135deg, #2dd4bf, #0ea5e9);
  font-size: 0.68rem;
}

.home-title {
  max-width: 760px;
  font-size: clamp(3.2rem, 8vw, 7.4rem);
  font-weight: 800;
  line-height: 0.95;
  color: white;
}

.home-primary-cta,
.home-secondary-cta {
  display: inline-flex;
  min-height: 3.25rem;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  border-radius: 999px;
  padding: 0.8rem 1.35rem;
  font-size: 0.95rem;
  font-weight: 800;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.home-primary-cta {
  background: linear-gradient(135deg, #14b8a6, #0ea5e9);
  color: white;
  box-shadow: 0 18px 54px rgb(20 184 166 / 28%);
}

.home-secondary-cta {
  border: 1px solid rgb(255 255 255 / 18%);
  background: rgb(255 255 255 / 7%);
  color: rgb(226 232 240 / 92%);
  backdrop-filter: blur(18px);
}

.home-primary-cta:hover,
.home-secondary-cta:hover {
  transform: translateY(-2px);
}

.home-value-item {
  min-height: 12.4rem;
  border-left: 1px solid rgb(94 234 212 / 32%);
  background: linear-gradient(90deg, rgb(20 184 166 / 12%), transparent);
  padding: 1.1rem 1.05rem;
}

.home-value-item h3 {
  margin-top: 1.15rem;
  font-size: 1.1rem;
  font-weight: 800;
  color: white;
}

.home-value-item p {
  margin-top: 0.75rem;
  font-size: 0.9rem;
  line-height: 1.75;
  color: rgb(203 213 225 / 74%);
}

.home-metric-panel {
  padding: 1.5rem;
}

.home-token-number {
  font-size: clamp(4rem, 9vw, 7rem);
  font-weight: 850;
  line-height: 0.9;
  color: white;
  text-shadow: 0 0 40px rgb(45 212 191 / 24%);
}

.home-section-copy h2 {
  margin-top: 1.2rem;
  max-width: 24rem;
  font-size: clamp(2rem, 4vw, 3.6rem);
  font-weight: 820;
  line-height: 1.02;
  color: white;
}

.home-section-copy p {
  margin-top: 1.2rem;
  max-width: 30rem;
  font-size: 1rem;
  line-height: 1.9;
  color: rgb(203 213 225 / 72%);
}

.home-model-grid {
  display: grid;
  gap: 1rem;
}

.home-model-card {
  min-height: 8.5rem;
  border: 1px solid rgb(255 255 255 / 10%);
  background: linear-gradient(135deg, rgb(15 23 42 / 62%), rgb(6 78 59 / 18%));
  padding: 1.15rem;
}

.home-model-card.primary {
  min-height: 10.5rem;
  border-color: rgb(94 234 212 / 38%);
  background:
    linear-gradient(135deg, rgb(20 184 166 / 28%), rgb(14 165 233 / 16%)),
    rgb(15 23 42 / 72%);
}

.home-model-card span {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  color: rgb(45 212 191 / 82%);
}

.home-model-card strong {
  display: block;
  margin-top: 0.55rem;
  font-size: clamp(1.45rem, 3vw, 2.5rem);
  color: white;
}

.home-model-card p {
  margin-top: 0.75rem;
  font-size: 0.9rem;
  line-height: 1.65;
  color: rgb(203 213 225 / 72%);
}

@media (min-width: 768px) {
  .home-model-grid {
    grid-template-columns: 1.2fr 1fr;
  }

  .home-model-card.primary {
    grid-row: span 2;
  }
}

@media (max-width: 640px) {
  .home-title {
    font-size: 3.4rem;
  }

  .home-metric-frame,
  .home-metric-panel {
    min-height: 0;
  }

  .home-metric-panel {
    padding: 1.15rem;
  }

  .home-token-number {
    font-size: 4.2rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-primary-cta,
  .home-secondary-cta,
  .home-login-link,
  .home-icon-button {
    transition: none;
  }
}
</style>
