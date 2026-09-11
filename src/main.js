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
let sequencePlayback = null
let followedPosition = null
let activeMotionProgress = 0
const rootMotionOffsets = new Map()
const footworkClips = new Set(['stepForward', 'stepBackward'])

function prepareAnimationClip(clip, clipName) {
  if (!footworkClips.has(clipName)) return clip
  const rootTrack = clip.tracks.find((track) => track.name.endsWith('.position') && /(hips|root)/i.test(track.name))
  if (rootTrack && rootTrack.values.length >= 6) {
    const last = rootTrack.values.length - 3
    rootMotionOffsets.set(clipName, new THREE.Vector3(
      rootTrack.values[last] - rootTrack.values[0],
      rootTrack.values[last + 1] - rootTrack.values[1],
      rootTrack.values[last + 2] - rootTrack.values[2],
    ).multiply(mixamoModel.scale))
    clip.tracks = clip.tracks.filter((track) => track !== rootTrack)
  }
  return clip
}

function applyStepMotion(clipName, progressDelta) {
  const offset = rootMotionOffsets.get(clipName)
  if (mixamoModel && offset) mixamoModel.position.addScaledVector(offset, progressDelta)
}

function setTime(value, pauseAction = true) {
  elapsed = Number(value)
  if (mixamoAction && pauseAction) {
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
  activeMotionProgress = 0
  mixamoAction.reset()
  mixamoAction.enabled = true
  mixamoAction.setEffectiveWeight(1)
  mixamoAction.setLoop(THREE.LoopOnce, 1)
  mixamoAction.clampWhenFinished = true
  mixamoAction.play()
  mixamoAction.paused = true
  setTime(0)
  mixamoModel.visible = true
}

fbxLoader.load(characterUrl, (model) => {
  mixamoModel = model
  mixamoModel.scale.setScalar(0.01)
  mixamoModel.position.y = 0.04
  followedPosition = mixamoModel.position.clone()
  mixamoModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
    }
  })
  mixamoModel.visible = false
  scene.add(mixamoModel)
  mixamoMixer = new THREE.AnimationMixer(mixamoModel)
  Promise.all(Object.entries(animationUrls).map(([name, url]) => new Promise((resolve) => {
    fbxLoader.load(url, (animationFile) => {
      const clip = animationFile.animations[0]
      if (clip) prepareAnimationClip(clip, name)
      if (clip) mixamoActions.set(name, mixamoMixer.clipAction(clip))
      resolve()
    }, undefined, (error) => { console.error(`Unable to load ${name} animation`, error); resolve() })
  }))).then(() => {
    useAnimation(selectedClip)
    followedPosition = mixamoModel.position.clone()
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
  sequencePlayback = null
  playWhenReady = true
  useAnimation(combinations[index].clip)
  isPlaying = true
  updatePlayButton()
})
const moveOptions = [
  { name: 'Jab - Cross', clip: 'jabCross', accent: 'lime' },
  { name: 'Jab', clip: 'jab', accent: 'lime' },
  { name: 'Cross', clip: 'cross', accent: 'orange' },
  { name: 'Lead hook', clip: 'leftHook', accent: 'orange' },
  { name: 'Rear hook', clip: 'rightHook', accent: 'orange' },
  { name: 'Step forward', clip: 'stepForward', accent: 'blue' },
  { name: 'Step back', clip: 'stepBackward', accent: 'blue' },
]
let builderSteps = []
function builderName() { return builderSteps.length ? builderSteps.map((step) => moveOptions.find((move) => move.clip === step.clip)?.name).join(' - ') : 'Untitled combination' }
function renderBuilder() {
  const panel = document.querySelector('.sequence-panel')
  panel.innerHTML = `<div class="builder-head"><div><p class="eyebrow">NEW COMBINATION</p><h2>Build the round.</h2></div><button class="builder-close" id="closeBuilder" aria-label="Close builder">×</button></div><p class="builder-name">${builderName()}</p><div class="builder-steps">${builderSteps.length ? builderSteps.map((step, index) => `<div class="builder-step"><div class="step-top"><span class="step-number">0${index + 1}</span><select class="step-select" data-index="${index}" aria-label="Step ${index + 1}">${moveOptions.map((move) => `<option value="${move.clip}" ${move.clip === step.clip ? 'selected' : ''}>${move.name}</option>`).join('')}</select><button class="step-remove" data-index="${index}" aria-label="Remove step ${index + 1}">×</button></div><label class="overlap-label">OVERLAP <input class="overlap-slider" data-index="${index}" type="range" min="0" max="2" step="0.1" value="${step.overlap}" /><output>${Number(step.overlap).toFixed(1)}s</output></label><label class="speed-label">SPEED <input class="speed-slider" data-index="${index}" type="range" min="0.25" max="2" step="0.25" value="${step.speed}" /><output>${Number(step.speed).toFixed(2)}x</output></label></div>`).join('') : '<div class="empty-builder"><span>＋</span><p>Add a move to start building</p></div>'}</div><div class="builder-actions">${builderSteps.length < 6 ? '<button class="add-step" id="addStep">+ Add move</button>' : '<span class="step-limit">6 STEP LIMIT</span>'}<button class="builder-play" id="playBuilder" ${builderSteps.length ? '' : 'disabled'}>▶ Play combination</button></div><div class="builder-hint">Drag is not needed here: choose a move, set its overlap, and play the full sequence.</div>`
  panel.querySelector('#closeBuilder')?.addEventListener('click', () => { panel.innerHTML = originalPanelMarkup; setupSequenceLibrary() })
  panel.querySelector('#addStep')?.addEventListener('click', () => { builderSteps.push({ clip: 'jab', overlap: 0.2, speed: 1 }); renderBuilder() })
  panel.querySelectorAll('.step-select').forEach((select) => select.addEventListener('change', (event) => { builderSteps[Number(event.target.dataset.index)].clip = event.target.value; renderBuilder() }))
  panel.querySelectorAll('.step-remove').forEach((button) => button.addEventListener('click', () => { builderSteps.splice(Number(button.dataset.index), 1); renderBuilder() }))
  panel.querySelectorAll('.overlap-slider').forEach((slider) => slider.addEventListener('input', (event) => { builderSteps[Number(event.target.dataset.index)].overlap = Number(event.target.value); renderBuilder() }))
  panel.querySelectorAll('.speed-slider').forEach((slider) => slider.addEventListener('input', (event) => { builderSteps[Number(event.target.dataset.index)].speed = Number(event.target.value); renderBuilder() }))
  panel.querySelector('#playBuilder')?.addEventListener('click', () => startSequence(builderSteps))
}
const originalPanelMarkup = document.querySelector('.sequence-panel').innerHTML
function setupSequenceLibrary() { const addButton = document.querySelector('#addButton'); addButton?.addEventListener('click', () => { builderSteps = []; renderBuilder() }) }
function startSequence(steps) {
  if (!steps.length || !mixamoActions.has(steps[0].clip)) return
  sequencePlayback = { steps: steps.map((step) => ({ ...step })), index: 0, transitioned: false, nextAction: null, stepProgress: 0 }
  useAnimation(sequencePlayback.steps[0].clip)
  mixamoAction.paused = false
  isPlaying = true
  updatePlayButton()
}
function updatePlayButton() { document.querySelector('#playButton').innerHTML = isPlaying ? '<span class="pause-bars">Ⅱ</span>' : '<span class="play-triangle">▶</span>' }
document.querySelector('#playButton').addEventListener('click', () => { isPlaying = !isPlaying; updatePlayButton() })
document.querySelector('#timeline').addEventListener('input', (event) => { isPlaying = false; updatePlayButton(); setTime(Number(event.target.value) * duration) })
document.querySelector('#speedButton').addEventListener('click', () => { speed = speed === 1 ? 0.5 : speed === 0.5 ? 1.5 : 1; document.querySelector('#speedButton').textContent = `${speed}×` })
document.querySelector('#loopButton').addEventListener('click', (event) => { loop = !loop; event.currentTarget.classList.toggle('enabled', loop); event.currentTarget.setAttribute('aria-pressed', loop) })
document.querySelector('#resetCamera').addEventListener('click', () => {
  const position = mixamoModel?.position ?? new THREE.Vector3()
  followedPosition?.copy(position)
  camera.position.set(5.8 + position.x, 3.1 + position.y, 8.8 + position.z)
  controls.target.set(position.x, 1.4 + position.y, position.z)
})
setupSequenceLibrary()

