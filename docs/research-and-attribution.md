# 调研、数据来源与 clean-room 边界

调研日期：2026-08-06。本文只记录会影响本项目实现的结论。

## MARD 色板数据

主数据采用 [maxcleme/beadcolors](https://github.com/maxcleme/beadcolors) 的 `raw/mard.csv`：

- 固定提交：`29229889daab404fb30531d4bb785fd73f7f58e3`
- 固定文件：[`raw/mard.csv`](https://github.com/maxcleme/beadcolors/blob/29229889daab404fb30531d4bb785fd73f7f58e3/raw/mard.csv)
- 许可证：MIT；版权 `Copyright (c) 2020 maxcleme`
- 采用内容：291 个 MARD 色号及其 RGB 数值；HEX 由 RGB 机械转换。

`src/data/mard-291.json` 保留全部 291 色。`src/data/mard-221.json` 是其中 A、B、C、D、E、F、G、H、M 九系列的严格子集，共 221 色；P、Q、R、T、Y、ZG 六系列构成 70 个扩展色，没有伪造差异或混合不同来源数值。

交叉核对：

- [Jett-Wu/Perler_Beads_Generator](https://github.com/Jett-Wu/Perler_Beads_Generator/tree/36ac52d570246ab600611a79edd2236bccb954e5) 的 MIT `src/palette.ts` 同样列出 221 基础色及 70 扩展色；逐项色号与 HEX 和主数据一致。这里只用于核对，没有复制其算法、组件或 UI。
- [TryPetRelic MARD 291 色卡](https://trypetrelic.com/zh/mard-bead-color-chart.html) 显示 291 色，注明数据来自 `maxcleme/beadcolors`，并把扩展系列解释为 P 珠光、Q/Y 荧光、R 特殊、T 透明、ZG 夜光。
- [拼豆工具站色卡](https://www.pindou.online/colors) 同样说明 221 基础版为 A–M 九系列，291 完整版增加 P/Q/R/T/Y/ZG，页面列出的色号与 HEX 与主数据一致。
- [豆豆工坊 221 色卡](https://www.doudougongfang.com/kb/beads/mard-palette) 收录 221 色，但部分屏幕 HEX 与主数据存在小幅差异，例如 A1 为 `#FAF5CD`，而主数据为 `#FAF4C8`。本项目不混合这些数值，继续使用许可证清晰、内部一致且可固定 SHA 的主数据。

主 CSV 没有材料字段。P/Q/T/Y/ZG 的材料标签来自上述独立色卡的系列说明；R 只标为“特殊”，因此 JSON 中保守记录为 `unknown`，不猜测具体材质。所有屏幕 HEX 都只是近似显示，不能替代实体色卡。

## 指定网站的功能观察

- [七卡瓦拼豆底稿生成器](https://perlerbeads.zippland.com/)：公开页面和 README 展示本地处理、主导色采样、边缘背景洪水填充、连通区域清理、导出及编辑工作台。项目源代码为 AGPL-3.0（LICENSE 还带有项目自定义前言）。本项目只观察一般功能边界，未复制、改写或移植其代码、CSS、组件、资产、JSON、营销文案或独特 UI。
- [PixelBeads gallery](https://pixelbeads.app/gallery)：画廊页为动态应用，调研时公开抓取没有稳定的实现细节；只确认其定位包含作品浏览/编辑。画廊、账号、社区均明确不进入本项目。
- [Pixel-Beads 图纸生成器](https://www.pixel-beads.com/zh/perler-bead-pattern-generator)：页面展示 52/104 宽度、5 mm/2.6 mm、辅助格和坐标等常见能力，也包含手动绘制。只借鉴常规需求分类，没有复制品牌、文案、视觉或实现；本项目明确不做逐格编辑。

## 指定公开仓库与许可证门禁

| 仓库 | 固定提交 | 实际许可证结论 | 本项目处理 |
|---|---|---|---|
| `Zippland/perler-beads` | `2efee730f73dd4eb472ebde443a022d11f98bc21` | LICENSE 为 AGPL-3.0 正文并含项目声明 | 只观察 README 功能；不读取并复用源实现，不复制任何数据或资产 |
| `Jett-Wu/Perler_Beads_Generator` | `36ac52d570246ab600611a79edd2236bccb954e5` | MIT | 只用 `src/palette.ts` 交叉核对主数据；未复制算法/UI |
| `zreecespieces/perler-pattern-generator` | `4d0c8004e53a74a68d766aa32785e160c3006602` | 仓库没有 LICENSE | 只看 README 功能描述；不复用代码或资产 |
| `KafukaTree/pindou-generator` | `e0e0bc103ce00c0edef8423808067be549643cf0` | 仓库没有 LICENSE | 不复用 |
| `Ebbelink/iron-on-beads-template-generator` | `e96616560d2fef89fbca20b2f966b8afbd9c2dba` | 仓库没有 LICENSE | 不复用 |

没有 LICENSE 不等于可自由复制，因此后三个仓库没有提供任何进入本项目的代码或资产。

## 技术决策

- 图像先在主线程安全缩放和排版，再对每个实际网格区域做 5×5/7×7 自适应多点采样；高方差区域使用主导色，连续区域使用线性 RGB 稳健平均。
- MARD HEX 预计算为 `lab65`；便宜的 Lab 欧氏距离只用于候选预筛，最终排序调用 [`culori` 的 `differenceCiede2000`](https://culorijs.org/api/)。ΔE00 测试使用 Sharma、Wu、Dalal 公开补充数据的已知数值对。
- 少色与平衡模式先把采样格确定性压缩为最多 128 个代表簇，再从真实 MARD 色号中做加权贪心 facility-location 选择和少量 swap refinement。最终不会产生虚拟 K-means 中心色。
- 背景移除仅用边缘颜色置信度、容差和 4 邻域洪水填充。边缘不一致时保守保留。
- 不启用抖动，不加入逐格编辑，不上传图片，不使用后端、分析脚本或运行时 CDN。
- GitHub Pages 的 `base` 在 Actions 中从 `GITHUB_REPOSITORY` 推导；部署 Action major 版本在 2026-08-06 依据 Vite 与 GitHub 官方文档及各 Action 最新稳定 release 核对。

完整第三方版权与许可说明见 [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md)。
