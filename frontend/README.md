# FonoaudiologIA Frontend

Progressive Web App (PWA) frontend for speech therapy application. Built with React, TypeScript, and Vite.

## Features

- 🎤 Audio recording with MediaRecorder API
- 📤 Audio file upload with drag-and-drop support
- 🌐 Spanish and English language support
- 📱 Progressive Web App (PWA) - installable and works offline
- 🎨 Modern UI with Tailwind CSS
- 🔒 Type-safe with TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
frontend/
├── public/
│   ├── manifest.json      # PWA manifest
│   └── icons/             # PWA icons
├── src/
│   ├── components/        # React components
│   ├── hooks/            # Custom React hooks
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   ├── App.tsx           # Main app component
│   └── main.tsx          # Entry point
└── vite.config.ts        # Vite configuration with PWA plugin
```

## Components

- **AudioRecorder**: Record audio using device microphone
- **AudioUploader**: Upload audio files with drag-and-drop
- **AudioPlayer**: Playback audio with controls
- **LanguageSelector**: Toggle between Spanish and English

## Backend Integration

The app is structured to easily integrate with a backend API. Audio recordings are prepared as `FormData` objects ready to be sent via `fetch` or `axios`.

## PWA Features

- Installable on mobile and desktop
- Offline support via service worker
- App-like experience when installed

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari (iOS 14.3+)
- Opera

## License

MIT

