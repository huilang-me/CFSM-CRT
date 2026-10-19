<template>
  <div>
    <div v-if="booting" class="screen">
      <div class="term dim">connecting<span class="cursor">█</span></div>
    </div>

    <div v-else-if="!state.servers.length && state.error" class="screen">
      <PsLine :user="user" :host="host" :sigil="sigil" cmd="top" args="-bn1" />
      <div class="term">
        <div class="ln err">top: {{ state.error }}</div>
        <div class="ln dim">
          <button class="link" @click="retry">retry</button>
          <span v-if="!authed"> · <a class="link" href="/admin#/admin">sign in</a></span>
        </div>
      </div>
    </div>

    <div v-else class="home">
      <div class="term dim">{{ loginLine }}</div>

      <template v-if="options.show_summary">
        <PsLine :user="user" :host="host" :sigil="sigil" cmd="top" :args="summaryArgs" />
        <div class="term num">
          <div class="ln">top - {{ clockText }} up {{ upCount }} of {{ scope.length }} hosts,  load average: {{ summary.load.join(', ') }}</div>
          <div class="ln"><span class="b">Hosts:</span> {{ pad(scope.length, 4) }} total, {{ pad(summary.running, 4) }} running, {{ pad(summary.waiting, 4) }} waiting, <span :class="summary.down ? 'err' : 'hi'">{{ pad(summary.down, 4) }}</span> down</div>
          <div class="ln"><span class="b">%Cpu(s):</span> {{ pad(summary.cpu, 6) }} avg, {{ pad(summary.max, 6) }} max<span v-if="summary.busiest" class="dim">  ({{ summary.busiest }})</span></div>
          <div class="ln"><span class="b">GiB Mem :</span> {{ pad(summary.memTotal, 9) }} total, {{ pad(summary.memFree, 9) }} free, {{ pad(summary.memUsed, 9) }} used</div>
          <div class="ln"><span class="b">Net/s   :</span> {{ pad(summary.rx, 12) }} rx, {{ pad(summary.tx, 12) }} tx, {{ pad(summary.monthly, 12) }} this month</div>
        </div>
      </template>

      <PsLine :user="user" :host="host" :sigil="sigil" :cmd="viewMode" :args="viewArgs" />

      <div class="view">
        <div v-if="!shown.length" class="term dim">
          {{ state.query ? 'grep: no servers match "' + state.query + '"' : state.servers.length ? 'htop: this group is empty' : 'htop: no public servers yet' }}
        </div>
        <TopTable
          v-else-if="viewMode === 'list'"
          :servers="shown"
          :groups="groups"
          :sort="state.sort"
          :show-ping="options.show_ping"
          :now="state.tick"
          @open="open"
          @sort="onSort"
        />
        <div v-else class="panes">
          <HtopPane
            v-for="server in shown"
            :key="server.baseUrl + '|' + server.id"
            :server="server"
            :config="state.config || {}"
            :show-ping="options.show_ping"
            :now="state.tick"
            @open="open"
          />
        </div>
      </div>

      <section v-if="out" class="out">
        <PsLine :user="user" :host="host" :sigil="sigil" :cmd="out.cmd" :args="out.args" />
        <div v-if="out.kind === 'help'" class="term">
          <div class="ln dim">GNU bash-ish, version {{ state.config?.version || '1.0.0' }}. Enter runs a command; any other word filters the servers.</div>
          <div class="ln"></div>
          <div v-for="item in HELP" :key="item.name" class="ln">
            <button class="link" @click="run(item.name)">{{ item.name }}</button>{{ item.rest.padEnd(18 - item.name.length) }}<span class="dim">{{ item.desc }}</span>
          </div>
        </div>
        <div v-else-if="out.kind === 'theme'" class="term">
          <div v-for="p in palettes" :key="p.id" class="ln">
            {{ state.palette === p.id ? '* ' : '  ' }}<button class="link" @click="run('theme ' + p.id)">{{ p.id }}</button>
          </div>
        </div>
        <div v-else class="term">
          <div v-for="(line, i) in out.lines" :key="i" class="ln" :class="line.cls">{{ line.text }}</div>
        </div>
        <div class="hint dim"><button class="link" @click="out = null">clear</button>  or press Esc</div>
      </section>
    </div>

    <CliPrompt
      ref="cli"
      :prompt="cliPrompt"
      :placeholder="placeholder"
      :complete="complete"
      @run="run"
      @filter="onFilter"
      @escape="onEscape"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CliPrompt from '../components/CliPrompt.vue'
