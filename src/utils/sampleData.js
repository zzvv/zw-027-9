// 内置示例作品：虚拟城市「云港市」，3 条线路、14 个站点（含 2 个换乘站）
export function createSampleWork() {
  const stations = [
    { id: 'st-baisha', x: 2, y: 8, name: '白沙湾', labelPos: 6, isTerminal: true },
    { id: 'st-qingfeng', x: 6, y: 8, name: '青枫路', labelPos: 4, isTerminal: false },
    { id: 'st-yungang', x: 9, y: 5, name: '云港站', labelPos: 7, isTerminal: false },
    { id: 'st-park', x: 13, y: 5, name: '中央公园', labelPos: 0, isTerminal: false },
    { id: 'st-donghu', x: 17, y: 5, name: '东湖', labelPos: 4, isTerminal: false },
    { id: 'st-wangjiang', x: 20, y: 2, name: '望江门', labelPos: 2, isTerminal: true },
    { id: 'st-beilun', x: 9, y: 1, name: '北仑山', labelPos: 2, isTerminal: true },
    { id: 'st-renmin', x: 9, y: 9, name: '人民广场', labelPos: 6, isTerminal: false },
    { id: 'st-yunxi', x: 12, y: 12, name: '云溪路', labelPos: 4, isTerminal: false },
    { id: 'st-nangang', x: 16, y: 12, name: '南港湾', labelPos: 4, isTerminal: true },
    { id: 'st-xijin', x: 4, y: 11, name: '西津渡', labelPos: 6, isTerminal: true },
    { id: 'st-liushu', x: 7, y: 11, name: '柳树湾', labelPos: 4, isTerminal: false },
    { id: 'st-keji', x: 13, y: 9, name: '科技馆', labelPos: 0, isTerminal: false },
    { id: 'st-daxue', x: 16, y: 6, name: '大学城', labelPos: 2, isTerminal: true },
  ]
  const lines = [
    {
      id: 'line-1',
      name: '1号线',
      color: '#E63946',
      visible: true,
      stationIds: ['st-baisha', 'st-qingfeng', 'st-yungang', 'st-park', 'st-donghu', 'st-wangjiang'],
    },
    {
      id: 'line-2',
      name: '2号线',
      color: '#1D71B8',
      visible: true,
      stationIds: ['st-beilun', 'st-yungang', 'st-renmin', 'st-yunxi', 'st-nangang'],
    },
    {
      id: 'line-3',
      name: '3号线',
      color: '#2E9E5B',
      visible: true,
      stationIds: ['st-xijin', 'st-liushu', 'st-renmin', 'st-keji', 'st-daxue'],
    },
  ]
  return { lines, stations }
}
