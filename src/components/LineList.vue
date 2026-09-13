<script setup>
import { ElMessageBox } from 'element-plus'
import { useMetroStore } from '../store/metro'

const store = useMetroStore()

function removeLine(line) {
  ElMessageBox.confirm(`确定删除「${line.name}」？该操作可撤销。`, '删除线路', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  })
    .then(() => store.deleteLine(line.id))
    .catch(() => {})
}
</script>

<template>
  <div class="panel">
    <div class="panel-title">线路列表（{{ store.lines.length }}）</div>
    <el-empty v-if="!store.lines.length" description="暂无线路，请点击工具栏「新建线路」" :image-size="70" />
    <div
      v-for="(line, i) in store.lines"
      :key="line.id"
      class="line-row"
      :class="{ active: store.selection?.type === 'line' && store.selection.lineId === line.id }"
      @click="store.selection = { type: 'line', lineId: line.id }"
    >
      <div class="row-main">
        <el-color-picker
          :model-value="line.color"
          size="small"
          @click.stop
          @change="(c) => store.setLineColor(line.id, c)"
        />
        <span class="line-name" :class="{ dimmed: !line.visible }">{{ line.name }}</span>
        <span class="st-count">{{ line.stationIds.length }} 站</span>
      </div>
      <div class="row-actions">
        <el-button size="small" text type="primary" @click.stop="store.startDraw(line.id)">绘制</el-button>
        <el-button size="small" text @click.stop="store.toggleLineVisible(line.id)">
          {{ line.visible ? '隐藏' : '显示' }}
        </el-button>
        <el-button size="small" text :disabled="i === store.lines.length - 1" @click.stop="store.moveLine(line.id, 1)">上移</el-button>
        <el-button size="small" text :disabled="i === 0" @click.stop="store.moveLine(line.id, -1)">下移</el-button>
        <el-button size="small" text type="danger" @click.stop="removeLine(line)">删除</el-button>
      </div>
    </div>
    <div class="tip">绘制层级：列表越靠下的线路绘制在越上层，交叉处上层线路「跨越」下层线路。</div>
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

.line-row {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 6px 8px;
  margin-bottom: 8px;
  background: #ffffff;
  cursor: pointer;
}

.line-row.active {
  border-color: #409eff;
  box-shadow: 0 0 0 1px #409eff33;
}

.row-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.line-name {
  font-size: 14px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.line-name.dimmed {
  color: #a8abb2;
  text-decoration: line-through;
}

.st-count {
  font-size: 12px;
  color: #909399;
}

.row-actions {
  display: flex;
  margin-top: 2px;
}

.tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.6;
  margin-top: 4px;
}
</style>
