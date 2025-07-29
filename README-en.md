<div align=center>
  <h1>AI Video Generation Tool</h1>
  <p><a href="./README.md">中文</a> | English</p>
</div>

An intelligent video generation tool built on OOMOL Blocks, using multiple AI services integrated by OOMOL to automatically generate complete videos with images, audio, and subtitles from text scripts. Features caching mechanisms and resume capability to ensure stable and reliable generation process.

## ✨ Features

- 🎬 **Script Parsing**: Automatically parse structured text scripts and extract scene information
- 🖼️ **AI Image Generation**: OOMOL AI automatically generates scene images
- 🎵 **AI Speech Synthesis**: OOMOL AI automatically converts narration to high-quality speech
- 📝 **Intelligent Subtitles**: Automatically generate subtitles
- 🎥 **Video Segment Generation**: OOMOL AI converts images to video
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
  // Image generation API
  imageConfig: {
    apiKey: "your-oomol-api-key",
    apiEndpoint: "https://console.oomol.com/v1/images/generations",
    model: "doubao-seedream-3-0-t2i-250415"
  },
    
  // Audio generation API
  audioConfig: {
    apiKey: "your-oomol-api-key",
    apiEndpoint: "https://console.oomol.com/v1/audio/speech",
    model: "FunAudioLLM/CosyVoice2-0.5B",
    voice: "FunAudioLLM/CosyVoice2-0.5B:anna"
  },
  
  // Video generation API
  videoConfig: {
    apiKey: "your-oomol-api-key",
    apiEndpoint: "https://console.oomol.com/v1",
    model: "doubao-seedance-1-0-lite-i2v-25042"
  }
};
```

### Get API Key Generation Links

* `imageConfig.apiKey`: [API Key Generation URL](https://console.oomol.com/panel/api-key)
  * Model: Doubao-Seedream-3.0-T2I
* `videoConfig.apiKey`: [API Key Generation URL](https://console.oomol.com/panel/api-key)
  * Model: doubao-seedance-1-0-lite-i2v-25042
* `audioConfig.apiKey`: [API Key Generation URL](https://console.oomol.com/panel/api-key)
  * Model: FunAudioLLM/CosyVoice2-0.5B


## 🆘 Support

If you encounter problems or need help:

- 📧 Email: honeysyt@gmail.com
- 🐛 Issue Feedback: [GitHub Issues](https://github.com/oomol-blocks/story-to-video/issues)
- 📖 WeChat Group Support: [WeChat Group Support](https://oomol.com/img/qrcode@3x.png)
