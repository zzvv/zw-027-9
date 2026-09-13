<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useMetroStore } from '../store/metro'

const store = useMetroStore()

const dialogVisible = ref(false)
const lineName = ref('')
const lineColor = ref('#E63946')
const presetColors = ['#E63946', '#1D71B8', '#2E9E5B', '#F4A300', '#7B3FBF', '#00A0AF', '#C23B8F', '#6B4F2A', '#555555']
const fileInput = ref(null)

function openDialog() {
  lineName.value = `${store.lines.length + 1}号线`
  dialogVisible.value = true
}

function confirmLine() {
  if (!lineName.value.trim()) {
    ElMessage.warning('请输入线路名称')
    return
  }
  store.addLine(lineName.value.trim(), lineColor.value || '#E63946')
  dialogVisible.value = false
  ElMessage.success('已进入绘制模式，在画布上依次点击放置站点，Esc 结束')
}

function arrangeLabels() {
  const moved = store.autoArrangeLabels()
  if (moved === null || moved === undefined) return
  ElMessage.success(moved > 0 ? `已调整 ${moved} 个站名标签的方位` : '当前没有相互重叠的标签')
}

function download(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function exportJson() {
  download(
    new Blob([JSON.stringify(store.exportData(), null, 2)], { type: 'application/json' }),
    'metro-work.json'
  )
  ElMessage.success('已导出 JSON 存档')
}

function triggerImport() {
  fileInput.value?.click()
}

function onImportFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result)
      if (store.importData(data)) ElMessage.success('导入成功，可继续编辑')
      else ElMessage.error('文件格式不正确')
    } catch {
      ElMessage.error('无法解析 JSON 文件')
    }
  }
  reader.readAsText(file)
}

function exportSvg() {
  const svg = document.getElementById('metro-svg')
  if (!svg) return
  const content = svg.querySelector('g.viewport')
  let bbox = null
  try {
    bbox = content.getBBox()
  } catch {
    bbox = null
  }
  if (!bbox || bbox.width === 0 || bbox.height === 0) {
    ElMessage.warning('画布为空，没有可导出的内容')
    return
  }
  const NS = 'http://www.w3.org/2000/svg'
  const clone = svg.cloneNode(true)
  // 去掉平移缩放变换，使内容坐标即世界坐标
  clone.querySelector('g.viewport').removeAttribute('transform')
  // 移除网格背景、命中热区、选中高亮等不导出的元素（隐藏线路本就不渲染）
  clone.querySelectorAll('.no-export').forEach((n) => n.remove())
  const pad = 60
  const x = bbox.x - pad
  const y = bbox.y - pad
  const w = bbox.width + pad * 2
  const h = bbox.height + pad * 2
  clone.setAttribute('viewBox', `${x} ${y} ${w} ${h}`)
  clone.setAttribute('width', String(Math.round(w)))
  clone.setAttribute('height', String(Math.round(h)))
  clone.setAttribute('xmlns', NS)
  clone.removeAttribute('class')
  const bg = document.createElementNS(NS, 'rect')
  bg.setAttribute('x', String(x))
  bg.setAttribute('y', String(y))
  bg.setAttribute('width', String(w))
  bg.setAttribute('height', String(h))
  bg.setAttribute('fill', '#ffffff')
  clone.insertBefore(bg, clone.firstChild)
  const str = new XMLSerializer().serializeToString(clone)
  download(
    new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + str], { type: 'image/svg+xml' }),
    'metro-map.svg'
  )
  ElMessage.success('已导出 SVG 图片')
}
</script>

<template>
  <div class="toolbar">
    <span class="title">轨道交通示意图编辑器</span>
    <el-divider direction="vertical" />
    <el-button type="primary" size="small" @click="openDialog">新建线路</el-button>
    <el-tag v-if="store.mode === 'draw' && store.activeLine" type="warning" size="small" effect="dark">
      正在绘制：{{ store.activeLine.name }}
    </el-tag>
    <el-button v-if="store.mode === 'draw'" size="small" @click="store.finishDraw()">完成绘制 (Esc)</el-button>
    <el-divider direction="vertical" />
    <el-button size="small" :disabled="!store.canUndo" @click="store.undo()">撤销</el-button>
    <el-button size="small" :disabled="!store.canRedo" @click="store.redo()">重做</el-button>
    <el-divider direction="vertical" />
    <el-button size="small" @click="arrangeLabels">标签防重叠</el-button>
    <div class="spacer" />
    <el-button size="small" @click="exportSvg">导出 SVG</el-button>
    <el-button size="small" @click="exportJson">导出 JSON</el-button>
    <el-button size="small" @click="triggerImport">导入 JSON</el-button>
    <input ref="fileInput" type="file" accept=".json,application/json" style="display: none" @change="onImportFile" />

    <el-dialog v-model="dialogVisible" title="新建线路" width="380px">
      <el-form label-width="70px">
        <el-form-item label="名称">
          <el-input v-model="lineName" placeholder="如：1号线" @keyup.enter="confirmLine" />
        </el-form-item>
        <el-form-item label="颜色">
          <el-color-picker v-model="lineColor" :predefine="presetColors" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmLine">创建并绘制</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.title {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
}

.spacer {
  flex: 1;
}
</style>
