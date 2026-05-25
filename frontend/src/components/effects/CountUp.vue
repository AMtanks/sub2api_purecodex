<template>
  <span ref="el" :class="className">{{ displayValue }}</span>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  to: number
  from?: number
  direction?: 'up' | 'down'
  delay?: number
  duration?: number
  className?: string
  startWhen?: boolean
  separator?: string
}>(), {
  from: 0,
  direction: 'up',
  delay: 0,
  duration: 2,
  className: '',
  startWhen: true,
  separator: ''
})

const el = ref<HTMLElement | null>(null)
const latest = ref(props.direction === 'down' ? props.to : props.from)
let frame = 0
let delayTimer: ReturnType<typeof setTimeout> | null = null
let observer: IntersectionObserver | null = null
let hasStarted = false

const decimalPlaces = computed(() => {
  const decimals = [props.from, props.to].map((value) => {
    const [, fraction = ''] = String(value).split('.')
    return Number(fraction) === 0 ? 0 : fraction.length
  })
  return Math.max(...decimals)
})

const displayValue = computed(() => {
  const formatted = new Intl.NumberFormat('en-US', {
    useGrouping: Boolean(props.separator),
    minimumFractionDigits: decimalPlaces.value,
    maximumFractionDigits: decimalPlaces.value
  }).format(latest.value)

  return props.separator ? formatted.replace(/,/g, props.separator) : formatted
})

function resetAnimation() {
  cancelAnimationFrame(frame)
  if (delayTimer) {
    clearTimeout(delayTimer)
    delayTimer = null
  }
}

function runAnimation() {
  resetAnimation()

  const start = props.direction === 'down' ? props.to : props.from
  const end = props.direction === 'down' ? props.from : props.to
  const durationMs = Math.max(props.duration, 0.01) * 1000
  latest.value = start

  delayTimer = setTimeout(() => {
    const startedAt = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / durationMs, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      latest.value = start + (end - start) * eased
      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        latest.value = end
      }
    }
    frame = requestAnimationFrame(tick)
  }, props.delay * 1000)
}

function maybeStart() {
  if (hasStarted || !props.startWhen) return
  hasStarted = true
  runAnimation()
}

onMounted(() => {
  if (!el.value) return

  observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      maybeStart()
      observer?.disconnect()
      observer = null
    }
  })
  observer.observe(el.value)
})

watch(() => [props.to, props.from, props.direction, props.startWhen] as const, () => {
  hasStarted = false
  maybeStart()
})

onBeforeUnmount(() => {
  resetAnimation()
  observer?.disconnect()
})
</script>
