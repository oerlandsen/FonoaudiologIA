import { useState } from 'react';
import { AudioRecorder } from './components/AudioRecorder';
import { AudioUploader } from './components/AudioUploader';
import { usePWA } from './hooks/usePWA';
import type { AudioRecording } from './types/audio';

function App() {
  const [currentRecording, setCurrentRecording] = useState<AudioRecording | null>(null);
  const { isInstallable, installApp } = usePWA();

  const handleRecordingComplete = (recording: AudioRecording) => {
    setCurrentRecording(recording);
    // TODO: Send to backend API when backend is ready
    console.log('Recording ready for upload:', recording);
  };

  const handleUploadComplete = (recording: AudioRecording) => {
    setCurrentRecording(recording);
    // TODO: Send to backend API when backend is ready
    console.log('Upload ready for processing:', recording);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* PWA Install Banner */}
      {isInstallable && (
        <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 01.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
            </svg>
            <span className="font-medium">Instala FonoaudiologIA para una mejor experiencia</span>
          </div>
          <button
            onClick={installApp}
            className="px-4 py-1 bg-white text-blue-600 rounded-lg font-medium hover:bg-gray-100 transition-colors"
          >
            Instalar
          </button>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">FonoaudiologIA</h1>
          <p className="text-gray-600 mt-2">
            Aplicación de terapia del habla para análisis de pronunciación y transcripción
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Audio Recorder */}
          <AudioRecorder onRecordingComplete={handleRecordingComplete} />

          {/* Audio Uploader */}
          <AudioUploader onUploadComplete={handleUploadComplete} />
        </div>

        {/* Results Section (for future backend integration) */}
        {currentRecording && (
          <div className="mt-8 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Listo para Análisis</h2>
            <div className="space-y-2 text-gray-700">
              <p><strong>Idioma:</strong> Español</p>
              <p><strong>Duración:</strong> {isFinite(currentRecording.duration) ? Math.round(currentRecording.duration) : 0}s</p>
              <p><strong>Formato:</strong> {currentRecording.mimeType}</p>
              <p className="text-sm text-gray-500 mt-4">
                Integración con backend próximamente. El audio está listo para ser enviado para transcripción y análisis.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-gray-600 text-sm">
          <p>FonoaudiologIA - Ayudando a mejorar las habilidades del habla mediante IA</p>
        </div>
      </footer>
    </div>
  );
}

export default App;

