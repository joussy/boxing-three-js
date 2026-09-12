import { execFile } from 'node:child_process'
import { access, mkdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const executeFile = promisify(execFile)
const frameRate = 30
const captureWidth = 640
const captureHeight = 360
const minimumFrames = 30
const validClips = new Set([
  'jab', 'cross', 'jabCross', 'leftHook', 'rightHook', 'leftUppercut',
  'rightUppercut', 'leftPivot', 'rightPivot', 'stepForward', 'stepBackward',
])

const inputFile = process.argv[2]
if (!inputFile) throw new Error('Usage: npm run export:webp -- combinations.json')

async function loadCombinations(fileName) {
  const input = JSON.parse(await readFile(fileName, 'utf8'))
  if (!Array.isArray(input.combinations) || input.combinations.length === 0) {
    throw new Error('The JSON file must contain a non-empty "combinations" array.')
  }
  return input.combinations.map((combination, index) => {
    if (!Array.isArray(combination.steps) || combination.steps.length === 0) {
      throw new Error(`Combination ${index + 1} must have at least one step.`)
    }
    const steps = combination.steps.map((step) => {
      if (!validClips.has(step.clip)) throw new Error(`Unknown clip: ${step.clip}`)
      return { clip: step.clip, overlap: Math.max(0, Number(step.overlap) || 0) }
    })
    return { name: combination.name || `combination-${index + 1}`, steps }
  })
}

function outputName(name, index) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return slug || `combination-${index + 1}`
}

async function findFfmpeg() {
  const executable = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH
  try {
    await executeFile(executable, ['-version'])
    return executable
  } catch {
    if (process.platform === 'win32') {
      const { stdout } = await executeFile('reg', ['query', 'HKCU\\Environment', '/v', 'Path'])
      const userPath = stdout.match(/Path\s+REG_\w+\s+(.+)/i)?.[1]
      for (const directory of userPath?.split(path.delimiter) ?? []) {
        const candidate = path.join(directory.trim(), executable)
        try {
          await access(candidate)
          return candidate
        } catch {
          // Continue searching entries from the user-level PATH.
        }
      }
    }
    throw new Error('ffmpeg was not found. Install it, restart the terminal, or set FFMPEG_PATH to its executable.')
  }
}

async function encodeWebp(ffmpeg, frameDirectory, outputFile) {
  await executeFile(ffmpeg, [
    '-y', '-framerate', String(frameRate), '-i', path.join(frameDirectory, 'frame-%04d.png'),
    '-c:v', 'libwebp', '-lossless', '0', '-compression_level', '4', '-q:v', '70',
    '-loop', '0', '-an', outputFile,
  ])
}

async function captureCombination(page, combination, frameDirectory) {
  await page.locator('html[data-scene-ready="true"]').waitFor()
  await page.addStyleTag({ content: `
    #scene { position: fixed !important; inset: 0 auto auto 0 !important; width: ${captureWidth}px !important; height: ${captureHeight}px !important; z-index: 9999 !important; }
  ` })
  await page.evaluate(() => window.dispatchEvent(new Event('resize')))
  const canvas = page.locator('#scene canvas')
  await canvas.waitFor()
  const duration = await page.evaluate((steps) => {
    window.__roundOneCapture.start(steps)
    return window.__roundOneCapture.durationFor(steps)
  }, combination.steps)
  const frameCount = Math.max(minimumFrames, Math.ceil(duration * frameRate))
  const frameDuration = duration / frameCount

  for (let frame = 0; frame < frameCount; frame += 1) {
    await page.evaluate((seconds) => window.__roundOneCapture.advance(seconds), frameDuration)
    await canvas.screenshot({ path: path.join(frameDirectory, `frame-${String(frame).padStart(4, '0')}.png`) })
  }
}

const ffmpeg = await findFfmpeg()
const combinations = await loadCombinations(path.resolve(inputFile))
const framesRoot = path.resolve('output/frames')
const webpRoot = path.resolve('output/webp')
await mkdir(framesRoot, { recursive: true })
await mkdir(webpRoot, { recursive: true })

const server = await createServer({ server: { host: '127.0.0.1', port: 0 } })
await server.listen()
const browser = await chromium.launch()

try {
  for (const [index, combination] of combinations.entries()) {
    const name = outputName(combination.name, index)
    const frameDirectory = path.join(framesRoot, name)
    const webpFile = path.join(webpRoot, `${name}.webp`)
    await rm(frameDirectory, { recursive: true, force: true })
    await mkdir(frameDirectory, { recursive: true })
    const page = await browser.newPage({ viewport: { width: captureWidth, height: captureHeight }, deviceScaleFactor: 1 })
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0 })
    await page.goto(server.resolvedUrls.local[0], { waitUntil: 'networkidle' })
    await captureCombination(page, combination, frameDirectory)
    await page.close()
    await encodeWebp(ffmpeg, frameDirectory, webpFile)
    console.log(`Created ${path.relative(process.cwd(), webpFile)}`)
  }
} finally {
  await browser.close()
  await server.close()
}