import PsLine from '../components/PsLine.vue'
import HtopPane from '../components/HtopPane.vue'
import TopTable from '../components/TopTable.vue'
import {
  state, ensureConfig, refreshServers, startLive, stopLive, setGroup, setSort, setQuery, setView, setPalette, currentView
} from '../store'
import { PALETTES, STORAGE } from '../utils/constants'
import { clockShort, fullStamp, hsize, iecRate, isOnline, normalizeTs, parseLoad, slug, trafficUsed } from '../utils/format'

const router = useRouter()
const cli = ref(null)
const out = ref(null)

const booting = computed(() => !state.configReady || (state.loading && !state.servers.length))
const authed = computed(() => state.config?.authorization === true)
const options = computed(() => state.options)
const palettes = PALETTES
const viewMode = computed(() => currentView())

const host = computed(() => slug(options.value.hostname) || slug(state.config?.site_title) || 'status')
const user = computed(() => (authed.value ? 'root' : (slug(options.value.username) || 'guest')))
const sigil = computed(() => (authed.value ? '#' : '$'))

const previousLogin = (() => {
  try { return Number(localStorage.getItem(STORAGE.LAST_LOGIN)) || 0 } catch (_) { return 0 }
})()

const loginLine = computed(() => {
  if (!previousLogin) return 'Welcome to ' + host.value + ". Type 'help' for the commands you can run here."
  return 'Last login: ' + fullStamp(previousLogin) + ' from web'
})

const groups = computed(() => {
  const set = new Set()
  for (const server of state.servers) {
    const group = String(server.server_group || '').trim()
    if (group) set.add(group)
  }
  return [...set]
})

const scope = computed(() => state.servers.filter((s) => state.group === null || String(s.server_group || '') === state.group))
const upCount = computed(() => state.servers.filter((s) => isOnline(s, state.tick)).length)

const matches = (server, query) => {
  if (!query) return true
  const hay = [server.name, server.server_group, server.region, server.os, server.arch, server.tags, server.kernel_version]
    .filter(Boolean).join(' ').toLowerCase()
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => hay.includes(word))
}

const SORTS = {
  name: (a, b) => String(a.name || '').localeCompare(String(b.name || '')),
  cpu: (a, b) => (Number(b.cpu) || -1) - (Number(a.cpu) || -1),
  mem: (a, b) => (Number(b.ram_total) > 0 ? Number(b.ram_used) / Number(b.ram_total) : -1) - (Number(a.ram_total) > 0 ? Number(a.ram_used) / Number(a.ram_total) : -1),
  disk: (a, b) => (Number(b.disk_total) > 0 ? Number(b.disk_used) / Number(b.disk_total) : -1) - (Number(a.disk_total) > 0 ? Number(a.disk_used) / Number(a.disk_total) : -1),
  net: (a, b) => ((Number(b.net_in_speed) || 0) + (Number(b.net_out_speed) || 0)) - ((Number(a.net_in_speed) || 0) + (Number(a.net_out_speed) || 0)),
  seen: (a, b) => normalizeTs(b.report_timestamp ?? b.last_updated) - normalizeTs(a.report_timestamp ?? a.last_updated)
}

const shown = computed(() => {
  const list = state.servers.filter((s) => (state.group === null || String(s.server_group || '') === state.group) && matches(s, state.query))
  const sorted = state.sort && SORTS[state.sort] ? [...list].sort(SORTS[state.sort]) : list
  const rank = (s) => (!isOnline(s, state.tick) ? 2 : s.last_updated ? 0 : 1)
  return [...sorted].sort((a, b) => rank(a) - rank(b))
})

const summary = computed(() => {
  const list = scope.value
  const up = list.filter((s) => isOnline(s, state.tick))
  const live = up.filter((s) => Number.isFinite(Number(s.cpu)))
  const waiting = up.length - live.length
  const down = list.length - up.length
  const avg = (fn) => (live.length ? live.reduce((acc, s) => acc + fn(s), 0) / live.length : 0)
  const load = [0, 1, 2].map((i) => avg((s) => parseLoad(s.load_avg)[i]).toFixed(2))
  const cpu = avg((s) => Number(s.cpu) || 0).toFixed(1)
  const busiest = live.reduce((best, s) => (!best || Number(s.cpu) > Number(best.cpu) ? s : best), null)
  const max = busiest ? Number(busiest.cpu).toFixed(1) : '0.0'
  const memUsed = live.reduce((acc, s) => acc + (Number(s.ram_used) || 0), 0)
  const memTotal = live.reduce((acc, s) => acc + (Number(s.ram_total) || 0), 0)
  const rx = live.reduce((acc, s) => acc + (Number(s.net_in_speed) || 0), 0)
  const tx = live.reduce((acc, s) => acc + (Number(s.net_out_speed) || 0), 0)
  const monthly = list.reduce((acc, s) => acc + trafficUsed(s), 0)
  const gib = (mb) => (mb / 1024).toFixed(1)
  return {
    load,
    cpu,
    max,
    busiest: busiest ? busiest.name : '',
    running: live.length,
    waiting,
    down,
    memTotal: gib(memTotal),
    memUsed: gib(memUsed),
    memFree: gib(Math.max(0, memTotal - memUsed)),
    rx: iecRate(rx),
    tx: iecRate(tx),
    monthly: hsize(monthly)
  }
})

