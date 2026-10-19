import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initConfig } from './utils/config'
import './styles/style.css'

initConfig()

createApp(App).use(router).mount('#app')
