import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { ImageWorkspace, type LoadedImage } from './components/ImageWorkspace'
import { ResultPanel } from './components/ResultPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { StepTitle } from './components/StepTitle'
import { calculateGridDimensions, prepareAnalysisImage, sampleImageToGrid } from './core/imageSampling'
import { getPalette, MARD_PALETTE_VERSION, MARD_SOURCE_URL } from './data/palettes'
import { canvasToBlob, downloadBlob, timestampForFilename } from './render/canvasUtils'
import { createUsageCsv } from './render/exportCsv'
import { renderBeadPreview } from './render/renderBeadPreview'
import { renderCodeChart } from './render/renderCodeChart'
import type {
  BackgroundMode,
  GenerationResult,
  GenerationSettings,
  ImageLayout,
  WorkerResponse,
} from './types'

const MAX_FILE_BYTES = 20 * 1024 * 1024
const DEFAULT_LAYOUT: ImageLayout = { mode: 'contain', zoom: 1, offsetX: 0, offsetY: 0 }
const MODE_FILE_LABEL = { balanced: 'balanced', closest: 'closest', minimal: 'minimal' } as const

const heroPattern = [
  0, 0, 1, 1, 1, 1, 0, 0,
  0, 1, 2, 2, 2, 2, 1, 0,
  1, 2, 3, 2, 2, 3, 2, 1,
  1, 2, 2, 2, 2, 2, 2, 1,
  1, 2, 4, 2, 2, 4, 2, 1,
  0, 1, 2, 4, 4, 2, 1, 0,
  0, 0, 1, 2, 2, 1, 0, 0,
  0, 0, 0, 1, 1, 0, 0, 0,
]

function nextPaint() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

async function decodeSafeImage(file: File): Promise<ImageBitmap> {
  const decoded = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const pixelCount = decoded.width * decoded.height
  const scale = Math.min(1, 4096 / Math.max(decoded.width, decoded.height), Math.sqrt(16_000_000 / pixelCount))
  if (scale >= 1) return decoded
  const resized = await createImageBitmap(decoded, {
    resizeWidth: Math.max(1, Math.round(decoded.width * scale)),
    resizeHeight: Math.max(1, Math.round(decoded.height * scale)),
    resizeQuality: 'high',
  })
  decoded.close()
  return resized
}

