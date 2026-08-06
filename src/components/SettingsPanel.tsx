import type { BackgroundMode, GenerationSettings } from '../types'

interface SettingsPanelProps {
  settings: GenerationSettings
  gridWidth: number
  gridHeight: number
  beadSize: number
  backgroundMode: BackgroundMode
  isGenerating: boolean
  progress: number
  progressLabel: string
  canGenerate: boolean
  onSettings: (settings: GenerationSettings) => void
  onGridWidth: (width: number) => void
  onBeadSize: (size: number) => void
  onBackgroundMode: (mode: BackgroundMode) => void
  onGenerate: () => void
  onCancel: () => void
}

const modeOptions = [
  { id: 'balanced' as const, title: '平衡推荐', caption: '相似、少色、好铺豆之间取平衡', badge: '默认' },
  { id: 'closest' as const, title: '最接近原图', caption: '完整色板逐格寻找最低综合色差' },
  { id: 'minimal' as const, title: '最少颜色拼豆', caption: '用真实 MARD 色号压缩用色' },
]

export function SettingsPanel({
  settings,
  gridWidth,
  gridHeight,
  beadSize,
  backgroundMode,
  isGenerating,
  progress,
  progressLabel,
  canGenerate,
  onSettings,
  onGridWidth,
  onBeadSize,
  onBackgroundMode,
  onGenerate,
  onCancel,
}: SettingsPanelProps) {
  const physicalWidth = (gridWidth * beadSize / 10).toFixed(1)
  const physicalHeight = (gridHeight * beadSize / 10).toFixed(1)

  return (
    <div className="settings-panel">
      <fieldset className="field-group">
        <legend>生成策略</legend>
        <div className="mode-grid">
          {modeOptions.map((mode) => (
            <label className={`mode-card ${settings.mode === mode.id ? 'is-selected' : ''}`} key={mode.id}>
              <input
                type="radio"
                name="generation-mode"
                value={mode.id}
                checked={settings.mode === mode.id}
                onChange={() => onSettings({ ...settings, mode: mode.id })}
              />
              <span>
                <strong>{mode.title}{mode.badge && <em>{mode.badge}</em>}</strong>
                <small>{mode.caption}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="settings-grid">
        <fieldset className="field-group">
          <legend>MARD 色板</legend>
          <div className="segmented-control">
            {(['221', '291'] as const).map((paletteId) => (
              <label key={paletteId}>
                <input
                  type="radio"
                  name="palette"
                  value={paletteId}
                  checked={settings.paletteId === paletteId}
                  onChange={() => onSettings({ ...settings, paletteId })}
                />
                <span>{paletteId} 色{paletteId === '221' ? ' · 基础' : ' · 完整'}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field-group">
          <legend>拼豆尺寸</legend>
          <div className="segmented-control">
            {[5, 2.6].map((size) => (
              <label key={size}>
                <input type="radio" name="bead-size" checked={beadSize === size} onChange={() => onBeadSize(size)} />
                <span>{size.toFixed(1)} mm</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <fieldset className="field-group">
        <legend>图纸宽度</legend>
        <div className="width-controls">
          <div className="preset-row">
            {[29, 52, 72, 104].map((width) => (
              <button
                type="button"
                className={gridWidth === width ? 'is-active' : ''}
                key={width}
                onClick={() => onGridWidth(width)}
              >
                {width}
              </button>
            ))}
          </div>
          <label className="number-field">
            <span>自定义</span>
            <input
              type="number"
              min="10"
              max="200"
              value={gridWidth}
              onChange={(event) => onGridWidth(Math.max(10, Math.min(200, Number(event.currentTarget.value) || 10)))}
              aria-label="自定义图纸宽度，10 到 200 颗"
            />
            <span>颗</span>
          </label>
        </div>
        <p className="field-help">预计 {gridWidth} × {gridHeight} 格 · {physicalWidth} × {physicalHeight} cm</p>
      </fieldset>

      <label className="select-field">
        <span>背景处理</span>
        <select value={backgroundMode} onChange={(event) => onBackgroundMode(event.currentTarget.value as BackgroundMode)}>
          <option value="keep">保留背景</option>
          <option value="alpha-only">仅使用原图透明背景</option>
          <option value="edge-remove">尝试移除边缘纯色背景</option>
        </select>
        <small>{backgroundMode === 'edge-remove' ? '仅适合纯色或近纯色背景；边缘颜色不一致时会保守地不移除。' : 'PNG / WebP 中低透明度区域会作为空格，不计入用量。'}</small>
      </label>

      {settings.mode === 'minimal' && (
        <fieldset className="field-group color-limit" data-testid="color-limit">
          <legend>最大颜色数</legend>
          <div className="chip-options">
            {(['auto', 4, 6, 8, 12, 16, 24] as const).map((limit) => (
              <label key={limit}>
                <input
                  type="radio"
                  name="color-limit"
                  checked={settings.maxColors === limit}
                  onChange={() => onSettings({ ...settings, maxColors: limit })}
                />
                <span>{limit === 'auto' ? '自动' : limit}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="generation-zone">
        {isGenerating ? (
          <>
            <div className="progress-copy">
              <strong>{progressLabel}</strong>
              <output>{Math.round(progress)}%</output>
            </div>
            <div className="progress-track" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${progress}%` }} />
            </div>
            <button type="button" className="secondary-button cancel-button" onClick={onCancel}>取消生成</button>
          </>
        ) : (
          <button
            type="button"
            className="generate-button"
            disabled={!canGenerate}
            onClick={onGenerate}
            data-testid="generate-button"
          >
            <span>生成 MARD 图纸</span>
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </div>
  )
}
