import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { ImageDithering, imageDitheringPresets } from '@paper-design/shaders-react'
import {
  Check,
  Copy,
  Download,
  ImagePlus,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Trash2,
  Upload,
} from 'lucide-react'
import './App.css'

type DitherType = 'random' | '2x2' | '4x4' | '8x8'
type FitMode = 'contain' | 'cover' | 'none'

type DitherSettings = {
  colorBack: string
  colorFront: string
  colorHighlight: string
  originalColors: boolean
  inverted: boolean
  brightness: number
  contrast: number
  saturation: number
  exposure: number
  gamma: number
  temperature: number
  type: DitherType
  size: number
  colorSteps: number
  scale: number
  rotation: number
  offsetX: number
  offsetY: number
  originX: number
  originY: number
  fit: FitMode
  worldWidth: number
  worldHeight: number
  exportWidth: number
  exportHeight: number
}

type SavedPreset = {
  id: string
  name: string
  settings: DitherSettings
  createdAt: number
}

type NumericSettingKey = {
  [Key in keyof DitherSettings]: DitherSettings[Key] extends number ? Key : never
}[keyof DitherSettings]

const SETTINGS_KEY = 'paper-dither-studio.settings.v1'
const PRESETS_KEY = 'paper-dither-studio.presets.v1'

const defaultSettings: DitherSettings = {
  colorBack: '#130f0b',
  colorFront: '#4e3722',
  colorHighlight: '#eed5be',
  originalColors: false,
  inverted: false,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  gamma: 1,
  temperature: 0,
  type: '8x8',
  size: 1,
  colorSteps: 2,
  scale: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  originX: 0.5,
  originY: 0.5,
  fit: 'contain',
  worldWidth: 0,
  worldHeight: 0,
  exportWidth: 1600,
  exportHeight: 1000,
}

const pinnedPresets = [
  { id: 'pinned-natural', name: 'Natural', settings: imageDitheringPresets[3]?.params },
  { id: 'pinned-superdraft', name: 'Superdraft', settings: defaultSettings },
].filter((preset) => preset.settings)

function loadSettings(): DitherSettings {
  if (typeof window === 'undefined') return defaultSettings

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaultSettings
    return coerceSettings(JSON.parse(raw))
  } catch {
    return defaultSettings
  }
}

function loadSavedPresets(): SavedPreset[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(PRESETS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((preset): preset is SavedPreset => {
        return (
          typeof preset?.id === 'string' &&
          typeof preset?.name === 'string' &&
          typeof preset?.createdAt === 'number' &&
          typeof preset?.settings === 'object'
        )
      })
      .map((preset) => ({ ...preset, settings: coerceSettings(preset.settings) }))
  } catch {
    return []
  }
}

function coerceSettings(value: Partial<DitherSettings>): DitherSettings {
  const next = { ...defaultSettings, ...value }

  return {
    colorBack: safeHex(next.colorBack, defaultSettings.colorBack),
    colorFront: safeHex(next.colorFront, defaultSettings.colorFront),
    colorHighlight: safeHex(next.colorHighlight, defaultSettings.colorHighlight),
    originalColors: Boolean(next.originalColors),
    inverted: Boolean(next.inverted),
    brightness: clampNumber(next.brightness, -100, 100, defaultSettings.brightness),
    contrast: clampNumber(next.contrast, -100, 100, defaultSettings.contrast),
    saturation: clampNumber(next.saturation, -100, 100, defaultSettings.saturation),
    exposure: clampNumber(next.exposure, -2, 2, defaultSettings.exposure),
    gamma: clampNumber(next.gamma, 0.25, 3, defaultSettings.gamma),
    temperature: clampNumber(next.temperature, -100, 100, defaultSettings.temperature),
    type: ['random', '2x2', '4x4', '8x8'].includes(next.type) ? next.type : defaultSettings.type,
    size: clampNumber(next.size, 0.5, 20, defaultSettings.size),
    colorSteps: Math.round(clampNumber(next.colorSteps, 1, 7, defaultSettings.colorSteps)),
    scale: clampNumber(next.scale, 0.01, 4, defaultSettings.scale),
    rotation: clampNumber(next.rotation, 0, 360, defaultSettings.rotation),
    offsetX: clampNumber(next.offsetX, -1, 1, defaultSettings.offsetX),
    offsetY: clampNumber(next.offsetY, -1, 1, defaultSettings.offsetY),
    originX: clampNumber(next.originX, 0, 1, defaultSettings.originX),
    originY: clampNumber(next.originY, 0, 1, defaultSettings.originY),
    fit: ['contain', 'cover', 'none'].includes(next.fit) ? next.fit : defaultSettings.fit,
    worldWidth: clampNumber(next.worldWidth, 0, 8000, defaultSettings.worldWidth),
    worldHeight: clampNumber(next.worldHeight, 0, 8000, defaultSettings.worldHeight),
    exportWidth: Math.round(clampNumber(next.exportWidth, 320, 6000, defaultSettings.exportWidth)),
    exportHeight: Math.round(clampNumber(next.exportHeight, 320, 6000, defaultSettings.exportHeight)),
  }
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return fallback
  return Math.min(max, Math.max(min, numberValue))
}

