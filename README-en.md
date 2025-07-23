<div align=center>
  <h1>AI Video Generation Tool</h1>
  <p><a href="./README.md">中文</a> | English</p>
</div>

An intelligent video generation tool built on OOMOL Blocks, integrating multiple AI services to automatically generate complete videos with images, audio, and subtitles from text scripts. Supports caching mechanisms and resume functionality to ensure stable and reliable generation process.

## ✨ Features

- 🎬 **Script Parsing**: Automatically parse structured text scripts and extract scene information
- 🖼️ **AI Image Generation**: OOMOL AI automatically generates scene images
- 🎵 **AI Speech Synthesis**: OOMOL AI automatically converts narration to high-quality speech
- 📝 **Intelligent Subtitles**: Automatically generate subtitles
- 🎥 **Video Segment Generation**: Doubao AI converts images to videos
- ⚡ **Caching Mechanism**: Built-in caching system with resume functionality
- 📁 **File Management**: Temporary file management and automatic cleanup

## 🏗️ System Architecture

### Core Architecture Diagram

```
Text Script → Script Parsing → Image Generation → Audio Generation → Subtitle Generation → Video Generation → Video Merging
                      ↓        ↓                  ↓
                           Cache System ← → File Management
```

### Core Logic Structure

```
core/
├── ScriptParser.ts      # Script parser
├── ImageGenerator.ts    # Image generator
├── AudioGenerator.ts    # Audio generator
├── SubtitleGenerator.ts # Subtitle generator
├── VideoGenerator.ts    # Video generator
├── VideoProcessor.ts    # Resource synthesizer
└── FFmpegExecutor.ts    # FFmpeg base class

cache/                   # Business layer cache logic
├── CacheManager         # File-based cache management center
├── image                # Image cache logic
├── audio                # Audio cache logic
├── subtitle             # Subtitle cache logic
├── video                # Video cache logic
└── processor            # Resource merging cache logic

file/
├── FileManager          # Temporary file management center
└── index                # Business layer application of temporary files
```

## 🚀 Quick Start

### Installation

1. Download OOMOL from [official website](https://oomol.com/zh-CN/downloads/)
2. Search for `story-to-book` in the `Community` module
3. `Use` the plugin
4. Complete parameter configuration in the `converter` workflow
5. Run and wait for results

### Configure API Keys

You need to configure the following API services before use:

```typescript
const config = {
  // Image generation API (OOMOL)
  imageConfig: {
    apiKey: "your-oomol-api-key",
    apiEndpoint: "https://console.oomol.com/v1/images/generations",
    model: "doubao-seedream-3-0-t2i-250415"
  },
    
  // Audio generation API (OOMOL)
  audioConfig: {
    apiKey: "your-oomol-api-key",
    apiEndpoint: "https://console.oomol.com/v1/audio/speech",
    model: "FunAudioLLM/CosyVoice2-0.5B"
  },
  
  // Video generation API (Doubao, Doubao-Seedance-1.0-lite-i2v model)
  videoConfig: {
    apiKey: "your-doubao-api-key"
  }
};
```

### API Service Application

#### OOMOL AI (Image Generation, Audio Generation)

* `imageConfig.apiKey`: [API Key Generation URL](https://console.oomol.com/panel/api-key)
  * Model: Doubao-Seedream-3.0-T2I
* `audioConfig.apiKey`: [API Key Generation URL](https://console.oomol.com/panel/api-key)
  * Model: FunAudioLLM/CosyVoice2-0.5B

#### Doubao AI (Video Generation)

* `videoConfig.apiKey`: [API Key Generation URL](https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey?apikey=%7B%7D)
* Enable Model: [Doubao-Seedance-1.0-lite-i2v](https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement?LLM=%7B%7D&OpenTokenDrawer=false&tab=ComputerVision)

## 🆘 Support

If you encounter problems or need help:

- 📧 Email: honeysyt@gmail.com
- 🐛 Issue Feedback: [GitHub Issues](https://github.com/oomol-blocks/story-to-video/issues)
- 📖 WeChat Group Support: [WeChat Group Support](https://oomol.com/img/qrcode@3x.png)
