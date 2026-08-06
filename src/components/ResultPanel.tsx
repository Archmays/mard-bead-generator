import { useMemo, useState } from 'react'
import { getUsageRows } from '../core/metrics'
import { renderBeadPreview } from '../render/renderBeadPreview'
import { renderCodeChart } from '../render/renderCodeChart'
import { CanvasSurface } from './CanvasSurface'
import type { GenerationResult, MardColor } from '../types'
import type { LoadedImage } from './ImageWorkspace'

interface ResultPanelProps {
  result: GenerationResult
  palette: MardColor[]
  source: LoadedImage
  beadSize: number
  packSize: number
  exporting: string | null
  onPackSize: (size: number) => void
  onDownloadPreview: (showGrid: boolean) => void
  onDownloadChart: () => void
  onDownloadPdf: () => void
  onDownloadCsv: () => void
}

const MODE_LABELS = {
  balanced: '平衡推荐',
  closest: '最接近原图',
  minimal: '最少颜色拼豆',
}

function OriginalThumbnail({ source }: { source: LoadedImage }) {
  const canvas = useMemo(() => {
    const target = document.createElement('canvas')
    target.width = 720
    target.height = Math.max(1, Math.round(720 * source.height / source.width))
    const context = target.getContext('2d')
    if (context) {
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.drawImage(source.bitmap, 0, 0, target.width, target.height)
    }
    return target
  }, [source])
  return <CanvasSurface source={canvas} label="原图缩略图" className="comparison-canvas" />
}

