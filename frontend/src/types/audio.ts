export interface AudioRecording {
  id: string;
  blob: Blob;
  url: string;
  duration: number;
  timestamp: Date;
  mimeType: string;
}

export interface AudioAnalysis {
  transcription?: string;
  pronunciationScore?: number;
  patterns?: SpeechPattern[];
  errors?: PronunciationError[];
}

export interface SpeechPattern {
  type: 'rhythm' | 'intonation' | 'stress' | 'fluency';
  description: string;
  score: number;
}

export interface PronunciationError {
  word: string;
  expected: string;
  actual: string;
  position: number;
}

export interface AudioUploadResponse {
  success: boolean;
  session_id?: string;
  error?: string;
}

export type Language = 'en' | 'es';
