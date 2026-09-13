<script setup>
import { computed } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useMetroStore } from '../store/metro'
import { LABEL_DIRS } from '../utils/geometry'

const store = useMetroStore()

const sel = computed(() => store.selection)

const station = computed(() =>
  sel.value?.type === 'station' ? store.stationById[sel.value.stationId] : null
)

const stationLines = computed(() =>
  station.value ? store.stationUsage[station.value.id] || [] : []
)

const segment = computed(() => {
  if (sel.value?.type !== 'segment') return null
  const line = store.lines.find((l) => l.id === sel.value.lineId)
  if (!line) return null
  const a = store.stationById[line.stationIds[sel.value.index]]
  const b = store.stationById[line.stationIds[sel.value.index + 1]]
  return { line, a, b }
})

const line = computed(() =>
  sel.value?.type === 'line' ? store.lines.find((l) => l.id === sel.value.lineId) : null
)

function removeStation() {
  ElMessageBox.confirm('删除该站点？经过它的线路将自动重连前后站点，该操作可撤销。', '删除站点', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  })
    .then(() => store.deleteStation(station.value.id))
    .catch(() => {})
}

function removeLine() {
  ElMessageBox.confirm(`确定删除「${line.value.name}」？该操作可撤销。`, '删除线路', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  })
    .then(() => store.deleteLine(line.value.id))
    .catch(() => {})
}
</script>

<template>
  <div class="panel">
    <div class="panel-title">属性</div>

    <!-- 站点属性 -->
    <template v-if="station">
      <el-form label-width="80px" label-position="left" size="small">
        <el-form-item label="站名">
          <el-input
            :model-value="station.name"
            placeholder="请输入站名"
            @change="(v) => store.updateStation(station.id, { name: v })"
          />
        </el-form-item>
        <el-form-item label="标签方位">
          <el-select
            :model-value="station.labelPos"
            style="width: 100%"
            @change="(v) => store.updateStation(station.id, { labelPos: v })"
          >
            <el-option v-for="(d, i) in LABEL_DIRS" :key="i" :label="d.name" :value="i" />
          </el-select>
        </el-form-item>
        <el-form-item label="终点站">
          <el-switch
            :model-value="station.isTerminal"
            @change="(v) => store.updateStation(station.id, { isTerminal: v })"
          />
        </el-form-item>
        <el-form-item label="网格坐标">
          <span class="static-text">({{ station.x }}, {{ station.y }})</span>
        </el-form-item>
        <el-form-item label="经过线路">
          <div class="line-tags">
            <el-tag
              v-for="l in stationLines"
              :key="l.id"
              size="small"
              :color="l.color"
              effect="dark"
              class="line-tag"
            >{{ l.name }}</el-tag>
            <span v-if="stationLines.length >= 2" class="transfer-hint">换乘站</span>
          </div>
        </el-form-item>
      </el-form>
      <el-button type="danger" size="small" plain style="width: 100%" @click="removeStation">
        删除站点（自动重连）
      </el-button>
      <div class="tip">提示：选择模式下拖动站点可移动，拖到另一站点上可合并为换乘站。</div>
    </template>

    <!-- 线段属性 -->
    <template v-else-if="segment">
      <el-descriptions :column="1" border size="small">
        <el-descriptions-item label="所属线路">{{ segment.line.name }}</el-descriptions-item>
        <el-descriptions-item label="起点站">{{ segment.a?.name || '—' }}</el-descriptions-item>
        <el-descriptions-item label="终点站">{{ segment.b?.name || '—' }}</el-descriptions-item>
      </el-descriptions>
      <div class="tip">双击线段可在该处插入新站点；按 Esc 退出绘制模式。</div>
    </template>

    <!-- 线路属性 -->
    <template v-else-if="line">
      <el-form label-width="80px" label-position="left" size="small">
        <el-form-item label="名称">
          <el-input
            :model-value="line.name"
            @change="(v) => store.renameLine(line.id, v.trim())"
          />
        </el-form-item>
        <el-form-item label="颜色">
          <el-color-picker
            :model-value="line.color"
            @change="(c) => store.setLineColor(line.id, c)"
          />
        </el-form-item>
        <el-form-item label="显示">
          <el-switch :model-value="line.visible" @change="store.toggleLineVisible(line.id)" />
        </el-form-item>
        <el-form-item label="站点数">
          <span class="static-text">{{ line.stationIds.length }}</span>
        </el-form-item>
      </el-form>
      <div class="btn-col">
        <el-button size="small" type="primary" plain @click="store.startDraw(line.id)">进入绘制模式</el-button>
        <el-button size="small" @click="store.moveLine(line.id, 1)">层级上移</el-button>
        <el-button size="small" @click="store.moveLine(line.id, -1)">层级下移</el-button>
        <el-button size="small" type="danger" plain @click="removeLine">删除整条线路</el-button>
      </div>
    </template>

    <!-- 未选中 -->
    <template v-else>
      <el-empty description="未选中任何元素" :image-size="70" />
      <div class="tip">
        操作指南：<br />
        · 新建线路后在画布上依次点击放置站点<br />
        · 滚轮缩放，拖拽空白处平移画布<br />
        · 选择模式下可拖动站点、点击线段选中<br />
        · 双击线段在中途插入站点<br />
        · Delete 删除选中站点，Ctrl/Cmd+Z 撤销
      </div>
    </template>
  </div>
</template>

<style scoped>
.panel {
  padding: 10px;
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 8px;
}

.static-text {
  font-size: 13px;
  color: #606266;
}

.line-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.line-tag {
  border: none;
  color: #fff;
}

.transfer-hint {
  font-size: 12px;
  color: #e6a23c;
}

.btn-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn-col .el-button {
  margin-left: 0;
}

.tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.8;
  margin-top: 12px;
}
</style>