const pad = (v, w) => String(v).padStart(w)

const whereArg = computed(() => (state.group === null ? '' : ' --group=' + JSON.stringify(state.group || 'ungrouped')))
const grepArg = computed(() => (state.query ? ' | grep -i ' + JSON.stringify(state.query) : ''))
const sortArg = computed(() => (state.sort ? ' -o %' + ({ name: 'NAME', cpu: 'CPU', mem: 'MEM', disk: 'DSK', net: 'NET', seen: 'SEEN' }[state.sort] || '') : ''))
const summaryArgs = computed(() => '-bn1' + whereArg.value + grepArg.value)
const viewArgs = computed(() => (viewMode.value === 'list' ? '-bn1' + sortArg.value : '--tree' + sortArg.value) + whereArg.value + grepArg.value)
const clockText = computed(() => clockShort(new Date(state.tick)))

const cliPrompt = computed(() => user.value + '@' + host.value + ':~' + sigil.value)
const placeholder = 'run \'help\', or \'grep <name>\' to filter'

function open(server) {
  const query = state.servers.some((s) => s.baseUrl !== server.baseUrl) ? { b: server.baseUrl } : {}
  router.push({ path: '/server/' + encodeURIComponent(server.id), query })
}

function onSort(key) {
  setSort(key)
}

function onFilter(value) {
  const match = /^(?:grep|ls)\s+(.*)$/.exec(value)
  setQuery(match ? match[1].trim() : value.trim())
}

function onEscape() {
  setQuery('')
  out.value = null
}

function print(cmd, args, lines, kind = '') {
  out.value = { cmd, args, lines, kind }
}

const HELP = [
  { name: 'ssh', rest: ' <server>', desc: 'open a server (a prefix is enough; Tab completes)' },
  { name: 'grep', rest: ' <text>', desc: 'filter servers as you type; Esc clears the filter' },
  { name: 'cd', rest: ' <group>', desc: 'switch group; cd ~ shows every server' },
  { name: 'htop', rest: '', desc: 'server panes' },
  { name: 'top', rest: '', desc: 'process-table view' },
  { name: 'sort', rest: ' <key>', desc: 'name | cpu | mem | disk | net | up | off' },
  { name: 'theme', rest: ' [name]', desc: PALETTES.map((p) => p.id).join(' | ') },
  { name: 'settings', rest: '', desc: 'edit theme_options (admin only)' },
  { name: 'clear', rest: '', desc: 'clear this output' },
  { name: 'admin', rest: '', desc: 'open /admin#/admin' }
]

const findServer = (value) => {
  const query = value.trim().toLowerCase()
  if (!query) return null
  return state.servers.find((s) => String(s.id) === value) ||
    state.servers.find((s) => String(s.name || '').toLowerCase() === query) ||
    state.servers.find((s) => String(s.name || '').toLowerCase().startsWith(query)) ||
    state.servers.find((s) => String(s.name || '').toLowerCase().includes(query))
}

