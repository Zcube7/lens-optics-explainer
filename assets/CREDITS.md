# 取景器场景素材

这个目录里的模型、贴图和全景图全部来自 [Poly Haven](https://polyhaven.com)，授权是 CC0（公有领域，可自由使用，不要求署名）。
文件是 2026-11-16 从 Poly Haven 官方下载的。

| 用途 | 素材 | 规格 | 页面 |
|---|---|---|---|
| 环境光与背景 | Shanghai Bund | 8k 全景 JPG + 1k HDR | <https://polyhaven.com/a/shanghai_bund> |
| 主体 | Marble Bust 01 | glTF，2k 贴图 | <https://polyhaven.com/a/marble_bust_01> |
| 路灯 | Street Lamp 01 | glTF | <https://polyhaven.com/a/street_lamp_01> |
| 提灯 | Lantern 01 | glTF | <https://polyhaven.com/a/Lantern_01> |
| 盆栽 | Potted Plant 02 | glTF | <https://polyhaven.com/a/potted_plant_02> |
| 猫石像 | Concrete Cat Statue | glTF | <https://polyhaven.com/a/concrete_cat_statue> |

为了让页面加载得快，做过这些处理（脚本化缩放，没有改内容）：

- `env/shanghai_bund_preview.jpg`：全景缩到 2048×1024 的预览版，页面先用它出画面，8k 原图随后替换。
- `models/marble_bust_01/` 里的 `*_1k.jpg` 和 `marble_bust_01_1k.gltf`：胸像贴图的 1k 版，同样用于先出画面，2k 原图随后替换。
- 路灯、提灯、盆栽、猫石像的贴图从 1k 缩到了 512（文件名没变）。它们在画面里很小，而且多数时候是虚的。

渲染用的 three.js（r180，MIT 许可）在 `vendor/` 目录，许可证原文见 `vendor/LICENSE`。
