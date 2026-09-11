import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'

const characterUrl = '/assets/boxing/character.fbx'
const animationUrls = {
  jab: '/assets/boxing/jab.fbx',
  cross: '/assets/boxing/cross.fbx',
  jabCross: '/assets/boxing/jab_cross.fbx',
  leftHook: '/assets/boxing/left_hook.fbx',
  rightHook: '/assets/boxing/right_hook.fbx',
  stepForward: '/assets/boxing/short_step_forward.fbx',
  stepBackward: '/assets/boxing/short_step_backward.fbx',
}

const combinations = [
  { name: 'Jab - Cross', note: 'Straight punches', accent: 'lime', clip: 'jabCross' },
  { name: 'Jab', note: 'Lead straight', accent: 'lime', clip: 'jab' },
  { name: 'Cross', note: 'Rear straight', accent: 'orange', clip: 'cross' },
  { name: 'Lead hook', note: 'Finish upstairs', accent: 'orange', clip: 'leftHook' },
  { name: 'Step forward', note: 'Close the distance', accent: 'blue', clip: 'stepForward' },
  { name: 'Step back', note: 'Exit on balance', accent: 'blue', clip: 'stepBackward' },
]

document.querySelector('#app').innerHTML = `
  <header class="topbar">
    <a class="brand" href="/" aria-label="Round One home"><span class="brand-mark">R1</span><span>ROUND ONE</span></a>
    <div class="session"><span class="live-dot"></span><span>COACHING SESSION</span><span class="session-rule"></span><span>ORTHODOX</span></div>
    <button class="icon-button" id="resetCamera" aria-label="Reset camera">↺</button>
  </header>
  <main class="workspace">
    <section class="stage-panel">
      <div class="stage-heading">
        <div><p class="eyebrow">COMBINATION VISUALIZER</p><h1 id="comboTitle">Jab - Cross</h1></div>
        <div class="stage-meta"><span class="status-pill"><i></i> READY</span><span>01 / 06</span></div>
      </div>
      <div class="stage-wrap" id="stageWrap">
        <div class="stage-overlay top-left"><span class="overlay-label">STANCE</span><strong>ORTHODOX</strong></div>
        <div class="stage-overlay top-right"><span class="overlay-label">MOTION SOURCE</span><strong>MIXAMO / RIG READY</strong></div>
        <div id="scene"></div>
        <div class="stage-overlay bottom-left"><span class="target-line"></span><span>LEAD HAND</span></div>
        <div class="scene-tip">Drag to orbit <span>·</span> Scroll to zoom</div>
      </div>
      <div class="transport">
        <button class="play-button" id="playButton" aria-label="Play combination"><span class="play-triangle">▶</span></button>
        <span class="time-readout" id="timeReadout">00:00.00</span>
        <input id="timeline" type="range" min="0" max="1" step="0.001" value="0" aria-label="Combination timeline" />
        <button class="speed-button" id="speedButton">1×</button>
        <button class="ghost-button" id="loopButton" aria-pressed="false">LOOP <span class="toggle"></span></button>
      </div>
    </section>
    <aside class="sequence-panel">
      <div class="panel-intro"><p class="eyebrow">TODAY'S SEQUENCE</p><h2>Build the round.</h2><p>Select a combination to see the rhythm, reach, and recovery at a glance.</p></div>
      <div class="sequence-list" id="sequenceList"></div>
      <div class="legend"><div><span class="legend-swatch lime"></span><span>Lead side</span></div><div><span class="legend-swatch orange"></span><span>Rear side</span></div><div><span class="legend-swatch blue"></span><span>Footwork</span></div></div>
      <div class="coach-note"><div class="note-mark">✦</div><div><span>COACH'S NOTE</span><p>Stay tall through the jab. Let the cross travel from the floor.</p></div></div>
      <button class="add-button" id="addButton"><span>+</span> Add combination</button>
    </aside>
  </main>
  <footer class="footer"><span>ROUND 01</span><span class="footer-center">A VISUAL PRACTICE SPACE FOR BOXING</span><span>THREE.JS / MIXAMO READY</span></footer>
`

const sceneElement = document.querySelector('#scene')
const scene = new THREE.Scene()
scene.background = new THREE.Color('#d9d3ca')
const fbxLoader = new FBXLoader()
let mixamoModel
let mixamoMixer
let mixamoAction
const mixamoActions = new Map()
const camera = new THREE.PerspectiveCamera(27, 1, 0.1, 100)
camera.position.set(5.8, 3.1, 8.8)
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.outputColorSpace = THREE.SRGBColorSpace
sceneElement.appendChild(renderer.domElement)
const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 1.4, 0)
controls.enableDamping = true
controls.minDistance = 5
controls.maxDistance = 13
controls.maxPolarAngle = Math.PI / 2.05

scene.add(new THREE.HemisphereLight('#fff9ee', '#665f59', 2.6))
const keyLight = new THREE.DirectionalLight('#fff6e8', 4.2)
keyLight.position.set(-4, 8, 5)
keyLight.castShadow = true
scene.add(keyLight)
const rimLight = new THREE.PointLight('#b8d7d0', 8, 14)
rimLight.position.set(4, 3, -4)
scene.add(rimLight)
const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 64), new THREE.MeshStandardMaterial({ color: '#c8c0b5', roughness: 0.9 }))
floor.rotation.x = -Math.PI / 2
floor.receiveShadow = true
scene.add(floor)
const ring = new THREE.Mesh(new THREE.RingGeometry(2.35, 2.42, 64), new THREE.MeshBasicMaterial({ color: '#8c9790', transparent: true, opacity: 0.65, side: THREE.DoubleSide }))
ring.rotation.x = -Math.PI / 2
ring.position.y = 0.012
scene.add(ring)
const grid = new THREE.GridHelper(10, 20, '#9d988e', '#b4aea5')
grid.position.y = 0.016
grid.material.transparent = true
grid.material.opacity = 0.18
scene.add(grid)