let previousFrame = performance.now()
function render(timestamp = performance.now()) {
  const delta = Math.min((timestamp - previousFrame) / 1000, 0.1)
  previousFrame = timestamp
  if (isPlaying) {
    elapsed += delta * speed
    if (elapsed >= duration && !sequencePlayback) {
      if (loop) {
        elapsed = 0
        if (mixamoAction) {
          mixamoAction.reset()
          mixamoAction.play()
          mixamoAction.paused = false
        }
        activeMotionProgress = 0
      }
      else { elapsed = duration; isPlaying = false; updatePlayButton() }
    }
    if (mixamoAction && sequencePlayback) {
      const currentStep = sequencePlayback.steps[sequencePlayback.index]
      const requestedOverlap = Math.max(0, Number(currentStep.overlap) || 0)
      const nextStep = sequencePlayback.steps[sequencePlayback.index + 1]
      const nextAction = nextStep ? mixamoActions.get(nextStep.clip) : null
      const nextDuration = nextAction?.getClip().duration ?? duration
      const overlap = Math.min(requestedOverlap, duration * 0.35, nextDuration * 0.35)
      if (!sequencePlayback.transitioned && nextAction && nextAction !== mixamoAction && sequencePlayback.index < sequencePlayback.steps.length - 1 && mixamoAction.time >= duration - overlap) {
        nextAction.reset()
        nextAction.enabled = true
        nextAction.setEffectiveWeight(1)
        nextAction.setLoop(THREE.LoopOnce, 1)
        nextAction.clampWhenFinished = true
        nextAction.play()
        if (overlap > 0) mixamoAction.crossFadeTo(nextAction, overlap, false)
        sequencePlayback.nextAction = nextAction
        sequencePlayback.transitioned = true
      }
      if (mixamoAction.time >= duration) {
        sequencePlayback.index += 1
        if (sequencePlayback.index >= sequencePlayback.steps.length) {
          if (loop) {
            sequencePlayback.index = 0
            sequencePlayback.transitioned = false
            sequencePlayback.stepProgress = 0
            useAnimation(sequencePlayback.steps[0].clip)
            mixamoAction.paused = false
          } else {
            sequencePlayback = null
            isPlaying = false
            updatePlayButton()
          }
        } else {
          mixamoAction = sequencePlayback.nextAction || mixamoAction
          duration = mixamoAction.getClip().duration
          if (!sequencePlayback.nextAction) {
            mixamoAction.reset()
            mixamoAction.play()
            mixamoAction.paused = false
          }
          sequencePlayback.transitioned = false
          sequencePlayback.nextAction = null
          sequencePlayback.stepProgress = 0
        }
      }
    }
    const sequenceWasActive = Boolean(sequencePlayback)
    if (mixamoAction) {
      mixamoAction.paused = false
      const stepSpeed = sequencePlayback ? Number(sequencePlayback.steps[sequencePlayback.index].speed) || 1 : 1
      mixamoMixer.update(delta * speed * stepSpeed)
      elapsed = Math.min(mixamoAction.time, duration)
      if (sequencePlayback) {
        const progress = Math.min(mixamoAction.time / duration, 1)
        applyStepMotion(sequencePlayback.steps[sequencePlayback.index].clip, progress - sequencePlayback.stepProgress)
        sequencePlayback.stepProgress = progress
      } else if (!sequenceWasActive) {
        const progress = Math.min(mixamoAction.time / duration, 1)
        applyStepMotion(selectedClip, progress - activeMotionProgress)
        activeMotionProgress = progress
      }
    }
    setTime(elapsed, false)
  }
  if (mixamoModel && followedPosition) {
    const movement = mixamoModel.position.clone().sub(followedPosition)
    if (movement.lengthSq() > 0) {
      camera.position.add(movement)
      controls.target.add(movement)
      followedPosition.copy(mixamoModel.position)
    }
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

