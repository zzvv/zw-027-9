import { defineStore } from 'pinia'
import { GRID, LABEL_DIRS, labelBox, boxesOverlap } from '../utils/geometry'
import { createSampleWork } from '../utils/sampleData'

export const STORAGE_KEY = 'metro-map-designer:work'

const HISTORY_LIMIT = 100

let uidSeed = 0
function genId(prefix) {
  uidSeed += 1
  return `${prefix}-${Date.now().toString(36)}-${uidSeed}`
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!Array.isArray(data.lines) || !Array.isArray(data.stations)) return null
    return data
  } catch {
    return null
  }
}

function snapshotOf(state) {
  return JSON.stringify({ lines: state.lines, stations: state.stations })
}

function dedupeConsecutive(arr) {
  return arr.filter((id, i) => i === 0 || id !== arr[i - 1])
}

export const useMetroStore = defineStore('metro', {
  state: () => {
    const saved = loadSaved()
    const sample = saved ? null : createSampleWork()
    return {
      lines: saved ? saved.lines : sample.lines,
      stations: saved ? saved.stations : sample.stations,
      mode: 'select', // select | draw
      activeLineId: null,
      selection: null, // {type:'station',stationId} | {type:'segment',lineId,index} | {type:'line',lineId}
      past: [],
      future: [],
    }
  },

  getters: {
    stationById(state) {
      const map = {}
      for (const s of state.stations) map[s.id] = s
      return map
    },
    visibleLines: (state) => state.lines.filter((l) => l.visible),
    activeLine(state) {
      return state.lines.find((l) => l.id === state.activeLineId) || null
    },
    canUndo: (state) => state.past.length > 0,
    canRedo: (state) => state.future.length > 0,
    // stationId -> 经过它的线路数组（含隐藏线路）
    stationUsage(state) {
      const usage = {}
      for (const line of state.lines) {
        for (const sid of line.stationIds) {
          ;(usage[sid] ||= []).push(line)
        }
      }
      return usage
    },
  },

  actions: {
    pushHistory() {
      this.past.push(snapshotOf(this))
      if (this.past.length > HISTORY_LIMIT) this.past.shift()
      this.future = []
    },

    undo() {
      if (!this.past.length) return
      this.future.push(snapshotOf(this))
      const snap = JSON.parse(this.past.pop())
      this.lines = snap.lines
      this.stations = snap.stations
      this.selection = null
    },

    redo() {
      if (!this.future.length) return
      this.past.push(snapshotOf(this))
      const snap = JSON.parse(this.future.pop())
      this.lines = snap.lines
      this.stations = snap.stations
      this.selection = null
    },

    stationAtCoord(gx, gy, excludeId = null) {
      return (
        this.stations.find((s) => s.id !== excludeId && s.x === gx && s.y === gy) || null
      )
    },

    // ---------- 线路 ----------

    addLine(name, color) {
      this.pushHistory()
      const line = { id: genId('line'), name, color, visible: true, stationIds: [] }
      this.lines.push(line)
      this.activeLineId = line.id
      this.mode = 'draw'
      this.selection = { type: 'line', lineId: line.id }
    },

    deleteLine(lineId) {
      this.pushHistory()
      this.lines = this.lines.filter((l) => l.id !== lineId)
      if (this.activeLineId === lineId) {
        this.activeLineId = null
        this.mode = 'select'
      }
      this.selection = null
    },

    renameLine(lineId, name) {
      const line = this.lines.find((l) => l.id === lineId)
      if (!line || !name || line.name === name) return
      this.pushHistory()
      line.name = name
    },

    setLineColor(lineId, color) {
      const line = this.lines.find((l) => l.id === lineId)
      if (!line || !color || line.color === color) return
      this.pushHistory()
      line.color = color
    },

    toggleLineVisible(lineId) {
      const line = this.lines.find((l) => l.id === lineId)
      if (!line) return
      this.pushHistory()
      line.visible = !line.visible
    },

    // dir = 1 上移（绘制层级更高，后绘制），dir = -1 下移
    moveLine(lineId, dir) {
      const i = this.lines.findIndex((l) => l.id === lineId)
      const j = i + dir
      if (i < 0 || j < 0 || j >= this.lines.length) return
      this.pushHistory()
      const [line] = this.lines.splice(i, 1)
      this.lines.splice(j, 0, line)
    },

    startDraw(lineId) {
      this.activeLineId = lineId
      this.mode = 'draw'
    },

    finishDraw() {
      this.mode = 'select'
    },

    // ---------- 站点 ----------

    _createStation(gx, gy) {
      const st = {
        id: genId('st'),
        x: gx,
        y: gy,
        name: '未命名站',
        labelPos: 0,
        isTerminal: false,
      }
      this.stations.push(st)
      return st
    },

    // 绘制模式下在当前活动线路末尾追加站点（同坐标已有站点则复用，自动形成换乘）
    addStationAt(gx, gy) {
      const line = this.activeLine
      if (this.mode !== 'draw' || !line) return
      const existing = this.stationAtCoord(gx, gy)
      const lastId = line.stationIds[line.stationIds.length - 1]
      if (existing && existing.id === lastId) return
      this.pushHistory()
      const st = existing || this._createStation(gx, gy)
      line.stationIds.push(st.id)
      this.selection = { type: 'station', stationId: st.id }
    },

    // 在线路第 legIndex 条腿（stationIds[legIndex] -> stationIds[legIndex+1]）中间插入站点
    insertStationAt(lineId, legIndex, gx, gy) {
      const line = this.lines.find((l) => l.id === lineId)
      if (!line || legIndex < 0 || legIndex >= line.stationIds.length - 1) return
      const prevId = line.stationIds[legIndex]
      const nextId = line.stationIds[legIndex + 1]
      const existing = this.stationAtCoord(gx, gy)
      if (existing && (existing.id === prevId || existing.id === nextId)) return
      this.pushHistory()
      const st = existing || this._createStation(gx, gy)
      line.stationIds.splice(legIndex + 1, 0, st.id)
      this.selection = { type: 'station', stationId: st.id }
    },

    // 拖动中的坐标更新（不入历史，拖动前由 beginHistory 统一快照）
    moveStationTo(stationId, gx, gy) {
      const st = this.stationById[stationId]
      if (!st || (st.x === gx && st.y === gy)) return
      st.x = gx
      st.y = gy
    },

    // 拖动结束：若与另一站点同坐标则合并为换乘站（与拖动同属一步历史）
    mergeStation(stationId) {
      const st = this.stationById[stationId]
      if (!st) return
      const other = this.stationAtCoord(st.x, st.y, stationId)
      if (!other) return
      for (const line of this.lines) {
        line.stationIds = dedupeConsecutive(
          line.stationIds.map((sid) => (sid === stationId ? other.id : sid))
        )
      }
      this.stations = this.stations.filter((s) => s.id !== stationId)
      if (this.selection?.type === 'station' && this.selection.stationId === stationId) {
        this.selection = { type: 'station', stationId: other.id }
      }
    },

    // 删除站点：从所有经过的线路中摘除，前后站点自动重连（原子一步撤销）
    deleteStation(stationId) {
      if (!this.stationById[stationId]) return
      this.pushHistory()
      for (const line of this.lines) {
        line.stationIds = dedupeConsecutive(line.stationIds.filter((sid) => sid !== stationId))
      }
      this.stations = this.stations.filter((s) => s.id !== stationId)
      this.selection = null
    },

    updateStation(stationId, patch) {
      const st = this.stationById[stationId]
      if (!st) return
      const changed = Object.entries(patch).some(([k, v]) => st[k] !== v)
      if (!changed) return
      this.pushHistory()
      Object.assign(st, patch)
    },

    // ---------- 标签防重叠 ----------

    autoArrangeLabels() {
      const usedIds = new Set()
      for (const line of this.visibleLines) {
        for (const sid of line.stationIds) usedIds.add(sid)
      }
      const sts = this.stations.filter((s) => usedIds.has(s.id) && s.name)
      if (!sts.length) return 0
      this.pushHistory()
      const placed = []
      let moved = 0
      for (const s of sts) {
        // 其他站点的圆形占位，避免标签压住站点
        const obstacles = sts
          .filter((o) => o.id !== s.id)
          .map((o) => ({ x: o.x * GRID - 11, y: o.y * GRID - 11, w: 22, h: 22 }))
        let best = s.labelPos
        let bestScore = Infinity
        for (let p = 0; p < LABEL_DIRS.length; p++) {
          const box = labelBox(s, p)
          let score = 0
          for (const o of placed) if (boxesOverlap(box, o)) score += 10
          for (const o of obstacles) if (boxesOverlap(box, o)) score += 1
          if (score === 0) {
            best = p
            bestScore = 0
            break
          }
          if (score < bestScore) {
            bestScore = score
            best = p
          }
        }
        if (best !== s.labelPos) {
          s.labelPos = best
          moved += 1
        }
        placed.push(labelBox(s, best))
      }
      return moved
    },

    // ---------- 导入导出 ----------

    exportData() {
      return {
        version: 1,
        app: 'metro-map-designer',
        lines: this.lines,
        stations: this.stations,
      }
    },

    importData(data) {
      if (!data || !Array.isArray(data.lines) || !Array.isArray(data.stations)) return false
      const stIds = new Set(data.stations.map((s) => s.id))
      for (const l of data.lines) {
        if (!l.id || !Array.isArray(l.stationIds)) return false
        if (l.stationIds.some((id) => !stIds.has(id))) return false
      }
      this.pushHistory()
      this.lines = data.lines.map((l) => ({
        name: '未命名线路',
        color: '#E63946',
        visible: true,
        ...l,
      }))
      this.stations = data.stations.map((s) => ({
        name: '',
        labelPos: 0,
        isTerminal: false,
        ...s,
      }))
      this.selection = null
      this.activeLineId = null
      this.mode = 'select'
      return true
    },
  },
})
