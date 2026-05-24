# 模型文件目录 / Model Files Directory

## 目录结构 / Directory Structure

```
models/
├── builtin/                          # 内置模型（随项目分发，已提交 Git）
│   └── Xenova/
│       └── bge-small-zh-v1.5/        # BGE Small ZH v1.5 (~26MB)
│           ├── config.json
│           ├── tokenizer.json
│           └── onnx/
│               └── model_quantized.onnx
│
└── custom/                           # 自定义模型（用户自行添加，不提交 Git）
    └── Xenova/
        └── 你的模型名/               # e.g. multilingual-e5-small
            ├── config.json
            ├── tokenizer.json
            └── onnx/
                └── model_quantized.onnx
```

## 下载模型 / Download Models

推荐从 Hugging Face 下载 Xenova 量化版模型（已包含 INT8 量化的 ONNX 文件）：

| 模型 | 大小 | 适用场景 | 下载地址 |
|------|------|---------|---------|
| BGE Small ZH v1.5 | ~26MB | 中文最佳 / Best for Chinese | [Xenova/bge-small-zh-v1.5](https://huggingface.co/Xenova/bge-small-zh-v1.5) |
| Multilingual E5 Small | ~120MB | 多语言 / Multi-language | [Xenova/multilingual-e5-small](https://huggingface.co/Xenova/multilingual-e5-small) |
| All-MiniLM-L6-v2 | ~23MB | 英文最佳 / Best for English | [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) |
| MiniLM L12 v2 | ~120MB | 50+语言深度理解 / Deep multilingual | [Xenova/paraphrase-multilingual-MiniLM-L12-v2](https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2) |
| GTE Small | ~70MB | 中英文均衡 / Balanced CN/EN | [Xenova/gte-small](https://huggingface.co/Xenova/gte-small) |

每个模型需下载 3 个文件 / Each model needs 3 files:
1. `config.json`
2. `tokenizer.json`
3. `onnx/model_quantized.onnx`

## 使用 / Usage

1. 放置模型文件到对应目录 / Place model files in the corresponding directory
2. 打开设置页 → 本地检索引擎 → 点击"扫描"检测自定义模型
3. 选择模型后，下次打开小说即可生效