export function ResultPanel({
  result,
  palette,
  source,
  beadSize,
  packSize,
  exporting,
  onPackSize,
  onDownloadPreview,
  onDownloadChart,
  onDownloadPdf,
  onDownloadCsv,
}: ResultPanelProps) {
  const [chartZoom, setChartZoom] = useState(0.8)
  const [usageSort, setUsageSort] = useState<'count' | 'code'>('count')
  const [previewGrid, setPreviewGrid] = useState(false)
  const beadCanvas = useMemo(
    () => renderBeadPreview(result, palette, { cellSize: 22, showGrid: previewGrid, opaqueBackground: true }),
    [palette, previewGrid, result],
  )
  const chartCanvas = useMemo(
    () => renderCodeChart(result, palette, { cellSize: result.width > 120 ? 30 : 38 }),
    [palette, result],
  )
  const usage = useMemo(() => {
    const rows = getUsageRows(result, palette)
    return rows.sort((first, second) => usageSort === 'count'
      ? second.count - first.count || first.code.localeCompare(second.code, 'en', { numeric: true })
      : first.code.localeCompare(second.code, 'en', { numeric: true }))
  }, [palette, result, usageSort])
  const physicalWidth = (result.width * beadSize / 10).toFixed(1)
  const physicalHeight = (result.height * beadSize / 10).toFixed(1)

  return (
    <div className="result-panel" data-testid="result-panel">
      <div className="result-summary">
        <div>
          <span>图纸</span>
          <strong>{result.width} × {result.height}</strong>
          <small>颗</small>
        </div>
        <div>
          <span>拼豆总数</span>
          <strong>{result.beadCount.toLocaleString('zh-CN')}</strong>
          <small>非空格</small>
        </div>
        <div data-testid="color-count">
          <span>实际颜色</span>
          <strong>{result.colorCount}</strong>
          <small>{result.autoSelectedK ? `自动目标 ${result.autoSelectedK}` : `MARD ${result.paletteId}`}</small>
        </div>
        <div>
          <span>预计成品</span>
          <strong>{physicalWidth} × {physicalHeight}</strong>
          <small>cm · {beadSize.toFixed(1)} mm 豆</small>
        </div>
        <div>
          <span>平均 ΔE00</span>
          <strong>{result.metrics.mean.toFixed(2)}</strong>
          <small>屏幕近似色匹配误差</small>
        </div>
        <div>
          <span>P95 ΔE00</span>
          <strong>{result.metrics.p95.toFixed(2)}</strong>
          <small>95% 格子的误差不高于此值</small>
        </div>
      </div>

      <div className="result-meta-line">
        <span>{MODE_LABELS[result.mode]}</span>
        <span>MARD {result.paletteId}</span>
        <span>确定性校验 {result.deterministicHash}</span>
      </div>

      <div className="comparison-grid">
        <figure>
          <figcaption>原图</figcaption>
          <div className="comparison-frame"><OriginalThumbnail source={source} /></div>
        </figure>
        <figure>
          <figcaption>
            拼豆效果
            <label className="inline-toggle">
              <input type="checkbox" checked={previewGrid} onChange={(event) => setPreviewGrid(event.currentTarget.checked)} />
              <span>细网格</span>
            </label>
          </figcaption>
          <div className="comparison-frame checker"><CanvasSurface source={beadCanvas} label="圆形中空拼豆效果图" className="comparison-canvas" /></div>
        </figure>
      </div>

      <section className="chart-section" aria-labelledby="chart-heading">
        <div className="section-bar">
          <div>
            <h3 id="chart-heading">色号图纸</h3>
            <p>每格显示 MARD 色号；5 格辅助线，10 格粗线。</p>
          </div>
          <label className="chart-zoom">
            <span>预览缩放 {Math.round(chartZoom * 100)}%</span>
            <input type="range" min="0.35" max="1.5" step="0.05" value={chartZoom} onChange={(event) => setChartZoom(Number(event.currentTarget.value))} />
          </label>
        </div>
        <div className="chart-scroll" data-testid="chart-scroll">
          <CanvasSurface source={chartCanvas} label="带 MARD 色号与绝对坐标的铺豆图纸" className="code-chart-canvas" scale={chartZoom} />
        </div>
      </section>

      <section className="usage-section" aria-labelledby="usage-heading">
        <div className="section-bar usage-bar">
          <div>
            <h3 id="usage-heading">MARD 用量</h3>
            <p>{usage.length} 个实际色号，共 {result.beadCount.toLocaleString('zh-CN')} 颗。</p>
          </div>
          <div className="usage-controls">
            <label className="number-field pack-field">
              <span>每包</span>
              <input type="number" min="1" max="100000" value={packSize} onChange={(event) => onPackSize(Math.max(1, Number(event.currentTarget.value) || 1))} />
              <span>颗</span>
            </label>
            <label className="select-inline">
              <span>排序</span>
              <select value={usageSort} onChange={(event) => setUsageSort(event.currentTarget.value as 'count' | 'code')}>
                <option value="count">按颗数</option>
                <option value="code">按色号</option>
              </select>
            </label>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>色块</th><th>MARD 色号</th><th>系列 / 名称</th><th>颗数</th><th>占比</th><th>预计包数</th></tr>
            </thead>
            <tbody>
              {usage.map((row) => (
                <tr key={row.code}>
                  <td><span className="color-swatch" style={{ backgroundColor: row.color.hex }} /></td>
                  <td><strong className="code-label">{row.code}</strong></td>
                  <td>{row.color.displayNameZh ?? row.code}</td>
                  <td>{row.count.toLocaleString('zh-CN')}</td>
                  <td>{(row.percentage * 100).toFixed(1)}%</td>
                  <td>{Math.ceil(row.count / packSize)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="downloads" aria-labelledby="download-heading">
        <div>
          <span className="download-kicker">带走图纸</span>
          <h3 id="download-heading">导出铺豆需要的全部文件</h3>
          <p>下载在本机生成，不会发送原图或图纸数据。</p>
        </div>
        <div className="download-grid">
          <button type="button" onClick={() => onDownloadPreview(previewGrid)} disabled={Boolean(exporting)} data-testid="download-preview">
            <strong>拼豆效果 PNG</strong><span>圆形中空豆视觉</span>
          </button>
          <button type="button" onClick={onDownloadChart} disabled={Boolean(exporting)} data-testid="download-chart">
            <strong>色号图纸 PNG</strong><span>坐标 + 5/10 格线</span>
          </button>
          <button type="button" onClick={onDownloadPdf} disabled={Boolean(exporting)} data-testid="download-pdf">
            <strong>{exporting === 'pdf' ? '正在制作 PDF…' : '分页图纸 PDF'}</strong><span>A4 概览 + 分片 + 用量</span>
          </button>
          <button type="button" onClick={onDownloadCsv} disabled={Boolean(exporting)} data-testid="download-csv">
            <strong>用量清单 CSV</strong><span>UTF-8 BOM</span>
          </button>
        </div>
      </section>
    </div>
  )
}
