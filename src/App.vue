<script setup>
import Toolbar from './components/Toolbar.vue'
import LineList from './components/LineList.vue'
import MetroCanvas from './components/MetroCanvas.vue'
import PropertyPanel from './components/PropertyPanel.vue'
</script>

<template>
  <el-container class="app-shell">
    <el-header class="app-header" height="52px">
      <Toolbar />
    </el-header>
    <el-container class="app-body">
      <el-aside width="250px" class="side side-left">
        <LineList />
      </el-aside>
      <el-main class="canvas-area">
        <MetroCanvas />
      </el-main>
      <el-aside width="270px" class="side side-right">
        <PropertyPanel />
      </el-aside>
    </el-container>
  </el-container>
</template>

<style>
.app-shell {
  height: 100%;
}

.app-header {
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  padding: 0 12px;
}

.app-body {
  height: calc(100% - 52px);
}

.side {
  overflow-y: auto;
  background: #fafafa;
}

.side-left {
  border-right: 1px solid #e4e7ed;
}

.side-right {
  border-left: 1px solid #e4e7ed;
}

.canvas-area {
  padding: 0;
  position: relative;
  overflow: hidden;
}
</style>
