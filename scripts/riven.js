// "Don't forget, the portal combination's in my journal."" — Catherine

'use strict'

// Globals

function Riven () {
  this.lib = {}
  this.network = {}

  this.add = function (node) {
    this.network[node.id] = node
  }
}

const RIVEN = new Riven()

// QUERY

function Ø (id) {
  return RIVEN.network[id] ? RIVEN.network[id] : new RIVEN.Node(id)
}

// NODE

RIVEN.Node = function (id, rect = { x: 0, y: 0, w: 2, h: 2 }) {
  const PORT_TYPES = { default: 0, input: 1, output: 2, request: 3, answer: 4, entry: 5, exit: 6 }

  this.id = id
  this.ports = {}
  this.rect = rect
  this.parent = null
  this.children = []
  this.label = id
  this.name = this.constructor.name.toLowerCase()
  this.glyph = 'M155,65 A90,90 0 0,1 245,155 A90,90 0 0,1 155,245 A90,90 0 0,1 65,155 A90,90 0 0,1 155,65 Z'

  this.setup = function (pos) {
    this.ports.input = new this.Port(this, 'in', PORT_TYPES.input)
    this.ports.output = new this.Port(this, 'out', PORT_TYPES.output)
    this.ports.answer = new this.Port(this, 'answer', PORT_TYPES.answer)
    this.ports.request = new this.Port(this, 'request', PORT_TYPES.request)
    this.rect.x = pos.x
    this.rect.y = pos.y
  }

  this.create = function (pos = { x: 0, y: 0 }, Type, ...params) {
    if (!Type) { console.warn(`Unknown NodeType for #${this.id}`); return this }
    const node = new Type(this.id, rect, ...params)
    node.setup(pos)
    RIVEN.add(node)
    return node
  }

  // Connect

  this.connect = function (q, syphon) {
    if (q instanceof Array) {
      for (const id in q) {
        this.connect(q[id], syphon)
      }
    } else if (Ø(q)) {
      const port = (syphon ? this.ports.request : this.ports.output)
      const target = syphon ? Ø(q).ports.answer : Ø(q).ports.input
      if (!port) { console.warn(`Unknown: ${q}`); return }
      port.connect(target)
    } else {
      console.warn(`Unknown ${q}`)
    }
  }

  this.syphon = function (q) {
    this.connect(q, true)
  }

  this.bind = function (q) {
    this.connect(q)
    this.syphon(q)
  }

  // SEND/RECEIVE

  this.send = function (payload) {
    for (const routeId in this.ports.output.routes) {
      const route = this.ports.output.routes[routeId]
      if (!route) { continue }
      route.host.receive(payload, this, route)
    }
  }

  this.receive = function (q, origin, route) {
    const port = this.ports.output
    for (const routeId in port.routes) {
      const route = port.routes[routeId]
      if (route) {
        route.host.receive(q, this, route)
      }
    }
  }

  this.bang = function () {
    this.send(true)
  }

  // REQUEST/ANSWER

  this.request = function (q) {
    const payload = {}
    for (const routeId in this.ports.request.routes) {
      const route = this.ports.request.routes[routeId]
      if (!route) { continue }
      const answer = route.host.answer(q, this, route)
      if (!answer) { continue }
      payload[route.host.id] = answer
    }
    return payload
  }

  this.answer = function (q, origin, route) {
    return this.request(q)
  }

  // Target

  this.signal = function (target) {
    for (const portId in this.ports) {
      const port = this.ports[portId]
      for (const routeId in port.routes) {
        const route = port.routes[routeId]
        if (!route || !route.host || route.host.id !== target.toLowerCase()) { continue }
        return route.host
      }
    }
    return null
  }

  // PORT

  this.Port = function (host, id, type = PORT_TYPES.default) {
    this.host = host
    this.id = id
    this.type = type
    this.routes = []

    this.connect = function (port) {
      if (!port) { console.warn(`Unknown port from: ${this.host.id}`); return }
      this.routes.push(port)
    }
  }
}

