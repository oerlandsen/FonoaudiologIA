import type { AudioRecording, AudioUploadResponse, ResultsResponse } from '../types/audio';
import { prepareAudioForUpload } from '../utils/audioUtils';

// TODO: Update this URL when backend is ready
const API_BASE_URL = import.meta.env.API_URL || 'http://localhost:8000';

export async function uploadTranscript(
  stepId: string,
  recording: AudioRecording
): Promise<AudioUploadResponse> {
  try {
    const formData = prepareAudioForUpload(recording, stepId);

    const response = await fetch(`${API_BASE_URL}/transcript`, {
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
      session_id: data.session_id
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload audio',
    };
  }
}

export async function getResults(): Promise<ResultsResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/results`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    throw error instanceof Error ? error : new Error('Failed to fetch metrics');
  }
}