function safeHex(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toLowerCase() : fallback
}

function fileStem(name: string) {
  return name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function App() {
  const [settings, setSettings] = useState<DitherSettings>(loadSettings)
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(loadSavedPresets)
  const [presetName, setPresetName] = useState('')
  const [selectedPresetId, setSelectedPresetId] = useState('')
  const defaultImageUrl = `${import.meta.env.BASE_URL}sample-artboard.svg`
  const [imageUrl, setImageUrl] = useState(defaultImageUrl)
  const [adjustedImageUrl, setAdjustedImageUrl] = useState('')
  const [imageName, setImageName] = useState('sample-artboard')
  const [dropActive, setDropActive] = useState(false)
  const [status, setStatus] = useState('Settings saved in this browser')
  const [isExporting, setIsExporting] = useState(false)
  const [isImageLoading, setIsImageLoading] = useState(false)
  const [isImageAdjusting, setIsImageAdjusting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const exportRef = useRef<HTMLDivElement>(null)
  const uploadedImageUrlRef = useRef<string | null>(null)
  const adjustedImageUrlRef = useRef<string | null>(null)
  const uploadRequestRef = useRef(0)
  const adjustmentRequestRef = useRef(0)

  const shaderSettings = useMemo(() => coerceSettings(settings), [settings])
  const shaderImageUrl = adjustedImageUrl || imageUrl
  const savedPresetOptions = useMemo(
    () =>
      savedPresets.map((preset) => ({
        id: `saved-${preset.id}`,
        name: preset.name,
        settings: preset.settings,
      })),
    [savedPresets],
  )
  const presetOptions = useMemo(() => [...pinnedPresets, ...savedPresetOptions], [savedPresetOptions])

  useEffect(() => {
    return () => {
      if (uploadedImageUrlRef.current) URL.revokeObjectURL(uploadedImageUrlRef.current)
      if (adjustedImageUrlRef.current) URL.revokeObjectURL(adjustedImageUrlRef.current)
    }
  }, [])

  useEffect(() => {
    const requestId = adjustmentRequestRef.current + 1
    adjustmentRequestRef.current = requestId

    if (!hasImageAdjustments(shaderSettings)) {
      if (adjustedImageUrlRef.current) {
        URL.revokeObjectURL(adjustedImageUrlRef.current)
        adjustedImageUrlRef.current = null
      }
      queueMicrotask(() => {
        setAdjustedImageUrl('')
        setIsImageAdjusting(false)
      })
      return
    }

    queueMicrotask(() => {
      if (adjustmentRequestRef.current === requestId) setIsImageAdjusting(true)
    })
    processImageAdjustments(imageUrl, shaderSettings)
      .then((adjustedUrl) => {
        if (adjustmentRequestRef.current !== requestId) {
          URL.revokeObjectURL(adjustedUrl)
          return
        }

        if (adjustedImageUrlRef.current) URL.revokeObjectURL(adjustedImageUrlRef.current)
        adjustedImageUrlRef.current = adjustedUrl
        setAdjustedImageUrl(adjustedUrl)
      })
      .catch(() => {
        if (adjustmentRequestRef.current === requestId) {
          setAdjustedImageUrl('')
          setStatus('Image adjustment failed')
        }
      })
      .finally(() => {
        if (adjustmentRequestRef.current === requestId) setIsImageAdjusting(false)
      })
  }, [imageUrl, shaderSettings])

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(shaderSettings))
  }, [shaderSettings])

  useEffect(() => {
    window.localStorage.setItem(PRESETS_KEY, JSON.stringify(savedPresets))
  }, [savedPresets])

  function updateSetting<Key extends keyof DitherSettings>(key: Key, value: DitherSettings[Key]) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  function updateNumber(key: NumericSettingKey, value: number) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  function applyPreset(preset: Partial<DitherSettings>, name = 'Preset') {
    setSettings((current) =>
      coerceSettings({
        ...current,
        ...preset,
        exportWidth: current.exportWidth,
        exportHeight: current.exportHeight,
      }),
    )
    setStatus(`${name} applied`)
  }

  function applyPresetById(id: string) {
    const preset = presetOptions.find((option) => option.id === id)
    setSelectedPresetId('')
    if (!preset) return
    applyPreset(preset.settings ?? {}, preset.name)
  }

  function resetSettings() {
    setSettings(defaultSettings)
    setStatus('Superdraft palette restored')
  }

  function resetAdjustments() {
    if (adjustedImageUrlRef.current) {
      URL.revokeObjectURL(adjustedImageUrlRef.current)
      adjustedImageUrlRef.current = null
    }
    setAdjustedImageUrl('')
    setSettings((current) => ({
      ...current,
      brightness: defaultSettings.brightness,
      contrast: defaultSettings.contrast,
      saturation: defaultSettings.saturation,
      exposure: defaultSettings.exposure,
      gamma: defaultSettings.gamma,
      temperature: defaultSettings.temperature,
    }))
    setStatus('Image adjustments reset')
  }

  async function handleFile(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) {
      setStatus('Choose an image file')
      return
    }

    const requestId = uploadRequestRef.current + 1
    uploadRequestRef.current = requestId
    const nextUrl = URL.createObjectURL(file)
    setIsImageLoading(true)
    setStatus('Checking image')

    try {
      await validateImageUrl(nextUrl)
      if (uploadRequestRef.current !== requestId) {
        URL.revokeObjectURL(nextUrl)
        return
      }

      if (uploadedImageUrlRef.current) URL.revokeObjectURL(uploadedImageUrlRef.current)
      uploadedImageUrlRef.current = nextUrl
      setImageUrl(nextUrl)
      setImageName(fileStem(file.name) || 'dither-export')
      setStatus(file.name)
    } catch {
      URL.revokeObjectURL(nextUrl)
      setStatus('Image could not be loaded')
    } finally {
      if (uploadRequestRef.current === requestId) setIsImageLoading(false)
    }
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    void handleFile(event.currentTarget.files?.[0])
    event.currentTarget.value = ''
  }

  function resetImage() {
    uploadRequestRef.current += 1
    setIsImageLoading(false)
    if (uploadedImageUrlRef.current) {
      URL.revokeObjectURL(uploadedImageUrlRef.current)
      uploadedImageUrlRef.current = null
    }
    setImageUrl(defaultImageUrl)
    if (adjustedImageUrlRef.current) {
      URL.revokeObjectURL(adjustedImageUrlRef.current)
      adjustedImageUrlRef.current = null
    }
    setAdjustedImageUrl('')
    setImageName('sample-artboard')
    setStatus('Sample image restored')
  }

  function savePreset() {
    const name = presetName.trim() || `Preset ${savedPresets.length + 1}`
    const savedPreset: SavedPreset = {
      id: crypto.randomUUID(),
      name,
      settings: shaderSettings,
      createdAt: Date.now(),
    }
    setSavedPresets((current) => [savedPreset, ...current].slice(0, 24))
    setPresetName('')
    setStatus(`${name} saved`)
  }

  function deletePreset(id: string) {
    setSavedPresets((current) => current.filter((preset) => preset.id !== id))
    setStatus('Preset deleted')
  }

  async function copyPalette() {
    const palette = [
      shaderSettings.colorBack,
      shaderSettings.colorFront,
      shaderSettings.colorHighlight,
    ].join(', ')

    await navigator.clipboard.writeText(palette)
    setStatus('Palette copied')
  }

  async function downloadImage() {
    if (!exportRef.current || isImageLoading || isImageAdjusting) return

    setIsExporting(true)
    setStatus('Rendering export')

    try {
      const canvas = await waitForExportCanvas(
        exportRef.current,
        shaderSettings.exportWidth,
        shaderSettings.exportHeight,
      )
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Canvas export failed')

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${fileStem(imageName) || 'dither-export'}-${shaderSettings.exportWidth}x${shaderSettings.exportHeight}.png`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setStatus('PNG saved')
    } catch {
      setStatus('Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const artboardRatio = `${shaderSettings.exportWidth} / ${shaderSettings.exportHeight}`
  const exportSignature = useMemo(
    () =>
      JSON.stringify({
        shaderImageUrl,
        ...shaderSettings,
      }),
    [shaderImageUrl, shaderSettings],
  )

  return (
    <main className="app-shell">
      <section className="stage-panel" aria-label="Dither preview">
        <header className="topbar">
          <div>
            <p className="eyebrow">Paper Dither Studio</p>
            <h1>{imageName}</h1>
          </div>
          <div className="topbar-actions">
            <button type="button" className="icon-button" onClick={resetImage} aria-label="Reset image">
              <RotateCcw size={18} />
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()}>
              <Upload size={17} />
              Upload
            </button>
            <button
              type="button"
              className="primary"
              onClick={downloadImage}
              disabled={isExporting || isImageLoading || isImageAdjusting}
            >
              <Download size={17} />
              {isExporting ? 'Rendering' : isImageAdjusting ? 'Adjusting' : 'Save PNG'}
            </button>
          </div>
        </header>

        <div
          className={`artboard-wrap ${dropActive ? 'is-drop-active' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setDropActive(true)
          }}
          onDragLeave={() => setDropActive(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDropActive(false)
            void handleFile(event.dataTransfer.files?.[0])
          }}
        >
          <div className="artboard" style={{ aspectRatio: artboardRatio }}>
            {imageUrl ? (
              <ImageDithering
                image={shaderImageUrl}
                colorBack={shaderSettings.colorBack}
                colorFront={shaderSettings.colorFront}
                colorHighlight={shaderSettings.colorHighlight}
                originalColors={shaderSettings.originalColors}
                inverted={shaderSettings.inverted}
                type={shaderSettings.type}
                size={shaderSettings.size}
                colorSteps={shaderSettings.colorSteps}
                scale={shaderSettings.scale}
                rotation={shaderSettings.rotation}
                offsetX={shaderSettings.offsetX}
                offsetY={shaderSettings.offsetY}
                originX={shaderSettings.originX}
                originY={shaderSettings.originY}
                fit={shaderSettings.fit}
                worldWidth={shaderSettings.worldWidth}
                worldHeight={shaderSettings.worldHeight}
                width="100%"
                height="100%"
                minPixelRatio={1}
                maxPixelCount={1920 * 1080}
                webGlContextAttributes={{ preserveDrawingBuffer: true }}
              />
            ) : null}
            <div className="drop-hint">
              <ImagePlus size={18} />
              Drop image
            </div>
          </div>
        </div>

        <footer className="statusbar">
          <span>{status}</span>
          <span>
            {shaderSettings.exportWidth} x {shaderSettings.exportHeight}
          </span>
        </footer>
      </section>

      <aside className="controls-panel" aria-label="Dither controls">
        <input ref={fileInputRef} className="sr-only" type="file" accept="image/*" onChange={handleFileInput} />

        <section className="control-section">
          <div className="section-heading">
            <h2>Presets</h2>
            <SlidersHorizontal size={17} />
          </div>
          <label className="preset-select-control">
            <span className="sr-only">Preset</span>
            <select
              className="preset-select"
              value={selectedPresetId}
              aria-label="Preset"
              onChange={(event) => applyPresetById(event.currentTarget.value)}
            >
              <option value="" disabled>
                Choose preset
              </option>
              <optgroup label="Pinned">
                {pinnedPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </optgroup>
              {savedPresetOptions.length > 0 ? (
                <optgroup label="Saved">
                  {savedPresetOptions.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>
        </section>

        <section className="control-section">
          <div className="section-heading">
            <h2>Palette</h2>
            <button type="button" className="ghost-button" onClick={copyPalette}>
              <Copy size={15} />
              Copy
            </button>
          </div>
          <ColorControl label="colorBack" value={settings.colorBack} onChange={(value) => updateSetting('colorBack', value)} />
          <ColorControl
            label="colorFront"
            value={settings.colorFront}
            onChange={(value) => updateSetting('colorFront', value)}
          />
          <ColorControl
            label="colorHighlight"
            value={settings.colorHighlight}
            onChange={(value) => updateSetting('colorHighlight', value)}
          />
          <div className="toggle-row">
            <ToggleControl
              label="originalColors"
              checked={shaderSettings.originalColors}
              onChange={(value) => updateSetting('originalColors', value)}
            />
            <ToggleControl
              label="inverted"
              checked={shaderSettings.inverted}
              onChange={(value) => updateSetting('inverted', value)}
            />
          </div>
        </section>

        <section className="control-section">
          <div className="section-heading">
            <h2>Adjust</h2>
            <button type="button" className="ghost-button" onClick={resetAdjustments}>
              <RotateCcw size={15} />
              Reset
            </button>
          </div>
          <RangeControl
            label="brightness"
            min={-100}
            max={100}
            step={1}
            value={shaderSettings.brightness}
            onChange={(value) => updateNumber('brightness', value)}
          />
          <RangeControl
            label="contrast"
            min={-100}
            max={100}
            step={1}
            value={shaderSettings.contrast}
            onChange={(value) => updateNumber('contrast', value)}
          />
          <RangeControl
            label="saturation"
            min={-100}
            max={100}
            step={1}
            value={shaderSettings.saturation}
            onChange={(value) => updateNumber('saturation', value)}
          />
          <RangeControl
            label="exposure"
            min={-2}
            max={2}
            step={0.05}
            value={shaderSettings.exposure}
            onChange={(value) => updateNumber('exposure', value)}
          />
          <RangeControl
            label="gamma"
            min={0.25}
            max={3}
            step={0.01}
            value={shaderSettings.gamma}
            onChange={(value) => updateNumber('gamma', value)}
          />
          <RangeControl
            label="temperature"
            min={-100}
            max={100}
            step={1}
            value={shaderSettings.temperature}
            onChange={(value) => updateNumber('temperature', value)}
          />
        </section>

        <section className="control-section">
          <div className="section-heading">
            <h2>Dither</h2>
          </div>
          <SelectControl
            label="type"
            value={shaderSettings.type}
            options={['random', '2x2', '4x4', '8x8']}
            onChange={(value) => updateSetting('type', value as DitherType)}
          />
          <RangeControl label="size" min={0.5} max={20} step={0.1} value={shaderSettings.size} onChange={(value) => updateNumber('size', value)} />
          <RangeControl
            label="colorSteps"
            min={1}
            max={7}
            step={1}
            value={shaderSettings.colorSteps}
            onChange={(value) => updateNumber('colorSteps', Math.round(value))}
          />
          <RangeControl label="scale" min={0.01} max={4} step={0.01} value={shaderSettings.scale} onChange={(value) => updateNumber('scale', value)} />
          <SelectControl
            label="fit"
            value={shaderSettings.fit}
            options={['contain', 'cover', 'none']}
            onChange={(value) => updateSetting('fit', value as FitMode)}
          />
        </section>

        <section className="control-section">
          <div className="section-heading">
            <h2>Frame</h2>
          </div>
          <RangeControl label="rotation" min={0} max={360} step={1} value={shaderSettings.rotation} onChange={(value) => updateNumber('rotation', value)} />
          <RangeControl label="offsetX" min={-1} max={1} step={0.01} value={shaderSettings.offsetX} onChange={(value) => updateNumber('offsetX', value)} />
          <RangeControl label="offsetY" min={-1} max={1} step={0.01} value={shaderSettings.offsetY} onChange={(value) => updateNumber('offsetY', value)} />
          <RangeControl label="originX" min={0} max={1} step={0.01} value={shaderSettings.originX} onChange={(value) => updateNumber('originX', value)} />
          <RangeControl label="originY" min={0} max={1} step={0.01} value={shaderSettings.originY} onChange={(value) => updateNumber('originY', value)} />
          <div className="split-row">
            <NumberControl label="worldW" min={0} max={8000} value={shaderSettings.worldWidth} onChange={(value) => updateNumber('worldWidth', value)} />
            <NumberControl label="worldH" min={0} max={8000} value={shaderSettings.worldHeight} onChange={(value) => updateNumber('worldHeight', value)} />
          </div>
        </section>

        <section className="control-section">
          <div className="section-heading">
            <h2>Output</h2>
            <button type="button" className="ghost-button" onClick={resetSettings}>
              <RotateCcw size={15} />
              Reset
            </button>
          </div>
          <div className="split-row">
            <NumberControl
              label="width"
              min={320}
              max={6000}
              value={shaderSettings.exportWidth}
              onChange={(value) => updateNumber('exportWidth', Math.round(value))}
            />
            <NumberControl
              label="height"
              min={320}
              max={6000}
              value={shaderSettings.exportHeight}
              onChange={(value) => updateNumber('exportHeight', Math.round(value))}
            />
          </div>
          <div className="quick-sizes">
            <button type="button" onClick={() => setSettings((current) => ({ ...current, exportWidth: 1600, exportHeight: 1000 }))}>
              16:10
            </button>
            <button type="button" onClick={() => setSettings((current) => ({ ...current, exportWidth: 1600, exportHeight: 900 }))}>
              16:9
            </button>
            <button type="button" onClick={() => setSettings((current) => ({ ...current, exportWidth: 1200, exportHeight: 1200 }))}>
              1:1
            </button>
            <button type="button" onClick={() => setSettings((current) => ({ ...current, exportWidth: 1080, exportHeight: 1350 }))}>
              4:5
            </button>
          </div>
        </section>

        <section className="control-section">
          <div className="section-heading">
            <h2>Saved</h2>
            <button type="button" className="ghost-button" onClick={savePreset}>
              <Save size={15} />
              Save
            </button>
          </div>
          <input
            className="preset-name"
            value={presetName}
            placeholder="Preset name"
            onChange={(event) => setPresetName(event.currentTarget.value)}
          />
          <div className="saved-list">
            {savedPresets.length === 0 ? (
              <p>No saved presets</p>
            ) : (
              savedPresets.map((preset) => (
                <div key={preset.id} className="saved-row">
                  <button type="button" onClick={() => applyPreset(preset.settings, preset.name)}>
                    <span>{preset.name}</span>
                    <span className="swatches">
                      <i style={{ background: preset.settings.colorBack }} />
                      <i style={{ background: preset.settings.colorFront }} />
                      <i style={{ background: preset.settings.colorHighlight }} />
                    </span>
                  </button>
                  <button type="button" className="icon-button" onClick={() => deletePreset(preset.id)} aria-label={`Delete ${preset.name}`}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </aside>

      <div
        ref={exportRef}
        className="export-stage"
        aria-hidden="true"
        data-export-signature={exportSignature}
        style={{
          width: `${shaderSettings.exportWidth}px`,
          height: `${shaderSettings.exportHeight}px`,
        }}
      >
        {imageUrl ? (
          <ImageDithering
            key={exportSignature}
            image={shaderImageUrl}
            colorBack={shaderSettings.colorBack}
            colorFront={shaderSettings.colorFront}
            colorHighlight={shaderSettings.colorHighlight}
            originalColors={shaderSettings.originalColors}
            inverted={shaderSettings.inverted}
            type={shaderSettings.type}
            size={shaderSettings.size}
            colorSteps={shaderSettings.colorSteps}
            scale={shaderSettings.scale}
            rotation={shaderSettings.rotation}
            offsetX={shaderSettings.offsetX}
            offsetY={shaderSettings.offsetY}
            originX={shaderSettings.originX}
            originY={shaderSettings.originY}
            fit={shaderSettings.fit}
            worldWidth={shaderSettings.worldWidth}
            worldHeight={shaderSettings.worldHeight}
            width={shaderSettings.exportWidth}
            height={shaderSettings.exportHeight}
            minPixelRatio={1}
            maxPixelCount={shaderSettings.exportWidth * shaderSettings.exportHeight}
            webGlContextAttributes={{ preserveDrawingBuffer: true }}
          />
        ) : null}
      </div>
    </main>
  )
}

function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const hex = safeHex(value, '#000000')

  return (
    <label className="color-control">
      <span>{label}</span>
      <input type="color" value={hex} onChange={(event) => onChange(event.currentTarget.value)} />
      <input
        type="text"
        value={value}
        spellCheck={false}
        onChange={(event) => onChange(event.currentTarget.value)}
        onBlur={(event) => onChange(safeHex(event.currentTarget.value, hex))}
      />
    </label>
  )
}

function ToggleControl({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button type="button" className={`toggle ${checked ? 'is-on' : ''}`} onClick={() => onChange(!checked)} aria-pressed={checked}>
      <span>{label}</span>
      <i>{checked ? <Check size={14} /> : null}</i>
    </button>
  )
}

function SelectControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="select-control">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.currentTarget.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function RangeControl({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="range-control">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.currentTarget.value))} />
      <input type="number" min={min} max={max} step={step} value={Number(value.toFixed(2))} onChange={(event) => onChange(Number(event.currentTarget.value))} />
    </label>
  )
}

function NumberControl({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string
  min: number
  max: number
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="number-control">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={1}
        value={Math.round(value)}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  )
}

async function waitForExportCanvas(container: HTMLDivElement, width: number, height: number) {
  const deadline = performance.now() + 4000

  while (performance.now() < deadline) {
    const canvas = container.querySelector('canvas')
    if (canvas && canvas.width === width && canvas.height === height) {
      await nextFrame()
      await nextFrame()
      return canvas
    }
    await nextFrame()
  }

  throw new Error('Timed out waiting for export canvas')
}

function validateImageUrl(url: string) {
  return new Promise<void>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        resolve()
      } else {
        reject(new Error('Image has no dimensions'))
      }
    }
    image.onerror = () => reject(new Error('Image failed to load'))
    image.src = url
  })
}

