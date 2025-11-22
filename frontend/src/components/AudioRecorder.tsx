import { useState } from 'react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { AudioPlayer } from './AudioPlayer';
import type { AudioRecording } from '../types/audio';
import { createAudioUrl, revokeAudioUrl, formatDuration, MAX_AUDIO_DURATION, getAudioDuration } from '../utils/audioUtils';

interface AudioRecorderProps {
  onRecordingComplete?: (recording: AudioRecording) => void;
}

export function AudioRecorder({ onRecordingComplete }: AudioRecorderProps) {
  const [recordedAudio, setRecordedAudio] = useState<AudioRecording | null>(null);
  
  const {
    isRecording,
    isPaused,
    duration,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording
  } = useAudioRecorder();

  const handleStartRecording = async () => {
    await startRecording();
  };

  const handleStopRecording = async () => {
    const blob = await stopRecording();
    if (blob) {
      const url = createAudioUrl(blob);
      // Get actual duration from blob to avoid infinite duration bug
      let actualDuration = duration;
      try {
        actualDuration = await getAudioDuration(blob);
      } catch (err) {
        console.warn('Could not get blob duration, using recorded duration:', err);
        // Use recorded duration as fallback
      }
      
      const recording: AudioRecording = {
        id: `recording-${Date.now()}`,
        blob,
        url,
        duration: actualDuration,
        timestamp: new Date(),
        mimeType: blob.type || 'audio/webm'
      };
      setRecordedAudio(recording);
      onRecordingComplete?.(recording);
    }
  };

  const handleReset = () => {
    if (recordedAudio) {
      revokeAudioUrl(recordedAudio.url);
      setRecordedAudio(null);
    }
    resetRecording();
  };

  const isDurationLimitReached = duration >= MAX_AUDIO_DURATION;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Grabar Audio</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <div className="mb-6">
        {isRecording && (
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 rounded-full">
              <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
              <span className="text-red-700 font-medium">
                {isPaused ? 'Pausado' : 'Grabando'} - {formatDuration(duration)}
              </span>
            </div>
            {isDurationLimitReached && (
              <p className="text-sm text-orange-600 mt-2">
                Duración máxima alcanzada ({MAX_AUDIO_DURATION}s)
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3 justify-center">
          {!isRecording && !recordedAudio && (
            <button
              type="button"
              onClick={handleStartRecording}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Iniciar Grabación
            </button>
          )}

          {isRecording && (
            <>
              {!isPaused ? (
                <button
                  type="button"
                  onClick={pauseRecording}
                  className="px-6 py-3 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Pausar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={resumeRecording}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  Reanudar
                </button>
              )}
              <button
                type="button"
                onClick={handleStopRecording}
                className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
                Detener Grabación
              </button>
            </>
          )}

          {recordedAudio && (
            <button
              type="button"
              onClick={handleReset}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
              Grabar de Nuevo
            </button>
          )}
        </div>
      </div>

      {recordedAudio && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Audio Grabado</h3>
          <AudioPlayer audioUrl={recordedAudio.url} />
        </div>
      )}
    </div>
  );
}

