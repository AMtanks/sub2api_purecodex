<template>
  <div
    ref="card"
    class="border-glow-card"
    :class="[className, { 'sweep-active': animated }]"
    :style="styleVars"
    @pointermove="handlePointerMove"
  >
    <span class="edge-light" />
    <div class="border-glow-inner">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{
  className?: string
  edgeSensitivity?: number
  glowColor?: string
  backgroundColor?: string
  borderRadius?: number
  glowRadius?: number
  glowIntensity?: number
  coneSpread?: number
  animated?: boolean
  colors?: string[]
  fillOpacity?: number
}>(), {
  className: '',
  edgeSensitivity: 30,
  glowColor: '176 86 58',
  backgroundColor: '#061A1F',
  borderRadius: 24,
  glowRadius: 36,
  glowIntensity: 1,
  coneSpread: 25,
  animated: false,
  colors: () => ['#14b8a6', '#38bdf8', '#f59e0b'],
  fillOpacity: 0.34
})

const card = ref<HTMLDivElement | null>(null)

const styleVars = computed(() => ({
  '--card-bg': props.backgroundColor,
  '--edge-sensitivity': props.edgeSensitivity,
  '--border-radius': `${props.borderRadius}px`,
  '--glow-padding': `${props.glowRadius}px`,
  '--cone-spread': props.coneSpread,
  '--fill-opacity': props.fillOpacity,
  '--glow-color': `hsl(${props.glowColor} / ${Math.min(100 * props.glowIntensity, 100)}%)`,
  '--gradient-one': props.colors[0],
  '--gradient-two': props.colors[1] ?? props.colors[0],
  '--gradient-three': props.colors[2] ?? props.colors[0]
}))

function handlePointerMove(event: PointerEvent) {
  const el = card.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const cx = rect.width / 2
  const cy = rect.height / 2
  const dx = x - cx
  const dy = y - cy
  const kx = dx === 0 ? Infinity : cx / Math.abs(dx)
  const ky = dy === 0 ? Infinity : cy / Math.abs(dy)
  const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1)
  let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90
  if (angle < 0) angle += 360
  el.style.setProperty('--edge-proximity', `${(edge * 100).toFixed(3)}`)
  el.style.setProperty('--cursor-angle', `${angle.toFixed(3)}deg`)
}
</script>

<style scoped>
.border-glow-card {
  --edge-proximity: 0;
  --cursor-angle: 45deg;
  --color-sensitivity: calc(var(--edge-sensitivity) + 20);

  position: relative;
  isolation: isolate;
  display: grid;
  overflow: visible;
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: var(--border-radius);
  background: var(--card-bg);
  box-shadow: 0 24px 80px rgb(0 0 0 / 28%);
  transform: translate3d(0, 0, 0.01px);
}

.border-glow-card::before,
.border-glow-card::after,
.edge-light {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  opacity: calc((var(--edge-proximity) - var(--edge-sensitivity)) / (100 - var(--edge-sensitivity)));
  transition: opacity 0.25s ease-out;
}

.border-glow-card::before {
  border: 1px solid transparent;
  background:
    linear-gradient(var(--card-bg) 0 100%) padding-box,
    radial-gradient(at 80% 55%, var(--gradient-one), transparent 50%) border-box,
    radial-gradient(at 12% 8%, var(--gradient-two), transparent 45%) border-box,
    radial-gradient(at 86% 18%, var(--gradient-three), transparent 45%) border-box;
  mask-image:
    conic-gradient(
      from var(--cursor-angle) at center,
      black calc(var(--cone-spread) * 1%),
      transparent calc((var(--cone-spread) + 15) * 1%),
      transparent calc((100 - var(--cone-spread) - 15) * 1%),
      black calc((100 - var(--cone-spread)) * 1%)
    );
}

.border-glow-card::after {
  background:
    radial-gradient(at 20% 16%, var(--gradient-one), transparent 46%),
    radial-gradient(at 80% 84%, var(--gradient-two), transparent 50%),
    radial-gradient(at 60% 24%, var(--gradient-three), transparent 48%);
  opacity: calc(var(--fill-opacity) * (var(--edge-proximity) - var(--color-sensitivity)) / (100 - var(--color-sensitivity)));
  mix-blend-mode: screen;
}

.edge-light {
  inset: calc(var(--glow-padding) * -1);
  pointer-events: none;
  z-index: 1;
  mask-image: conic-gradient(from var(--cursor-angle) at center, black 2.5%, transparent 10%, transparent 90%, black 97.5%);
}

.edge-light::before {
  content: "";
  position: absolute;
  inset: var(--glow-padding);
  border-radius: inherit;
  box-shadow:
    inset 0 0 0 1px var(--glow-color),
    inset 0 0 26px rgb(20 184 166 / 18%),
    0 0 34px rgb(20 184 166 / 16%),
    0 0 70px rgb(56 189 248 / 9%);
}

.border-glow-card:not(:hover):not(.sweep-active)::before,
.border-glow-card:not(:hover):not(.sweep-active)::after,
.border-glow-card:not(:hover):not(.sweep-active) > .edge-light {
  opacity: 0;
  transition: opacity 0.75s ease-in-out;
}

.border-glow-inner {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: inherit;
}
</style>
