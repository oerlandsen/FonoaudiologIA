import type { AudioRecording } from '../types/audio';

export const MAX_AUDIO_DURATION = 300; // 5 minutes in seconds
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
export const SUPPORTED_AUDIO_FORMATS = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/webm'];

export function validateAudioFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!SUPPORTED_AUDIO_FORMATS.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported file format. Supported formats: WAV, MP3, OGG, WEBM`
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`
    };
  }

  return { valid: true };
}

export function formatDuration(seconds: number): string {
  // Handle invalid values (Infinity, NaN, negative)
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) {
    return '0:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export function createAudioUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export function revokeAudioUrl(url: string): void {
  URL.revokeObjectURL(url);
}

export function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = createAudioUrl(blob);
    
    const cleanup = () => {
      revokeAudioUrl(url);
    };
    
    audio.addEventListener('loadedmetadata', () => {
      const duration = audio.duration;
      // Check if duration is valid
      if (isFinite(duration) && !isNaN(duration) && duration > 0) {
        cleanup();
        resolve(duration);
      } else {
        cleanup();
        reject(new Error('Invalid audio duration'));
      }
    });
    
    audio.addEventListener('error', (e) => {
      cleanup();
      reject(new Error('Failed to load audio metadata'));
    });
    
    // Timeout fallback
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timeout loading audio metadata'));
    }, 10000);
    
    audio.addEventListener('loadedmetadata', () => {
      clearTimeout(timeout);
    }, { once: true });
    
    audio.src = url;
  });
}

export function prepareAudioForUpload(recording: AudioRecording): FormData {
  const formData = new FormData();
  formData.append('audio', recording.blob, `recording-${recording.id}.${getFileExtension(recording.mimeType)}`);
  formData.append('language', 'es'); // Always Spanish
  formData.append('timestamp', recording.timestamp.toISOString());
  return formData;
}

function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'audio/wav': 'wav',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm'
  };
  return mimeToExt[mimeType] || 'wav';
}

