<template>
  <canvas ref="canvas" class="darkveil-canvas" aria-hidden="true" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  hueShift?: number
  noiseIntensity?: number
  scanlineIntensity?: number
  speed?: number
  scanlineFrequency?: number
  warpAmount?: number
  resolutionScale?: number
}>(), {
  hueShift: 0,
  noiseIntensity: 0.08,
  scanlineIntensity: 0.1,
  speed: 0.45,
  scanlineFrequency: 0.8,
  warpAmount: 0.22,
  resolutionScale: 1
})

const canvas = ref<HTMLCanvasElement | null>(null)
let gl: WebGLRenderingContext | null = null
let program: WebGLProgram | null = null
let frame = 0
let startedAt = 0
let resizeObserver: ResizeObserver | null = null

const vertexSource = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const fragmentSource = `
precision mediump float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uHueShift;
uniform float uNoise;
uniform float uScan;
uniform float uScanFreq;
uniform float uWarp;

float rand(vec2 c) {
  return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 hueShift(vec3 color, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  mat3 weights = mat3(
    vec3(0.299, 0.587, 0.114),
    vec3(0.299, 0.587, 0.114),
    vec3(0.299, 0.587, 0.114)
  );
  mat3 phase = mat3(
    vec3(0.701, -0.587, -0.114),
    vec3(-0.299, 0.413, -0.114),
    vec3(-0.300, -0.588, 0.886)
  );
  mat3 rotation = mat3(
    vec3(0.168, 0.330, -0.497),
    vec3(-0.328, 0.035, 0.292),
    vec3(1.250, -1.050, -0.203)
  );
  return clamp(color * (weights + phase * c + rotation * s), 0.0, 1.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  vec2 centered = uv * 2.0 - 1.0;
  centered.x *= uResolution.x / max(uResolution.y, 1.0);
  centered += uWarp * vec2(
    sin(centered.y * 5.0 + uTime * 0.8),
    cos(centered.x * 4.0 - uTime * 0.7)
  ) * 0.08;

  float radius = length(centered);
  float veilA = sin(centered.x * 2.8 + centered.y * 3.4 + uTime);
  float veilB = cos(centered.x * 5.2 - centered.y * 2.1 - uTime * 1.25);
  float field = smoothstep(-1.0, 1.0, veilA + veilB - radius * 0.85);

  vec3 deep = vec3(0.015, 0.035, 0.045);
  vec3 teal = vec3(0.0, 0.55, 0.52);
  vec3 blue = vec3(0.08, 0.18, 0.42);
  vec3 color = mix(deep, teal, field * 0.48);
  color = mix(color, blue, smoothstep(0.1, 1.4, radius) * 0.42);

  float scan = sin(gl_FragCoord.y * uScanFreq) * 0.5 + 0.5;
  color *= 1.0 - scan * scan * uScan;
  color += (rand(gl_FragCoord.xy + uTime) - 0.5) * uNoise;
  color = hueShift(color, radians(uHueShift));

  gl_FragColor = vec4(color, 1.0);
}
`

function compileShader(type: number, source: string) {
  if (!gl) return null
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function createProgram() {
  if (!gl) return null
  const vertex = compileShader(gl.VERTEX_SHADER, vertexSource)
  const fragment = compileShader(gl.FRAGMENT_SHADER, fragmentSource)
  if (!vertex || !fragment) return null
  const nextProgram = gl.createProgram()
  if (!nextProgram) return null
  gl.attachShader(nextProgram, vertex)
  gl.attachShader(nextProgram, fragment)
  gl.linkProgram(nextProgram)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  return gl.getProgramParameter(nextProgram, gl.LINK_STATUS) ? nextProgram : null
}

function resize() {
  const target = canvas.value
  const parent = target?.parentElement
  if (!target || !parent || !gl) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2) * props.resolutionScale
  const width = Math.max(1, Math.floor(parent.clientWidth * dpr))
  const height = Math.max(1, Math.floor(parent.clientHeight * dpr))
  if (target.width !== width || target.height !== height) {
    target.width = width
    target.height = height
    gl.viewport(0, 0, width, height)
  }
}

function render() {
  if (!gl || !program || !canvas.value) return
  const time = ((performance.now() - startedAt) / 1000) * props.speed
  gl.useProgram(program)
  gl.uniform2f(gl.getUniformLocation(program, 'uResolution'), canvas.value.width, canvas.value.height)
  gl.uniform1f(gl.getUniformLocation(program, 'uTime'), time)
  gl.uniform1f(gl.getUniformLocation(program, 'uHueShift'), props.hueShift)
  gl.uniform1f(gl.getUniformLocation(program, 'uNoise'), props.noiseIntensity)
  gl.uniform1f(gl.getUniformLocation(program, 'uScan'), props.scanlineIntensity)
  gl.uniform1f(gl.getUniformLocation(program, 'uScanFreq'), props.scanlineFrequency)
  gl.uniform1f(gl.getUniformLocation(program, 'uWarp'), props.warpAmount)
  gl.drawArrays(gl.TRIANGLES, 0, 6)
  frame = requestAnimationFrame(render)
}

function init() {
  const target = canvas.value
  if (!target) return
  gl = target.getContext('webgl', { antialias: false, alpha: false })
  if (!gl) return

  program = createProgram()
  if (!program) return

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  )
  const position = gl.getAttribLocation(program, 'position')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

  resizeObserver = new ResizeObserver(resize)
  if (target.parentElement) resizeObserver.observe(target.parentElement)
  startedAt = performance.now()
  resize()
  render()
}

watch(() => props.resolutionScale, resize)

onMounted(init)

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  resizeObserver?.disconnect()
})
</script>

<style scoped>
.darkveil-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
