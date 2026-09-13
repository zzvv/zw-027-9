<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useMetroStore } from '../store/metro'
import { GRID, LABEL_DIRS, lineLegs, segIntersection } from '../utils/geometry'

const store = useMetroStore()
const svgEl = ref(null)
const view = reactive({ x: 120, y: 60, scale: 1 })

const viewTransform = computed(() => `translate(${view.x} ${view.y}) scale(${view.scale})`)
const visibleLines = computed(() => store.visibleLines)

function stationsOf(line) {
  return line.stationIds.map((id) => store.stationById[id]).filter(Boolean)
}

const legsByLine = computed(() => {
  const map = {}
  for (const line of visibleLines.value) {
    map[line.id] = lineLegs(stationsOf(line))
  }
  return map
})

const stationViews = computed(() => {
  const views = []
  for (const st of store.stations) {
    const lines = (store.stationUsage[st.id] || []).filter((l) => l.visible)
    if (!lines.length) continue
    const colors = lines.map((l) => l.color)
    views.push({
      station: st,
      px: st.x * GRID,
      py: st.y * GRID,
      transfer: colors.length >= 2,
      colors,
      capsuleWidth: 12 + colors.length * 8,
      selected: store.selection?.type === 'station' && store.selection.stationId === st.id,
    })
  }
  return views
})

// 线路交叉「跨越」断口：层级较低的线路在与高层级线路的交叉点（无站点处）绘制白色圆点
const gaps = computed(() => {
  const result = {}
  const layers = visibleLines.value.map((line) => {
    const segs = []
    for (const leg of legsByLine.value[line.id] || []) {
      for (let i = 0; i < leg.pts.length - 1; i++) segs.push([leg.pts[i], leg.pts[i + 1]])
    }
    return { id: line.id, segs }
  })
  const stPts = stationViews.value.map((v) => ({ x: v.px, y: v.py }))
  for (let i = 0; i < layers.length; i++) {
    for (let j = i + 1; j < layers.length; j++) {
      for (const [a1, a2] of layers[i].segs) {
        for (const [b1, b2] of layers[j].segs) {
          const hit = segIntersection(a1, a2, b1, b2)
          if (!hit) continue
          if (stPts.some((p) => Math.abs(p.x - hit.x) < 4 && Math.abs(p.y - hit.y) < 4)) continue
          ;(result[layers[i].id] ||= []).push(hit)
        }
      }
    }
  }
  return result
})

const selectedLegD = computed(() => {
  const sel = store.selection
  if (sel?.type !== 'segment') return null
  const legs = legsByLine.value[sel.lineId]
  return legs && legs[sel.index] ? legs[sel.index].d : null
})

function barX(sv, i) {
  const n = sv.colors.length
  const w = sv.capsuleWidth
  if (n <= 1) return 0
  return -w / 2 + 6 + (i * (w - 12)) / (n - 1)
}

// ---------- 交互 ----------

let downInfo = null // 空白处按下：{x, y, lastX, lastY, panning}
let dragStation = null // 拖动站点：{id, started}

function toGrid(e) {
  const rect = svgEl.value.getBoundingClientRect()
  const wx = (e.clientX - rect.left - view.x) / view.scale
  const wy = (e.clientY - rect.top - view.y) / view.scale
  return { x: Math.round(wx / GRID), y: Math.round(wy / GRID) }
}

function onBackgroundDown(e) {
  if (e.button !== 0) return
  downInfo = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, panning: false }
}

function onStationDown(sv, e) {
  if (e.button !== 0) return
  if (store.mode === 'draw') {
    store.addStationAt(sv.station.x, sv.station.y)
    return
  }
  store.selection = { type: 'station', stationId: sv.station.id }
  dragStation = { id: sv.station.id, started: false }
}

function onLegDown(line, index) {
  if (store.mode !== 'select') return
  store.selection = { type: 'segment', lineId: line.id, index }
}

function onLegDblClick(line, index, e) {
  const g = toGrid(e)
  store.insertStationAt(line.id, index, g.x, g.y)
}

function onPointerMove(e) {
  if (dragStation) {
    const st = store.stationById[dragStation.id]
    if (!st) {
      dragStation = null
      return
    }
    const g = toGrid(e)
    if (st.x !== g.x || st.y !== g.y) {
      if (!dragStation.started) {
        store.pushHistory()
        dragStation.started = true
      }
      store.moveStationTo(dragStation.id, g.x, g.y)
    }
    return
  }
  if (downInfo) {
    const dx = e.clientX - downInfo.x
    const dy = e.clientY - downInfo.y
    if (!downInfo.panning && Math.hypot(dx, dy) > 4) downInfo.panning = true
    if (downInfo.panning) {
      view.x += e.clientX - downInfo.lastX
      view.y += e.clientY - downInfo.lastY
      downInfo.lastX = e.clientX
      downInfo.lastY = e.clientY
    }
  }
}

function onPointerUp(e) {
  if (dragStation) {
    if (dragStation.started) store.mergeStation(dragStation.id)
    dragStation = null
    return
  }
  if (downInfo) {
    const wasPanning = downInfo.panning
    downInfo = null
    if (wasPanning) return
    if (store.mode === 'draw') {
      const g = toGrid(e)
      store.addStationAt(g.x, g.y)
    } else if (e.target === svgEl.value || e.target.classList?.contains('grid-bg')) {
      store.selection = null
    }
  }
}

