import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import RunCode from './components/RunCode.vue'
import ModeToggles from './components/ModeToggles.vue'
import ResizeHandles from './components/ResizeHandles.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-content-after': () => h(ModeToggles),
      'layout-bottom': () => h(ResizeHandles)
    })
  },
  enhanceApp({ app }) {
    app.component('RunCode', RunCode)
  }
}
