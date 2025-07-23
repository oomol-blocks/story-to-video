<div align=center>
  <h1>AI 视频生成工具</h1>
  <p>中文 | <a href="./README-en.md">English</a></p>
</div>

一个基于 OOMOL Blocks 构建的智能视频生成工具，集成多个 AI 服务，可以从文本脚本自动生成包含图像、音频、字幕的完整视频。支持缓存机制和断点续传，确保生成过程稳定可靠。

## ✨ 特性

- 🎬 **脚本解析**: 自动解析结构化文本脚本，提取场景信息
- 🖼️ **AI 图像生成**: OOMOL AI 自动生成场景图像
- 🎵 **AI 语音合成**: OOMOL AI 自动将解说词转换为高质量语音
- 📝 **智能字幕**: 自动生成字幕
- 🎥 **视频段生成**: 豆包 AI 将图像转换为视频
- ⚡ **缓存机制**: 内置缓存系统，支持断点续传
- 📁 **文件管理**: 临时文件管理和自动清理

## 🏗️ 系统架构

### 核心架构图

```
文本脚本 → 脚本解析 → 图像生成 → 音频生成 → 字幕生成 → 视频生成 → 视频合并
                      ↓        ↓                  ↓
                           缓存系统 ← → 文件管理
```

### 核心逻辑结构

```
core/
├── ScriptParser.ts      # 脚本解析器
├── ImageGenerator.ts    # 图像生成器
├── AudioGenerator.ts    # 音频生成器
├── SubtitleGenerator.ts # 字幕生成器
├── VideoGenerator.ts    # 视频生成器
├── VideoProcessor.ts    # 资源合成器
└── FFmpegExecutor.ts    # FFmpeg 基础类

cache/                   # 业务层缓存逻辑
├── CacheManager         # 基于文件的缓存管理中心
├── image                # 图片缓存逻辑
├── audio                # 音频缓存逻辑
├── subtitle             # 字幕缓存逻辑
├── video                # 视频缓存逻辑
└── processor            # 合并资源缓存逻辑

file/
├── FileManager          # 临时文件管理中心
└── index                # 临时文件的业务层应用
```

## 🚀 快速开始

### 安装

1. [官网](https://oomol.com/zh-CN/downloads/)下载 OOMOL
2. `社区` 模块搜索 `story-to-book`
3. `Use` 该插件
4. 在 `converter` 工作流中完成参数的填写
5. 运行等待结果

### 配置 API 密钥

在使用前需要配置一下 API 服务：

```typescript
const config = {
    // 图像生成 API（OOMOL）
    imageConfig: {
        apiKey: "your-oomol-api-key",
        apiEndpoint: "https://console.oomol.com/v1/images/generations",
        model: "doubao-seedream-3-0-t2i-250415"
    },

    // 图像生成 API（OOMOL）
    audioConfig: {
        apiKey: "your-oomol-api-key",
        apiEndpoint: "https://console.oomol.com/v1/audio/speech",
        model: "FunAudioLLM/CosyVoice2-0.5B"
    },

    // 视频生成 API (豆包，Doubao-Seedance-1.0-lite-i2v 大模型)
    videoConfig: {
        apiKey: "your-doubao-api-key"
    }
};
```

### API 服务申请

#### OOMOL AI（图片生成、音频生成）

* `imageConfig.apiKey`: [API Key 生成地址](https://console.oomol.com/panel/api-key)
  * 模型：Doubao-Seedream-3.0-T2I

* `audioConfig.apiKey`: [API Key 生成地址](https://console.oomol.com/panel/api-key)
  * 模型：FunAudioLLM/CosyVoice2-0.5B

#### 豆包 AI（视频生成）

* `videoConfig.apiKey`: [API Key 生成地址](https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey?apikey=%7B%7D)
* 开通模型：[Doubao-Seedance-1.0-lite-i2v](https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement?LLM=%7B%7D&OpenTokenDrawer=false&tab=ComputerVision)


## 🆘 支持

如果遇到问题或需要帮助：

- 📧 邮箱: honeysyt@gmail.com
- 🐛 问题反馈: [GitHub Issues](https://github.com/oomol-blocks/story-to-video/issues)
- 📖 微信群支持: [微信群支持](https://oomol.com/img/qrcode@3x.png)