function App() {
  const [source, setSource] = useState<LoadedImage | null>(null)
  const sourceRef = useRef<LoadedImage | null>(null)
  const [layout, setLayout] = useState<ImageLayout>(DEFAULT_LAYOUT)
  const [gridWidth, setGridWidth] = useState(52)
  const [beadSize, setBeadSize] = useState(5)
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('keep')
  const [settings, setSettings] = useState<GenerationSettings>({ mode: 'balanced', paletteId: '221', maxColors: 'auto' })
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [statusNote, setStatusNote] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('准备图片')
  const [packSize, setPackSize] = useState(1000)
  const [exporting, setExporting] = useState<string | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const taskIdRef = useRef<string | null>(null)

  const grid = useMemo(
    () => source ? calculateGridDimensions(source.width, source.height, gridWidth) : { width: gridWidth, height: gridWidth },
    [gridWidth, source],
  )

  useEffect(() => {
    sourceRef.current = source
  }, [source])

  useEffect(() => () => {
    workerRef.current?.terminate()
    sourceRef.current?.bitmap.close()
  }, [])

  const cancelGeneration = (showNote = true) => {
    workerRef.current?.terminate()
    workerRef.current = null
    taskIdRef.current = null
    setIsGenerating(false)
    if (showNote) setStatusNote('已取消本次生成。可以调整设置后重新开始。')
  }

  const handleFile = async (file: File) => {
    cancelGeneration(false)
    setFileError(null)
    setActionError(null)
    const extensionAllowed = /\.(?:jpe?g|png|webp)$/iu.test(file.name)
    const mimeAllowed = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    if (!extensionAllowed || (!mimeAllowed && file.type !== '')) {
      setFileError('只支持 JPG、JPEG、PNG 或 WebP。请先把其他格式转换为普通图片。')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError('图片超过 20 MB。请压缩图片或降低分辨率后再试。')
      return
    }
    try {
      const bitmap = await decodeSafeImage(file)
      sourceRef.current?.bitmap.close()
      const loaded = { bitmap, name: file.name, width: bitmap.width, height: bitmap.height }
      sourceRef.current = loaded
      setSource(loaded)
      setLayout(DEFAULT_LAYOUT)
      setResult(null)
      setStatusNote(bitmap.width * bitmap.height >= 15_000_000 ? '超大图片已安全缩放用于本地分析。' : null)
    } catch {
      setFileError('浏览器无法解码这张图片。请确认文件未损坏，或另存为标准 JPG / PNG 后重试。')
    }
  }

  const startGeneration = async () => {
    if (!source) {
      setFileError('请先选择一张 JPG、PNG 或 WebP 图片。')
      return
    }
    cancelGeneration(false)
    setActionError(null)
    setStatusNote(null)
    setResult(null)
    setIsGenerating(true)
    setProgress(3)
    setProgressLabel('准备图片与生成范围')
    await nextPaint()

    try {
      const prepared = prepareAnalysisImage(
        source.bitmap,
        source.width,
        source.height,
        grid.width,
        grid.height,
        layout,
        backgroundMode,
      )
      setProgress(11)
      setProgressLabel('逐格区域采样')
      await nextPaint()
      const sampledGrid = sampleImageToGrid(prepared.imageData, grid.width, grid.height)
      setProgress(18)

      if (backgroundMode === 'edge-remove') {
        setStatusNote(prepared.removedPixels > 0
          ? `已移除 ${prepared.removedPixels.toLocaleString('zh-CN')} 个边缘连通背景像素。`
          : `边缘背景置信度 ${Math.round(prepared.backgroundConfidence * 100)}%，为避免误删已保留背景。`)
      }

      const taskId = crypto.randomUUID()
      const worker = new Worker(new URL('./workers/generate.worker.ts', import.meta.url), { type: 'module' })
      workerRef.current = worker
      taskIdRef.current = taskId
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data
        if (message.taskId !== taskIdRef.current) return
        if (message.type === 'progress') {
          if (message.stage === 'matching') {
            setProgress(18 + message.progress * 42)
            setProgressLabel('CIEDE2000 匹配 MARD 色号')
          } else if (message.stage === 'optimizing') {
            setProgress(60 + message.progress * 27)
            setProgressLabel('优化真实 MARD 调色板子集')
          } else {
            setProgress(88 + message.progress * 9)
            setProgressLabel('清理小区域并保护轮廓')
          }
          return
        }
        worker.terminate()
        workerRef.current = null
        taskIdRef.current = null
        setIsGenerating(false)
        if (message.type === 'error') {
          setActionError(`${message.message} 请降低图纸宽度或换一张图片后重试。`)
          return
        }
        setProgress(100)
        setProgressLabel('图纸生成完成')
        setResult(message.result)
        window.setTimeout(() => document.querySelector('#result-step')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
      }
      worker.onerror = () => {
        if (taskIdRef.current !== taskId) return
        worker.terminate()
        workerRef.current = null
        taskIdRef.current = null
        setIsGenerating(false)
        setActionError('生成 Worker 启动失败。请刷新页面后重试；若仍失败，请降低图纸宽度。')
      }
      worker.postMessage({ type: 'generate', taskId, grid: sampledGrid, settings }, [sampledGrid.data.buffer])
    } catch (error) {
      setIsGenerating(false)
      setActionError(error instanceof Error ? `${error.message} 请降低图片或图纸尺寸后重试。` : '图片处理失败，请换一张图片后重试。')
    }
  }

  const exportBaseName = (current: GenerationResult) =>
    `mard-${MODE_FILE_LABEL[current.mode]}-${current.width}x${current.height}-${timestampForFilename()}`

  const withExportError = async (kind: string, action: () => Promise<void>) => {
    if (!result) return
    setExporting(kind)
    setActionError(null)
    try {
      await action()
    } catch (error) {
      setActionError(error instanceof Error ? `${error.message} 可以降低图纸宽度后重试导出。` : '导出失败，请重试。')
    } finally {
      setExporting(null)
    }
  }

  const resultPalette = result ? getPalette(result.paletteId) : []

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#top" aria-label="返回 MARD 拼豆图纸生成器顶部">
            <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
            <span><strong>MARD</strong><small>BEAD LAB</small></span>
          </a>
          <nav aria-label="页面导航">
            <a href="#workflow">开始生成</a>
            <a href="#about">算法与来源</a>
            <a href="https://github.com/Archmays/mard-bead-generator" target="_blank" rel="noreferrer">GitHub</a>
          </nav>
        </div>
        <div className="bead-rail" aria-hidden="true">{Array.from({ length: 34 }, (_, index) => <i key={index} />)}</div>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="local-stamp">LOCAL / 本机处理</span>
            <p className="eyebrow">图片 → 真实 MARD 色号 → 可打印图纸</p>
            <h1 id="hero-title">把一张图片，<br /><span>排成每颗都认得的豆。</span></h1>
            <p className="hero-intro">不是像素滤镜，也不是逐格编辑器。区域采样、感知色差和受限调色板优化，在浏览器里直接生成可铺、可统计、可打印的 MARD 图纸。</p>
            <a className="hero-action" href="#workflow">选择图片开始 <span aria-hidden="true">↓</span></a>
            <ul className="hero-facts" aria-label="产品要点">
              <li><strong>221 / 291</strong><span>完整可追溯色板</span></li>
              <li><strong>3 种</strong><span>确定性生成策略</span></li>
              <li><strong>0 上传</strong><span>原图不离开设备</span></li>
            </ul>
          </div>
          <div className="hero-board" aria-label="拼豆图纸示意">
            <div className="board-label"><span>样张 00</span><span>8 × 8</span></div>
            <div className="hero-mosaic">
              {heroPattern.map((color, index) => <i key={index} className={`hero-bead bead-${color}`} />)}
            </div>
            <div className="board-caption"><span>每格 = 1 颗</span><strong>A14 · B7 · C8 · H7</strong></div>
          </div>
        </section>

        <section className="workflow" id="workflow" aria-label="三步生成流程">
          <div className="workflow-line" aria-hidden="true" />
          <section className="step-card upload-card">
            <StepTitle number="01" title="上传与图片范围" description="选择图片，拖动位置，再决定适应或填满。" />
            <ImageWorkspace source={source} layout={layout} outputWidth={grid.width} outputHeight={grid.height} error={fileError} onFile={handleFile} onLayout={setLayout} />
          </section>

          <section className="step-card settings-card">
            <StepTitle number="02" title="生成设置" description="选择相似度、颜色数量与铺豆规模。" />
            <SettingsPanel
              settings={settings}
              gridWidth={grid.width}
              gridHeight={grid.height}
              beadSize={beadSize}
              backgroundMode={backgroundMode}
              isGenerating={isGenerating}
              progress={progress}
              progressLabel={progressLabel}
              canGenerate={Boolean(source)}
              onSettings={setSettings}
              onGridWidth={setGridWidth}
              onBeadSize={setBeadSize}
              onBackgroundMode={setBackgroundMode}
              onGenerate={startGeneration}
              onCancel={() => cancelGeneration(true)}
            />
          </section>

          {(statusNote || actionError) && (
            <div className={`global-message ${actionError ? 'is-error' : ''}`} role={actionError ? 'alert' : 'status'}>
              <strong>{actionError ? '没有完成' : '处理说明'}</strong><span>{actionError ?? statusNote}</span>
            </div>
          )}

          <section className="step-card result-card" id="result-step">
            <StepTitle number="03" title="查看、统计与导出" description="色号、坐标、用量与打印文件都在这里。" />
            {result && source ? (
              <ResultPanel
                result={result}
                palette={resultPalette}
                source={source}
                beadSize={beadSize}
                packSize={packSize}
                exporting={exporting}
                onPackSize={setPackSize}
                onDownloadPreview={(showGrid) => withExportError('preview', async () => {
                  const canvas = renderBeadPreview(result, resultPalette, { cellSize: 32, showGrid })
                  downloadBlob(await canvasToBlob(canvas), `${exportBaseName(result)}-preview.png`)
                })}
                onDownloadChart={() => withExportError('chart', async () => {
                  const canvas = renderCodeChart(result, resultPalette, { cellSize: 44 })
                  downloadBlob(await canvasToBlob(canvas), `${exportBaseName(result)}-codes.png`)
                })}
                onDownloadPdf={() => withExportError('pdf', async () => {
                  const { createPatternPdf } = await import('./render/exportPdf')
                  const blob = await createPatternPdf(result, resultPalette, { sourceImage: source.bitmap, sourceWidth: source.width, sourceHeight: source.height, beadSizeMm: beadSize, packSize })
                  downloadBlob(blob, `${exportBaseName(result)}.pdf`)
                })}
                onDownloadCsv={() => withExportError('csv', async () => {
                  downloadBlob(createUsageCsv(result, resultPalette, packSize), `${exportBaseName(result)}-usage.csv`)
                })}
              />
            ) : (
              <div className="result-empty"><span aria-hidden="true">03</span><div><strong>图纸还没生成</strong><p>上传图片并完成第二步，结果会在这里展开。</p></div></div>
            )}
          </section>
        </section>

        <section className="about" id="about">
          <div><p className="eyebrow">为什么不是普通缩图</p><h2>先看一个格子里发生了什么，再决定放哪颗豆。</h2></div>
          <ol>
            <li><strong>区域采样</strong><span>每格自适应多点读取；高方差边缘优先主导色，减少灰色毛边。</span></li>
            <li><strong>感知匹配</strong><span>颜色进入 CIELAB，最终候选用 CIEDE2000 排序，不拿 RGB 直线距离冒充视觉相似。</span></li>
            <li><strong>真实色号子集</strong><span>少色模式从当前 MARD 色板直接选 medoid，结果不会出现买不到的虚拟中心色。</span></li>
            <li><strong>可解释清理</strong><span>4 邻域识别小区域，用色差增量、轮廓和饱和度门槛保护关键细节。</span></li>
          </ol>
        </section>
      </main>

      <footer>
        <div><strong>MARD BEAD LAB</strong><span>本地优先的拼豆图纸生成器 · 不是逐格编辑器</span></div>
        <p>色板版本 {MARD_PALETTE_VERSION} · <a href={MARD_SOURCE_URL} target="_blank" rel="noreferrer">查看固定数据来源</a> · <a href="https://github.com/Archmays/mard-bead-generator/blob/main/docs/research-and-attribution.md" target="_blank" rel="noreferrer">研究与归属</a></p>
      </footer>

      <aside className="brand-disclaimer">
        MARD 色号和屏幕颜色用于图纸匹配参考。实体颜色可能因光线、屏幕、材料效果和生产批次不同而存在差异。本项目与 MARD 品牌方无隶属或官方合作关系。
      </aside>
    </>
  )
}

export default App