const COMMANDS = {
  help: () => print('help', '', [], 'help'),
  ssh: (args) => {
    const server = findServer(args.join(' '))
    if (server) open(server)
    else print('ssh', args.join(' '), [{ text: 'ssh: Could not resolve hostname ' + (args.join(' ') || "''") + ': Name or service not known', cls: 'err' }])
  },
  cat: (args) => COMMANDS.ssh(args),
  open: (args) => COMMANDS.ssh(args),
  grep: (args) => { setQuery(args.join(' ')); out.value = null },
  ls: (args) => COMMANDS.grep(args),
  cd: (args) => {
    const value = args.join(' ')
    if (!value || value === '~' || value === '/' || value === '..') { setGroup(null); return }
    const hit = groups.value.find((g) => g === value) || groups.value.find((g) => g.toLowerCase().startsWith(value.toLowerCase()))
    if (hit) { setGroup(hit); return }
    if (value.toLowerCase() === 'ungrouped') { setGroup(''); return }
    print('cd', value, [{ text: 'bash: cd: ' + value + ': No such file or directory', cls: 'err' }])
  },
  htop: () => { setView('grid') },
  top: () => { setView('list') },
  sort: (args) => {
    const key = args[0]
    if (!key || key === 'off') setSort('')
    else if (SORTS[key]) setSort(key)
    else print('sort', key, [{ text: "sort: invalid key '" + key + "'; try " + Object.keys(SORTS).join(', '), cls: 'err' }])
  },
  theme: (args) => {
    if (!options.value.allow_switch) {
      print('theme', '', [{ text: 'theme: palette switching is disabled on this host', cls: 'err' }])
      return
    }
    if (!args[0]) { print('theme', '', [], 'theme'); return }
    if (!PALETTES.some((p) => p.id === args[0])) {
      print('theme', args[0], [{ text: 'theme: unknown palette ' + args[0], cls: 'err' }])
      return
    }
    setPalette(args[0])
    out.value = null
  },
  settings: () => {
    if (!authed.value) {
      print('settings', '', [{ text: 'permission denied: sign in at /admin to edit theme_options', cls: 'err' }])
      return
    }
    window.dispatchEvent(new CustomEvent('crt:settings'))
  },
  clear: () => { out.value = null },
  whoami: () => print('whoami', '', [{ text: user.value }]),
  hostname: () => print('hostname', '', [{ text: host.value }]),
  uptime: () => print('uptime', '', [{ text: 'top - ' + clockText.value + ' up ' + upCount.value + ' of ' + scope.value.length + ' hosts,  load average: ' + summary.value.load.join(', ') }]),
  admin: () => { window.location.href = '/admin#/admin' },
  exit: () => { out.value = null; cli.value?.blur() }
}

function run(raw) {
  const value = String(raw || '').trim()
  if (!value) return
  const [name, ...args] = value.split(/\s+/)
  if (COMMANDS[name]) {
    COMMANDS[name](args)
    return
  }
  setQuery(value)
  const list = shown.value
  if (list.length === 1) {
    setQuery('')
    open(list[0])
  } else if (!list.length) {
    setQuery('')
    print(value, '', [
      { text: 'bash: ' + name + ': command not found', cls: 'err' },
      { text: "try 'help', or type part of a server name", cls: 'dim' }
    ])
  }
}

function complete(value) {
  const parts = value.split(/\s+/)
  const pool = parts.length <= 1
    ? Object.keys(COMMANDS)
    : parts[0] === 'cd'
      ? groups.value
      : parts[0] === 'theme'
        ? PALETTES.map((p) => p.id)
        : parts[0] === 'sort'
          ? Object.keys(SORTS)
          : state.servers.map((s) => slug(s.name) || s.id)
  const prefix = (parts.length <= 1 ? parts[0] : parts.slice(1).join(' ')).toLowerCase()
  const hits = [...new Set(pool.filter((x) => x.toLowerCase().startsWith(prefix)))]
  if (!hits.length) return null
  let common = hits[0]
  for (const hit of hits) while (!hit.toLowerCase().startsWith(common.toLowerCase())) common = common.slice(0, -1)
  const done = hits.length === 1 ? hits[0] + ' ' : common
  return parts.length <= 1 ? done : parts[0] + ' ' + done
}

async function retry() {
  await refreshServers()
  startLive()
}

function onKey(event) {
  const target = event.target
  if (target instanceof HTMLElement && (/INPUT|TEXTAREA|SELECT/.test(target.tagName) || target.isContentEditable)) return
  if (event.key === '/') { event.preventDefault(); cli.value?.focus() }
  else if (event.key === 'Escape') onEscape()
}

const onRefresh = async () => {
  await refreshServers()
  startLive()
}

onMounted(async () => {
  try { localStorage.setItem(STORAGE.LAST_LOGIN, String(Date.now())) } catch (_) {}
  window.addEventListener('keydown', onKey)
  window.addEventListener('crt:refresh', onRefresh)
  if (!state.configReady) await ensureConfig()
  if (state.needsTurnstile) return
  if (!state.servers.length) await refreshServers()
  if (!state.livePaused) startLive()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('crt:refresh', onRefresh)
  stopLive()
})
</script>
