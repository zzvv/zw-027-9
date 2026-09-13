import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import './style.css'
import { useMetroStore, STORAGE_KEY } from './store/metro'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(ElementPlus)
app.mount('#app')

const store = useMetroStore()
store.$subscribe(
  (_mutation, state) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ lines: state.lines, stations: state.stations })
      )
    } catch {
      // 存储失败（如空间不足）时静默忽略，不影响编辑
    }
  },
  { detached: true }
)
