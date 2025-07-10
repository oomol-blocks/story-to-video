<div align=center>
  <h1>AI Video Generation Tool</h1>
  <p><a href="./README.md">中文</a> | English</p>
</div>

An automated video generation tool built on OOMOL Blocks that integrates multiple AI services to automatically create complete videos with images, audio, and subtitles from text scripts.

## ✨ Features

- 🎬 **Script Parsing**: Automatically parse structured text scripts and extract scene information
- 🖼️ **AI Image Generation**: Automatically generate scene images based on visual prompts
- 🎵 **AI Speech Synthesis**: Convert narration text into high-quality speech
- 📝 **Intelligent Subtitles**: Automatically generate multi-format subtitle files (SRT/ASS/VTT)
- 🎥 **Video Composition**: Use Doubao AI to convert images to video and composite with audio and subtitles
- ⚡ **Batch Processing**: Support batch generation and merging of multiple scenes
- 🔧 **Precise Duration Control**: Extend audio to specified duration to ensure video synchronization

## 🚀 Quick Start

### Installation

1. Search for `story-to-book` in the community
2. Install the plugin
3. `Use` the plugin
4. Input documents in the converter flow

### Configure API Keys

Create configuration files or environment variables:

**Doubao AI**

* `API_KEY` [Generation URL](https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey?apikey=%7B%7D)
* Enable text-to-image model: [Doubao-Seedream-3.0-t2i](https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement?LLM=%7B%7D&OpenTokenDrawer=false&tab=ComputerVision)
* Enable image-to-video model: [Doubao-Seedance-1.0-lite-i2v](https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement?LLM=%7B%7D&OpenTokenDrawer=false&tab=ComputerVision)

**ohMyGPT**

* `API_KEY` [Generation URL](https://www.ohmygpt.com/settings)

```typescript
const config = {
  // Image generation API
  imageConfig: {
    apiKey: "your-doubao-api-key",
    apiEndpoint: "https://ark.cn-beijing.volces.com/api/v3/images/generations",
    model: "doubao-seedream-3-0-t2i-250415",
    size: "720x1280"
  },
  
  // Speech synthesis API. Currently using ohMyGPT tts-1 model.
  audioConfig: {
    apiKey: "your-tts-api-key",
    apiEndpoint: "https://cn2us02.opapi.win/v1/audio/speech",
    model: "tts-1",
    voice: "alloy"
  },
  
  // Video generation API (Doubao)
  videoConfig: {
    apiKey: "your-doubao-api-key",
    size: "1280x720",
    format: "mp4"
  }
};
```

## 📁 Project Structure

```
src/
├── ScriptParser.ts      # Script parser
├── ImageGenerator.ts    # Image generator
├── AudioGenerator.ts    # Audio generator
├── AudioExtender.ts     # Audio extender
├── SubtitleGenerator.ts # Subtitle generator
├── VideoGenerator.ts    # Video generator
├── FFmpegExecutor.ts    # FFmpeg base class
└── constants.ts         # Type definitions and constants
```

### 🏗️ Architecture Design

```
Text Script → Script Parsing → Image Generation → Audio Generation → Audio Extension → Subtitle Generation → Video Generation → Video Merging
```

![Basic Logic](./image.png)

### Core Modules

| Module | Function | Input | Output |
|--------|----------|-------|--------|
| `ScriptParser` | Parse script files | Structured text | Scene data |
| `ImageGenerator` | Generate scene images | Visual prompts | Image files |
| `AudioGenerator` | Generate speech | Narration text | Audio files |
| `AudioExtender` | Extend audio duration | Audio files | Standardized duration audio |
| `SubtitleGenerator` | Generate subtitles | Text content | Subtitle files |
| `VideoGenerator` | Generate final video | All resources | Complete video |

## 🆘 Support

If you encounter problems or need help:

- 📧 Email: honeysyt@gmail.com
- 🐛 Issue Reports: [GitHub Issues](https://github.com/oomol-blocks/story-to-video/issues)
- 📖 WeChat Group Support: [WeChat Group Support](https://oomol.com/img/qrcode@3x.png)