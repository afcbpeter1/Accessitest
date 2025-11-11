# FFmpeg Setup for Video Caption Generation

## Overview

Video caption generation uses **FFmpeg 8.0+** with built-in **Whisper AI** subtitling support. This allows automatic generation of captions from video audio.

## Installation

### 1. Install FFmpeg 8.0+ on Your System

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

#### macOS
```bash
brew install ffmpeg
```

#### Windows
Download from: https://ffmpeg.org/download.html
Or use Chocolatey:
```bash
choco install ffmpeg
```

### 2. Install Node.js Packages

```bash
npm install fluent-ffmpeg @ffmpeg-installer/ffmpeg
```

Or add to `package.json`:
```json
{
  "dependencies": {
    "fluent-ffmpeg": "^2.1.2",
    "@ffmpeg-installer/ffmpeg": "^1.1.0"
  }
}
```

### 3. Verify Installation

```bash
ffmpeg -version
```

Should show version 8.0 or higher.

## How It Works

1. **Detects videos without captions** in HTML documents
2. **Extracts audio** from video using ffmpeg
3. **Generates captions** using FFmpeg's Whisper integration
4. **Creates WebVTT file** (.vtt format)
5. **Links captions** to video element using `<track>` tag

## Supported Video Formats

- MP4
- WebM
- AVI
- MOV
- And other formats supported by FFmpeg

## Limitations

1. **Local files only**: Videos must be accessible as local files (not just URLs)
2. **FFmpeg 8.0+ required**: Whisper integration is only available in FFmpeg 8.0+
3. **Processing time**: Caption generation can take time depending on video length
4. **Remote videos**: Need to be downloaded first before processing

## Usage

The system automatically detects videos without captions and generates them during document repair. No manual configuration needed!

## Troubleshooting

### Error: "fluent-ffmpeg not installed"
```bash
npm install fluent-ffmpeg @ffmpeg-installer/ffmpeg
```

### Error: "FFmpeg not found"
- Ensure FFmpeg is installed and in your system PATH
- Or use `@ffmpeg-installer/ffmpeg` which includes FFmpeg binaries

### Error: "Whisper not available"
- Ensure FFmpeg 8.0+ is installed
- Check: `ffmpeg -version` should show 8.0 or higher

### Captions not generating
- Check video file is accessible
- Check video format is supported
- Check FFmpeg has Whisper support enabled

## Alternative: Cloud Speech-to-Text APIs

If FFmpeg is not available, you can integrate cloud APIs:
- Google Cloud Speech-to-Text
- AWS Transcribe
- Azure Speech Services
- OpenAI Whisper API

These require API keys and have usage costs.