// Mesh

RIVEN.lib.Mesh = function (id, rect, children) {
  RIVEN.Node.call(this, id, rect)

  this.glyph = ''
  this.name = 'meshnode'

  this.update = function () {
    const bounds = { x: 0, y: 0 }
    for (const id in this.children) {
      const node = this.children[id]
      bounds.x = node.rect.x > bounds.x ? node.rect.x : bounds.x
      bounds.y = node.rect.y > bounds.y ? node.rect.y : bounds.y
    }
    this.rect.w = bounds.x + 7
    this.rect.h = bounds.y + 6
  }

  for (const cid in children) {
    children[cid].parent = this
    this.children.push(children[cid])
    this.update()
  }
}

// ── JSON Canvas Export ──

RIVEN.toJSON = function () {
  const GRID_SIZE = 20
  const nodes = []
  const edges = []
  const edgeId = { n: 0 }

  for (const id in RIVEN.network) {
    const node = RIVEN.network[id]
    const isGroup = node.children && node.children.length > 0
    const entry = {
      id: node.id,
      type: isGroup ? 'group' : 'text',
      x: node.rect.x * GRID_SIZE,
      y: node.rect.y * GRID_SIZE,
      width: node.rect.w * GRID_SIZE,
      height: node.rect.h * GRID_SIZE
    }
    if (isGroup) {
      entry.label = node.label || node.id
    } else {
      entry.text = node.label || node.id
    }
    nodes.push(entry)

    for (const portKey in node.ports) {
      const port = node.ports[portKey]
      if (!port || !port.routes) continue
      for (let i = 0; i < port.routes.length; i++) {
        const target = port.routes[i]
        if (!target || !target.host) continue
        edges.push({
          id: 'e' + (++edgeId.n),
          fromNode: node.id,
          fromSide: portKey === 'output' || portKey === 'exit' ? 'right' : 'bottom',
          toNode: target.host.id,
          toSide: target.id === 'in' || target.id === 'entry' ? 'left' : 'top',
          toEnd: 'arrow'
        })
      }
    }
  }
  return { nodes, edges }
}

// Graph

