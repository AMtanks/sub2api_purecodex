<template>
  <span
    class="shiny-text"
    :class="[{ 'is-disabled': disabled, 'pause-on-hover': pauseOnHover }, className]"
    :style="styleVars"
  >
    {{ text }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  text: string
  disabled?: boolean
  speed?: number
  className?: string
  color?: string
  shineColor?: string
  spread?: number
  yoyo?: boolean
  pauseOnHover?: boolean
  direction?: 'left' | 'right'
  delay?: number
}>(), {
  disabled: false,
  speed: 2,
  className: '',
  color: '#b5b5b5',
  shineColor: '#ffffff',
  spread: 120,
  yoyo: false,
  pauseOnHover: false,
  direction: 'left',
  delay: 0
})

const styleVars = computed(() => ({
  '--shine-color-base': props.color,
  '--shine-color-highlight': props.shineColor,
  '--shine-spread': `${props.spread}deg`,
  '--shine-duration': `${props.speed}s`,
  '--shine-delay': `${props.delay}s`,
  '--shine-direction': props.direction === 'left' ? 'normal' : 'reverse',
  '--shine-iteration-direction': props.yoyo ? 'alternate' : 'normal'
}))
</script>

<style scoped>
.shiny-text {
  display: inline-block;
  background-image: linear-gradient(
    var(--shine-spread),
    var(--shine-color-base) 0%,
    var(--shine-color-base) 35%,
    var(--shine-color-highlight) 50%,
    var(--shine-color-base) 65%,
    var(--shine-color-base) 100%
  );
  background-size: 220% auto;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: shiny-text-move var(--shine-duration) linear var(--shine-delay) infinite;
  animation-direction: var(--shine-direction);
}

.shiny-text:not(.is-disabled) {
  animation-direction: var(--shine-direction);
}

.shiny-text.is-disabled {
  animation: none;
}

.shiny-text.pause-on-hover:hover {
  animation-play-state: paused;
}

@keyframes shiny-text-move {
  from {
    background-position: 150% center;
  }
  to {
    background-position: -50% center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .shiny-text {
    animation: none;
  }
}
</style>
