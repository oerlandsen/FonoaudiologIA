import type { AudioRecording, AudioUploadResponse } from '../types/audio';
import { prepareAudioForUpload } from '../utils/audioUtils';

// TODO: Update this URL when backend is ready
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

/**
 * Upload audio for transcription and analysis
 * @param recording - The audio recording to upload
 * @returns Promise with analysis results
 */
export async function uploadAudioForAnalysis(
  recording: AudioRecording
): Promise<AudioUploadResponse> {
  try {
    const formData = prepareAudioForUpload(recording);

    const response = await fetch(`${API_BASE_URL}/audio/analyze`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      return {
        success: false,
        error: error.error || `HTTP error! status: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      audioId: data.audioId,
      analysis: data.analysis,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload audio',
    };
  }
}

/**
 * Get analysis results for a previously uploaded audio
 * @param audioId - The ID of the audio to get results for
 * @returns Promise with analysis results
 */
export async function getAnalysisResults(audioId: string): Promise<AudioUploadResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/audio/${audioId}/analysis`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      return {
        success: false,
        error: error.error || `HTTP error! status: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      audioId: data.audioId,
      analysis: data.analysis,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch analysis',
    };
  }
}

