import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'Dashboard', component: () => import('../views/Dashboard.vue') },
    { path: '/server/:id', name: 'Server', component: () => import('../views/ServerDetail.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ],
  scrollBehavior: () => ({ top: 0 })
})

export default router