function hasImageAdjustments(settings: DitherSettings) {
  return (
    settings.brightness !== defaultSettings.brightness ||
    settings.contrast !== defaultSettings.contrast ||
    settings.saturation !== defaultSettings.saturation ||
    settings.exposure !== defaultSettings.exposure ||
    settings.gamma !== defaultSettings.gamma ||
    settings.temperature !== defaultSettings.temperature
  )
}

async function processImageAdjustments(url: string, settings: DitherSettings) {
  const image = await loadImage(url)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas is not available')

  context.drawImage(image, 0, 0)
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  applyImageAdjustments(imageData.data, settings)
  context.putImageData(imageData, 0, 0)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Adjusted image export failed')

  return URL.createObjectURL(blob)
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Image failed to load'))
    image.src = url
  })
}

function applyImageAdjustments(data: Uint8ClampedArray, settings: DitherSettings) {
  const exposureFactor = 2 ** settings.exposure
  const brightnessOffset = settings.brightness * 2.55
  const contrastValue = settings.contrast * 2.55
  const contrastFactor = (259 * (contrastValue + 255)) / (255 * (259 - contrastValue))
  const saturationFactor = 1 + settings.saturation / 100
  const temperatureOffset = settings.temperature * 0.8
  const gammaInverse = 1 / settings.gamma

  for (let index = 0; index < data.length; index += 4) {
    let red = data[index] * exposureFactor
    let green = data[index + 1] * exposureFactor
    let blue = data[index + 2] * exposureFactor

    red += brightnessOffset + temperatureOffset
    green += brightnessOffset + Math.abs(temperatureOffset) * 0.08
    blue += brightnessOffset - temperatureOffset

    red = contrastFactor * (red - 128) + 128
    green = contrastFactor * (green - 128) + 128
    blue = contrastFactor * (blue - 128) + 128

    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722
    red = luminance + (red - luminance) * saturationFactor
    green = luminance + (green - luminance) * saturationFactor
    blue = luminance + (blue - luminance) * saturationFactor

    data[index] = gammaCorrect(red, gammaInverse)
    data[index + 1] = gammaCorrect(green, gammaInverse)
    data[index + 2] = gammaCorrect(blue, gammaInverse)
  }
}

function gammaCorrect(value: number, gammaInverse: number) {
  return Math.round(255 * Math.min(1, Math.max(0, value / 255)) ** gammaInverse)
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

export default App