function onWheel(e) {
  const rect = svgEl.value.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const old = view.scale
  const scale = Math.min(4, Math.max(0.25, old * (e.deltaY < 0 ? 1.12 : 1 / 1.12)))
  view.x = mx - ((mx - view.x) * scale) / old
  view.y = my - ((my - view.y) * scale) / old
  view.scale = scale
}

function onKeydown(e) {
  const tag = (e.target.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return
  const mod = e.ctrlKey || e.metaKey
  const key = e.key.toLowerCase()
  if (mod && key === 'z') {
    e.preventDefault()
    if (e.shiftKey) store.redo()
    else store.undo()
  } else if (mod && key === 'y') {
    e.preventDefault()
    store.redo()
  } else if (e.key === 'Escape') {
    if (store.mode === 'draw') store.finishDraw()
  } else if (
    (e.key === 'Delete' || e.key === 'Backspace') &&
    store.selection?.type === 'station' &&
    !document.querySelector('.el-overlay')
  ) {
    store.deleteStation(store.selection.stationId)
  }
}

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <svg
    id="metro-svg"
    ref="svgEl"
    class="metro-canvas"
    :class="{ 'draw-mode': store.mode === 'draw' }"
    @wheel.prevent="onWheel"
    @pointerdown="onBackgroundDown"
    @contextmenu.prevent
  >
    <defs>
      <pattern id="grid-pattern" :width="GRID" :height="GRID" patternUnits="userSpaceOnUse">
        <path :d="`M ${GRID} 0 L 0 0 0 ${GRID}`" fill="none" stroke="#e8e8e8" stroke-width="1" />
      </pattern>
    </defs>
    <g class="viewport" :transform="viewTransform">
      <rect class="grid-bg no-export" x="-50000" y="-50000" width="100000" height="100000" fill="url(#grid-pattern)" />

      <!-- 线路层（数组顺序即绘制层级，越靠后越在上层） -->
      <g v-for="line in visibleLines" :key="line.id" class="line-layer">
        <template v-for="(leg, li) in legsByLine[line.id]" :key="li">
          <path
            class="leg-hit no-export"
            :d="leg.d"
            fill="none"
            stroke="rgba(0,0,0,0)"
            stroke-width="14"
            pointer-events="stroke"
            @pointerdown.stop="onLegDown(line, li)"
            @dblclick.stop="onLegDblClick(line, li, $event)"
          />
          <path
            class="leg"
            :d="leg.d"
            fill="none"
            :stroke="line.color"
            stroke-width="6"
            stroke-linecap="round"
            stroke-linejoin="round"
            pointer-events="none"
          />
        </template>
        <circle
          v-for="(g, gi) in gaps[line.id] || []"
          :key="gi"
          class="crossing-gap"
          :cx="g.x"
          :cy="g.y"
          r="5"
          fill="#ffffff"
          pointer-events="none"
        />
      </g>

      <!-- 选中线段高亮 -->
      <path
        v-if="selectedLegD"
        class="no-export"
        :d="selectedLegD"
        fill="none"
        stroke="#409eff"
        stroke-width="11"
        opacity="0.35"
        stroke-linecap="round"
        stroke-linejoin="round"
        pointer-events="none"
      />

      <!-- 站点层 -->
      <g
        v-for="sv in stationViews"
        :key="sv.station.id"
        class="station"
        :transform="`translate(${sv.px} ${sv.py})`"
        @pointerdown.stop="onStationDown(sv, $event)"
      >
        <circle
          v-if="sv.selected"
          class="no-export"
          r="14"
          fill="none"
          stroke="#409eff"
          stroke-width="2"
          stroke-dasharray="4 3"
        />
        <template v-if="sv.transfer">
          <rect
            :x="-sv.capsuleWidth / 2"
            y="-8"
            :width="sv.capsuleWidth"
            height="16"
            rx="8"
            fill="#ffffff"
            stroke="#333333"
            stroke-width="2.5"
          />
          <line
            v-for="(c, ci) in sv.colors"
            :key="ci"
            :x1="barX(sv, ci)"
            :x2="barX(sv, ci)"
            y1="-5"
            y2="5"
            :stroke="c"
            stroke-width="3.5"
          />
        </template>
        <circle
          v-else
          :r="sv.station.isTerminal ? 8 : 6"
          fill="#ffffff"
          stroke="#333333"
          :stroke-width="sv.station.isTerminal ? 4.5 : 2.5"
        />
      </g>

      <!-- 站名标签层 -->
      <template v-for="sv in stationViews" :key="'lb-' + sv.station.id">
        <text
          v-if="sv.station.name"
          class="station-label"
          :x="sv.px + LABEL_DIRS[sv.station.labelPos].dx"
          :y="sv.py + LABEL_DIRS[sv.station.labelPos].dy"
          :text-anchor="LABEL_DIRS[sv.station.labelPos].anchor"
          pointer-events="none"
        >{{ sv.station.name }}</text>
      </template>
    </g>
  </svg>
</template>

<style scoped>
.metro-canvas {
  width: 100%;
  height: 100%;
  display: block;
  background: #ffffff;
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.metro-canvas.draw-mode {
  cursor: crosshair;
}

.station {
  cursor: move;
}

.draw-mode .station {
  cursor: pointer;
}

.leg-hit {
  cursor: pointer;
}

.station-label {
  font-size: 12.5px;
  fill: #222222;
  paint-order: stroke;
  stroke: #ffffff;
  stroke-width: 3px;
  stroke-linejoin: round;
}
</style>