let isPlaying = false
let elapsed = 0
let speed = 1
let loop = false
let duration = 2.4
let selectedClip = 'jabCross'
let playWhenReady = false
function setTime(value) {
  elapsed = Number(value)
  if (mixamoAction) {
    mixamoAction.paused = true
    mixamoAction.time = Math.min(elapsed, duration)
    mixamoMixer.update(0)
  }
  document.querySelector('#timeline').value = elapsed / duration
  document.querySelector('#timeReadout').textContent = `00:${elapsed.toFixed(2).padStart(5, '0')}`
}

function useAnimation(clipName) {
  const nextAction = mixamoActions.get(clipName)
  if (!nextAction) return
  if (mixamoAction && mixamoAction !== nextAction) {
    mixamoAction.stop()
  }
  mixamoAction = nextAction
  selectedClip = clipName
  duration = mixamoAction.getClip().duration
  mixamoAction.reset()
  mixamoAction.setLoop(THREE.LoopOnce, 1)
  mixamoAction.clampWhenFinished = true
  mixamoAction.play()
  mixamoAction.paused = true
  setTime(0)
}

fbxLoader.load(characterUrl, (model) => {
  mixamoModel = model
  mixamoModel.scale.setScalar(0.01)
  mixamoModel.position.y = 0.04
  mixamoModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })
  scene.add(mixamoModel)
  mixamoMixer = new THREE.AnimationMixer(mixamoModel)
  Promise.all(Object.entries(animationUrls).map(([name, url]) => new Promise((resolve) => {
    fbxLoader.load(url, (animationFile) => {
      const clip = animationFile.animations[0]
      if (clip) mixamoActions.set(name, mixamoMixer.clipAction(clip))
      resolve()
    }, undefined, (error) => { console.error(`Unable to load ${name} animation`, error); resolve() })
  }))).then(() => {
    useAnimation(selectedClip)
    if (playWhenReady) {
      isPlaying = true
      updatePlayButton()
    }
  })
}, undefined, (error) => console.error('Unable to load Mixamo character', error))

const list = document.querySelector('#sequenceList')
list.innerHTML = combinations.map((combo, index) => `<button class="sequence-item ${index === 0 ? 'active' : ''}" data-index="${index}"><span class="sequence-number">${String(index + 1).padStart(2, '0')}</span><span class="sequence-copy"><strong>${combo.name}</strong><small>${combo.note}</small></span><span class="sequence-accent ${combo.accent}"></span><span class="sequence-arrow">→</span></button>`).join('')
list.addEventListener('click', (event) => {
  const item = event.target.closest('.sequence-item')
  if (!item) return
  const index = Number(item.dataset.index)
  document.querySelectorAll('.sequence-item').forEach((el) => el.classList.remove('active'))
  item.classList.add('active')
  document.querySelector('#comboTitle').textContent = combinations[index].name
  document.querySelector('.stage-meta span:last-child').textContent = `${String(index + 1).padStart(2, '0')} / ${String(combinations.length).padStart(2, '0')}`
  selectedClip = combinations[index].clip
  playWhenReady = true
  useAnimation(combinations[index].clip)
  isPlaying = true
  updatePlayButton()
})
function updatePlayButton() { document.querySelector('#playButton').innerHTML = isPlaying ? '<span class="pause-bars">Ⅱ</span>' : '<span class="play-triangle">▶</span>' }
document.querySelector('#playButton').addEventListener('click', () => { isPlaying = !isPlaying; updatePlayButton() })
document.querySelector('#timeline').addEventListener('input', (event) => { isPlaying = false; updatePlayButton(); setTime(Number(event.target.value) * duration) })
document.querySelector('#speedButton').addEventListener('click', () => { speed = speed === 1 ? 0.5 : speed === 0.5 ? 1.5 : 1; document.querySelector('#speedButton').textContent = `${speed}×` })
document.querySelector('#loopButton').addEventListener('click', (event) => { loop = !loop; event.currentTarget.classList.toggle('enabled', loop); event.currentTarget.setAttribute('aria-pressed', loop) })
document.querySelector('#resetCamera').addEventListener('click', () => { camera.position.set(5.8, 3.1, 8.8); controls.target.set(0, 1.4, 0) })
document.querySelector('#addButton').addEventListener('click', (event) => { event.currentTarget.textContent = 'Combination editor coming next' })

let previousFrame = performance.now()
function render(timestamp = performance.now()) {
  const delta = Math.min((timestamp - previousFrame) / 1000, 0.1)
  previousFrame = timestamp
  if (isPlaying) {
    elapsed += delta * speed
    if (elapsed >= duration) {
      if (loop) {
        elapsed = 0
        if (mixamoAction) {
          mixamoAction.reset()
          mixamoAction.play()
          mixamoAction.paused = false
        }
      }
      else { elapsed = duration; isPlaying = false; updatePlayButton() }
    }
    if (mixamoAction) {
      mixamoAction.paused = false
      mixamoMixer.update(delta * speed)
      elapsed = Math.min(mixamoAction.time, duration)
    }
    setTime(elapsed)
  }
  controls.update()
  renderer.render(scene, camera)
  requestAnimationFrame(render)
}
function resize() {
  const width = sceneElement.clientWidth
  const height = sceneElement.clientHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height, false)
}
window.addEventListener('resize', resize)
resize()
setTime(0)
render()
