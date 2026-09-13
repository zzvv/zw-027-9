// 网格间距（像素）
export const GRID = 28

/**
 * 曼哈顿风格（45°/90°）布线：
 * 两个网格点之间先用 ±45° 斜线走完横纵差中较短的部分，
 * 剩余部分用水平或垂直直线补齐。若横/纵差为 0 或相等，则一段直达。
 * 保证每一段斜率只能是 0、∞、±1。
 * @param {{x:number,y:number}} a 起点（网格坐标）
 * @param {{x:number,y:number}} b 终点（网格坐标）
 * @returns {Array<{x:number,y:number}>} 折点序列（网格坐标）
 */
export function routeGrid(a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (dx === 0 || dy === 0) return [a, b]
  const adx = Math.abs(dx)
  const ady = Math.abs(dy)
  if (adx === ady) return [a, b]
  const d = Math.min(adx, ady)
  const corner = { x: a.x + Math.sign(dx) * d, y: a.y + Math.sign(dy) * d }
  return [a, corner, b]
}

function toPx(p) {
  return { x: p.x * GRID, y: p.y * GRID }
}

function pointsToD(pts) {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}

/**
 * 计算一条线路的所有「站间腿」，每腿为一段 45°/90° 折线。
 * @param {Array} stations 有序站点数组
 * @returns {Array<{d:string, pts:Array<{x:number,y:number}>}>} d 为 SVG path，pts 为像素折点
 */
export function lineLegs(stations) {
  const legs = []
  for (let i = 0; i < stations.length - 1; i++) {
    const pts = routeGrid(stations[i], stations[i + 1]).map(toPx)
    legs.push({ d: pointsToD(pts), pts })
  }
  return legs
}

/**
 * 严格内部线段相交检测（不含端点接触、不含共线重叠）。
 * @returns {{x:number,y:number}|null} 交点（像素坐标）
 */
export function segIntersection(p1, p2, p3, p4) {
  const d1x = p2.x - p1.x
  const d1y = p2.y - p1.y
  const d2x = p4.x - p3.x
  const d2y = p4.y - p3.y
  const denom = d1x * d2y - d1y * d2x
  if (Math.abs(denom) < 1e-9) return null
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom
  const eps = 1e-6
  if (t <= eps || t >= 1 - eps || u <= eps || u >= 1 - eps) return null
  return { x: p1.x + t * d1x, y: p1.y + t * d1y }
}

// 站名标签 8 个方位：上、右上、右、右下、下、左下、左、左上
export const LABEL_DIRS = [
  { name: '上', dx: 0, dy: -16, anchor: 'middle' },
  { name: '右上', dx: 12, dy: -12, anchor: 'start' },
  { name: '右', dx: 14, dy: 4, anchor: 'start' },
  { name: '右下', dx: 12, dy: 18, anchor: 'start' },
  { name: '下', dx: 0, dy: 24, anchor: 'middle' },
  { name: '左下', dx: -12, dy: 18, anchor: 'end' },
  { name: '左', dx: -14, dy: 4, anchor: 'end' },
  { name: '左上', dx: -12, dy: -12, anchor: 'end' },
]

export function textWidth(name) {
  let w = 0
  for (const ch of String(name)) {
    w += ch.charCodeAt(0) > 0x2e7f ? 13 : 7
  }
  return w
}

/**
 * 估算标签包围盒（世界/像素坐标），用于防重叠计算。
 */
export function labelBox(station, posIdx) {
  const dir = LABEL_DIRS[posIdx] || LABEL_DIRS[0]
  const bx = station.x * GRID + dir.dx
  const by = station.y * GRID + dir.dy
  const w = textWidth(station.name) + 6
  const h = 16
  let x = bx
  if (dir.anchor === 'middle') x = bx - w / 2
  else if (dir.anchor === 'end') x = bx - w
  return { x, y: by - 12, w, h }
}

export function boxesOverlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}