RIVEN.graph = () => {
  const network = RIVEN.network
  const GRID_SIZE = 20
  const PORT_TYPES = { default: 0, input: 1, output: 2, request: 3, answer: 4, entry: 5, exit: 6 }

  // ── Interaction State ──

  const selected = new Set()
  const userGroups = []
  let groupCounter = 0
  let mode = 'idle'
  let dragInfo = null
  let selectInfo = null
  let panInfo = null
  const viewOffset = { x: 0, y: 0 }
  let renderQueued = false

  const GROUP_HUES = [190, 260, 330, 50, 120]

  // ── SVG Setup ──

  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  el.id = 'riven'
  document.body.appendChild(el)

  // ── Coordinate Helpers ──

  function screenToViewport (cx, cy) {
    const r = el.getBoundingClientRect()
    return { x: cx - r.left - viewOffset.x, y: cy - r.top - viewOffset.y }
  }

  // ── Soft Snap ──

  function softSnap (value, threshold) {
    const rounded = Math.round(value)
    return Math.abs(value - rounded) < threshold ? rounded : value
  }

  // ── Hit Testing ──

  function nodeAtPoint (vx, vy) {
    let best = null
    for (const id in network) {
      const node = network[id]
      const r = getRect(node)
      const pad = 2
      if (vx >= r.x - pad && vx <= r.x + r.w + pad &&
          vy >= r.y - GRID_SIZE / 2 - pad && vy <= r.y + r.h + GRID_SIZE + pad) {
        if (!best || !node.children || node.children.length === 0) {
          best = node
        }
      }
    }
    return best
  }

  function rectsOverlap (ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
  }

  function nodesInRect (x1, y1, x2, y2) {
    const sx = Math.min(x1, x2)
    const sy = Math.min(y1, y2)
    const sw = Math.abs(x2 - x1)
    const sh = Math.abs(y2 - y1)
    const hits = []
    for (const id in network) {
      const node = network[id]
      const r = getRect(node)
      if (rectsOverlap(sx, sy, sw, sh, r.x, r.y - GRID_SIZE / 2, r.w, r.h + GRID_SIZE)) {
        hits.push(node)
      }
    }
    return hits
  }

  // ── Render ──

  function queueRender () {
    if (!renderQueued) {
      renderQueued = true
      requestAnimationFrame(() => { renderQueued = false; render() })
    }
  }

  function render () {
    const _groups = userGroups.map(g => drawUserGroup(g)).join('')

    const _routes = Object.keys(network).reduce((acc, val) => {
      return `${acc}${drawRoutes(network[val])}`
    }, '')

    const _nodes = Object.keys(network).reduce((acc, val) => {
      return `${acc}${drawNode(network[val])}`
    }, '')

    let _selectRect = ''
    if (mode === 'selecting' && selectInfo) {
      const sx = Math.min(selectInfo.sx, selectInfo.cx)
      const sy = Math.min(selectInfo.sy, selectInfo.cy)
      const sw = Math.abs(selectInfo.cx - selectInfo.sx)
      const sh = Math.abs(selectInfo.cy - selectInfo.sy)
      if (sw > 2 || sh > 2) {
        _selectRect = `<rect class='selection-rect' x='${sx}' y='${sy}' width='${sw}' height='${sh}'/>`
      }
    }

    el.innerHTML = `<g id='viewport' style='transform:translate(${parseInt(viewOffset.x)}px,${parseInt(viewOffset.y)}px)'><g id='user-groups'>${_groups}</g><g id='routes'>${_routes}</g><g id='nodes'>${_nodes}</g>${_selectRect}</g>`
  }

  function updatePan () {
    const vp = document.getElementById('viewport')
    if (vp) { vp.style.transform = `translate(${parseInt(viewOffset.x)}px,${parseInt(viewOffset.y)}px)` }
    document.body.style.backgroundPosition = `${parseInt(viewOffset.x * 0.75)}px ${parseInt(viewOffset.y * 0.75)}px`
  }

  // ── Group Drawing ──

  function drawUserGroup (group) {
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity
    let count = 0
    for (const nid of group.nodeIds) {
      const n = network[nid]
      if (!n) continue
      count++
      const r = getRect(n)
      minX = Math.min(minX, r.x)
      minY = Math.min(minY, r.y - GRID_SIZE / 2)
      maxX = Math.max(maxX, r.x + r.w)
      maxY = Math.max(maxY, r.y + r.h + GRID_SIZE)
    }
    if (!count) return ''
    const pad = GRID_SIZE * 0.8
    const h = group.hue
    return `<rect class='group-bg' x='${minX - pad}' y='${minY - pad}' width='${maxX - minX + pad * 2}' height='${maxY - minY + pad * 2}' rx='${GRID_SIZE * 0.4}' ry='${GRID_SIZE * 0.4}' style='fill:hsla(${h},25%,45%,0.07);stroke:hsla(${h},25%,55%,0.14);stroke-width:1'/>`
  }

  // ── Node & Route Drawing ──

  function drawRoutes (node) {
    let html = ''
    for (const id in node.ports) {
      const port = node.ports[id]
      for (const routeId in port.routes) {
        const route = port.routes[routeId]
        if (!route) { continue }
        html += route ? drawConnection(port, route) : ''
      }
    }
    return html
  }

  function drawNode (node) {
    const rect = getRect(node)
    const sel = selected.has(node.id) ? ' selected' : ''
    return `
    <g class='node ${node.name}${sel}' id='node_${node.id}'>
      <rect rx='2' ry='2' x=${rect.x} y=${rect.y - (GRID_SIZE / 2)} width="${rect.w}" height="${rect.h}" class='${node.children.length === 0 ? 'fill' : ''}'/>
      <text x="${rect.x + (rect.w / 2) + (GRID_SIZE * 0.3)}" y="${rect.y + rect.h + (GRID_SIZE * 0.2)}">${node.label}</text>
      ${drawPorts(node)}
      ${drawGlyph(node)}
    </g>`
  }

  function drawPorts (node) {
    return Object.keys(node.ports).reduce((acc, val) => {
      return `${acc}${drawPort(node.ports[val])}`
    }, '')
  }

  function drawGlyph (node) {
    const rect = getRect(node)
    return node.glyph ? `<path class='glyph' transform="translate(${rect.x + (GRID_SIZE / 4)},${rect.y - (GRID_SIZE / 4)}) scale(0.1)" d='${node.glyph}'/>` : ''
  }

  function drawPort (port) {
    const pos = port ? getPortPosition(port) : { x: 0, y: 0 }
    const r = GRID_SIZE / 6
    return `<g class='port ${port.id}' id='${port.host.id}_port_${port.id}'><path d='M${pos.x - (r)},${pos.y} L${pos.x},${pos.y - (r)} L${pos.x + (r)},${pos.y} L${pos.x},${pos.y + (r)} Z'/></g>`
  }

  // ── Edge Routing (node-aware) ──

  function getAllNodeRects () {
    const rects = []
    for (const id in network) {
      const r = getRect(network[id])
      rects.push({ id, x: r.x - 4, y: r.y - GRID_SIZE / 2 - 4, w: r.w + 8, h: r.h + GRID_SIZE + 8 })
    }
    return rects
  }

  function segmentHitsNode (x1, y1, x2, y2, skipIds) {
    const rects = getAllNodeRects()
    for (const r of rects) {
      if (skipIds && skipIds.has(r.id)) continue
      if (lineIntersectsRect(x1, y1, x2, y2, r.x, r.y, r.w, r.h)) return r
    }
    return null
  }

  function lineIntersectsRect (x1, y1, x2, y2, rx, ry, rw, rh) {
    const minX = Math.min(x1, x2); const maxX = Math.max(x1, x2)
    const minY = Math.min(y1, y2); const maxY = Math.max(y1, y2)
    if (maxX < rx || minX > rx + rw || maxY < ry || minY > ry + rh) return false
    const cx = rx + rw / 2; const cy = ry + rh / 2
    const hw = rw / 2 + 2; const hh = rh / 2 + 2
    const dx = x2 - x1; const dy = y2 - y1
    const sx = dx !== 0 ? -dx : 1; const sy = dy !== 0 ? -dy : 1
    const px = x1 - cx; const py = y1 - cy
    if (Math.abs(px) <= hw && Math.abs(py) <= hh) return true
    const scaleX = hw / Math.abs(dx || 0.001)
    const scaleY = hh / Math.abs(dy || 0.001)
    const nearT = Math.max(
      dx !== 0 ? (sx > 0 ? (-hw - px) / dx : (hw - px) / dx) : -Infinity,
      dy !== 0 ? (sy > 0 ? (-hh - py) / dy : (hh - py) / dy) : -Infinity
    )
    const farT = Math.min(
      dx !== 0 ? (sx > 0 ? (hw - px) / dx : (-hw - px) / dx) : Infinity,
      dy !== 0 ? (sy > 0 ? (hh - py) / dy : (-hh - py) / dy) : Infinity,
      scaleX + scaleY
    )
    return nearT <= farT && farT >= 0 && nearT <= 1
  }

  function routeEdge (posA, posB, fromId, toId) {
    const skip = new Set()
    if (fromId) skip.add(fromId)
    if (toId) skip.add(toId)
    const margin = GRID_SIZE * 1.5

    const blocker = segmentHitsNode(posA.x, posA.y, posB.x, posB.y, skip)
    if (!blocker) return null

    const above = blocker.y - margin
    const below = blocker.y + blocker.h + margin
    const left = blocker.x - margin
    const right = blocker.x + blocker.w + margin

    const midY = (posA.y + posB.y) / 2
    const goUp = Math.abs(above - midY) < Math.abs(below - midY)
    const detourY = goUp ? above : below

    const midX = (posA.x + posB.x) / 2
    const goLeft = Math.abs(left - midX) < Math.abs(right - midX)
    const detourX = goLeft ? left : right

    if (Math.abs(posA.y - posB.y) < GRID_SIZE * 2) {
      return [
        { x: posA.x, y: posA.y },
        { x: posA.x + GRID_SIZE, y: posA.y },
        { x: posA.x + GRID_SIZE, y: detourY },
        { x: posB.x - GRID_SIZE, y: detourY },
        { x: posB.x - GRID_SIZE, y: posB.y },
        { x: posB.x, y: posB.y }
      ]
    }

    return [
      { x: posA.x, y: posA.y },
      { x: detourX, y: posA.y },
      { x: detourX, y: detourY },
      { x: posB.x, y: detourY },
      { x: posB.x, y: posB.y }
    ]
  }

  // ── Connection Drawing ──

  function drawConnection (a, b) {
    if (isBidirectional(a.host, b.host)) {
      return a.type !== PORT_TYPES.output ? drawConnectionBidirectional(a, b) : ''
    }
    if (a.type === PORT_TYPES.entry) {
      return drawConnectionEntry(a, b)
    }
    if (b.type === PORT_TYPES.exit) {
      return drawConnectionExit(a, b)
    }
    return a.type === PORT_TYPES.output || a.type === PORT_TYPES.output ? drawConnectionOutput(a, b) : drawConnectionRequest(a, b)
  }

  function isBidirectional (a, b) {
    for (const id in a.ports.output.routes) {
      const routeA = a.ports.output.routes[id]
      for (const id in a.ports.request.routes) {
        const routeB = a.ports.request.routes[id]
        if (routeA.host.id === routeB.host.id) {
          return true
        }
      }
    }
    return false
  }

  function drawConnectionOutput (a, b) {
    const posA = getPortPosition(a)
    const posB = getPortPosition(b)

    const detour = routeEdge(posA, posB, a.host.id, b.host.id)
    if (detour) {
      let d = `M${detour[0].x},${detour[0].y}`
      for (let i = 1; i < detour.length; i++) {
        if (i < detour.length - 1) {
          const prev = detour[i - 1]
          const curr = detour[i]
          const next = detour[i + 1]
          const r = Math.min(GRID_SIZE * 0.5,
            Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)) / 2,
            Math.sqrt(Math.pow(next.x - curr.x, 2) + Math.pow(next.y - curr.y, 2)) / 2)
          const dx1 = curr.x - prev.x; const dy1 = curr.y - prev.y
          const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) || 1
          const dx2 = next.x - curr.x; const dy2 = next.y - curr.y
          const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1
          d += ` L${curr.x - (dx1 / len1) * r},${curr.y - (dy1 / len1) * r}`
          d += ` Q${curr.x},${curr.y} ${curr.x + (dx2 / len2) * r},${curr.y + (dy2 / len2) * r}`
        } else {
          d += ` L${detour[i].x},${detour[i].y}`
        }
      }
      return `<path d="${d}" class='route output'/>`
    }

    const posM = middle(posA, posB)
    const posC1 = { x: (posM.x + (posA.x + GRID_SIZE)) / 2, y: posA.y }
    const posC2 = { x: (posM.x + (posB.x - GRID_SIZE)) / 2, y: posB.y }

    return `
    <path d="
      M${posA.x},${posA.y} L${posA.x + GRID_SIZE},${posA.y} 
      Q${posC1.x},${posC1.y} ${posM.x},${posM.y} 
      Q ${posC2.x},${posC2.y} ${posB.x - GRID_SIZE},${posB.y} 
      L${posB.x},${posB.y}
    " class='route output'/>`
  }

  function drawConnectionEntry (a, b) {
    const posA = getPortPosition(a)
    const posB = getPortPosition(b)

    return `
    <path d="
      M${posA.x},${posA.y} L${posA.x + GRID_SIZE},${posA.y} 
      L${posA.x + GRID_SIZE},${posA.y} 
      L${posA.x + GRID_SIZE},${posB.y} 
      L${posB.x},${posB.y}
    " class='route entry'/>`
  }

  function drawConnectionExit (a, b) {
    const posA = getPortPosition(a)
    const posB = getPortPosition(b)

    return `
    <path d="
      M${posA.x},${posA.y} L${posA.x + GRID_SIZE},${posA.y} 
      L${posB.x - GRID_SIZE},${posA.y} 
      L${posB.x - GRID_SIZE},${posB.y} 
      L${posB.x},${posB.y}
    " class='route exit'/>`
  }

  function drawConnectionRequest (a, b) {
    const posA = getPortPosition(a)
    const posB = getPortPosition(b)

    const detour = routeEdge(posA, posB, a.host.id, b.host.id)
    if (detour) {
      let d = `M${detour[0].x},${detour[0].y}`
      for (let i = 1; i < detour.length; i++) {
        d += ` L${detour[i].x},${detour[i].y}`
      }
      return `<path d="${d}" class='route request'/>`
    }

    return `<path d="
      M${posA.x},${posA.y} 
      L${posA.x},${posA.y + GRID_SIZE} 
      L${posB.x},${posA.y + GRID_SIZE} 
      L${posB.x},${posB.y}
    " class='route request'/>`
  }

  function drawConnectionBidirectional (a, b) {
    const posA = getPortPosition(a)
    const posB = getPortPosition(b)
    const posM = middle(posA, posB)

    let path = ''

    path += `M${posA.x},${posA.y} L${posA.x},${posA.y + GRID_SIZE} `
    path += `L${posA.x},${posM.y} L${posB.x},${posM.y}`
    path += `L${posB.x},${posB.y - GRID_SIZE} L${posB.x},${posB.y}`

    return `<path d="${path}" class='route bidirectional'/>`
  }

  // ── Geometry Helpers ──

  function getPortPosition (port) {
    const rect = getRect(port.host)
    let offset = { x: 0, y: 0 }

    if (port.type === PORT_TYPES.output || port.type === PORT_TYPES.exit) {
      offset = { x: rect.w, y: (rect.h - (GRID_SIZE * 1.5)) }
    } else if (port.type === PORT_TYPES.input || port.type === PORT_TYPES.entry) {
      offset = { x: 0, y: GRID_SIZE / 2 }
    } else if (port.type === PORT_TYPES.answer) {
      offset = { x: GRID_SIZE, y: -GRID_SIZE * 0.5 }
    } else if (port.type === PORT_TYPES.request) {
      offset = { x: (rect.w - (GRID_SIZE)), y: (rect.h - (GRID_SIZE / 2)) }
    }
    return { x: rect.x + offset.x, y: rect.y + offset.y }
  }

  function getRect (node) {
    const w = node.rect.w * GRID_SIZE
    const h = node.rect.h * GRID_SIZE
    let x = node.rect.x * GRID_SIZE
    let y = node.rect.y * GRID_SIZE

    if (node.parent) {
      const offset = getRect(node.parent)
      x += offset.x
      y += offset.y
    }
    return { x: x + (2 * GRID_SIZE), y: y + (2 * GRID_SIZE), w, h }
  }

  function middle (a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  }

  // ── Event Handlers ──

  function onMouseDown (e) {
    e.preventDefault()

    if (e.altKey || e.button === 1 || (e.button === 0 && e.spaceKey)) {
      mode = 'panning'
      panInfo = { mx: e.clientX, my: e.clientY, ox: viewOffset.x, oy: viewOffset.y }
      return
    }

    if (e.button !== 0) return

    const vp = screenToViewport(e.clientX, e.clientY)
    const hit = nodeAtPoint(vp.x, vp.y)

    if (hit) {
      if (e.shiftKey || e.metaKey) {
        if (selected.has(hit.id)) { selected.delete(hit.id) } else { selected.add(hit.id) }
      } else if (!selected.has(hit.id)) {
        selected.clear()
        selected.add(hit.id)
      }

      const starts = new Map()
      for (const id of selected) {
        const n = network[id]
        if (n) starts.set(id, { x: n.rect.x, y: n.rect.y })
      }

      mode = 'dragging'
      dragInfo = { mx: vp.x, my: vp.y, starts, moved: false }
      render()
    } else {
      if (!e.shiftKey && !e.metaKey) selected.clear()
      mode = 'selecting'
      selectInfo = { sx: vp.x, sy: vp.y, cx: vp.x, cy: vp.y }
      render()
    }
  }

  function onMouseMove (e) {
    e.preventDefault()

    if (mode === 'panning' && panInfo) {
      viewOffset.x = panInfo.ox + (e.clientX - panInfo.mx)
      viewOffset.y = panInfo.oy + (e.clientY - panInfo.my)
      updatePan()
      return
    }

    if (mode === 'dragging' && dragInfo) {
      const vp = screenToViewport(e.clientX, e.clientY)
      const dx = (vp.x - dragInfo.mx) / GRID_SIZE
      const dy = (vp.y - dragInfo.my) / GRID_SIZE
      dragInfo.moved = true

      for (const [id, sp] of dragInfo.starts) {
        const n = network[id]
        if (!n) continue
        n.rect.x = softSnap(sp.x + dx, 0.2)
        n.rect.y = softSnap(sp.y + dy, 0.2)
      }
      queueRender()
      return
    }

    if (mode === 'selecting' && selectInfo) {
      const vp = screenToViewport(e.clientX, e.clientY)
      selectInfo.cx = vp.x
      selectInfo.cy = vp.y

      const hits = nodesInRect(selectInfo.sx, selectInfo.sy, selectInfo.cx, selectInfo.cy)
      selected.clear()
      for (const n of hits) { selected.add(n.id) }

      queueRender()
    }
  }

  function onMouseUp (e) {
    if (mode === 'dragging' && dragInfo) {
      if (dragInfo.moved) {
        for (const id of selected) {
          const n = network[id]
          if (!n) continue
          n.rect.x = Math.round(n.rect.x)
          n.rect.y = Math.round(n.rect.y)
        }
      }
    }

    if (mode === 'selecting' && selectInfo) {
      const hits = nodesInRect(selectInfo.sx, selectInfo.sy, selectInfo.cx, selectInfo.cy)
      selected.clear()
      for (const n of hits) { selected.add(n.id) }
    }

    mode = 'idle'
    dragInfo = null
    selectInfo = null
    panInfo = null
    render()
  }

  function onKeyDown (e) {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'g') {
      e.preventDefault()
      if (selected.size >= 2) {
        const hue = GROUP_HUES[groupCounter % GROUP_HUES.length]
        groupCounter++
        userGroups.push({ id: 'g' + groupCounter, nodeIds: [...selected], hue })
        render()
      }
      return
    }

    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'g' || e.key === 'G')) {
      e.preventDefault()
      for (let i = userGroups.length - 1; i >= 0; i--) {
        const g = userGroups[i]
        if (g.nodeIds.some(nid => selected.has(nid))) {
          userGroups.splice(i, 1)
          break
        }
      }
      render()
      return
    }

    if (e.key === 'Escape') {
      selected.clear()
      render()
    }
  }

  // ── Install & Initial Render ──

  document.addEventListener('mousedown', onMouseDown)
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('keydown', onKeyDown)

  render()
}
