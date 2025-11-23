
import type { AudioRecording, AudioUploadResponse } from '../types/audio';
import type { ResultsResponse, ExerciseResponse } from '../types/requests';
import { prepareAudioForUpload } from '../utils/audioUtils';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function getSession(): Promise<string | null> {
  try {
    console.log(API_BASE_URL);
    const response = await fetch(`${API_BASE_URL}/start`, {
      method: 'POST',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    sessionStorage.setItem('session_id', data.session_id);

    return data.session_id || null;
  } catch (error) {
    console.error('Error obtaining session ID:', error);
    return null;
  }
}

export async function getExercise(stepId: string): Promise<ExerciseResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/excercise?stage_id=${stepId}`, {
      method: 'GET',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    throw error instanceof Error ? error : new Error('Failed to fetch exercise');
  }
}

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
    const sessionId = sessionStorage.getItem('session_id');
    if (!sessionId) {
      throw new Error('No session ID found. Please start a new exercise.');
    }

    const response = await fetch(`${API_BASE_URL}/results?session_id=${sessionId}`, {
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

export interface ScribeTokenResponse {
  token: string;
}

export async function getScribeToken(): Promise<ScribeTokenResponse> {
  try {
    // Get API key from environment variables
    // Note: In Vite, environment variables must be prefixed with VITE_ to be exposed to the client
    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY || import.meta.env.ELEVENLABS_API_KEY;
    
    if (!apiKey) {
      console.error('[ElevenLabs] API key not found. Please set VITE_ELEVENLABS_API_KEY in your .env file');
      throw new Error('ELEVENLABS_API_KEY not configured. Please set VITE_ELEVENLABS_API_KEY in your .env file');
    }

    console.log('[ElevenLabs] Fetching token directly from ElevenLabs API...', {
      apiKeyPrefix: apiKey.substring(0, 10) + '...',
      timestamp: new Date().toISOString(),
    });

    const response = await fetch(
      'https://api.elevenlabs.io/v1/single-use-token/realtime_scribe',
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ 
        error: `HTTP error! status: ${response.status}` 
      }));
      
      console.error('[ElevenLabs] Failed to fetch token from ElevenLabs API:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
        timestamp: new Date().toISOString(),
      });
      
      throw new Error(
        errorData.error || 
        errorData.detail || 
        `Failed to fetch token: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    
    if (!data || !data.token) {
      console.error('[ElevenLabs] Invalid response from ElevenLabs API:', {
        data,
        timestamp: new Date().toISOString(),
      });
      throw new Error('Invalid response from ElevenLabs API: token not found');
    }

    console.log('[ElevenLabs] Token fetched successfully', {
      tokenLength: data.token.length,
      tokenPrefix: data.token.substring(0, 10) + '...',
      timestamp: new Date().toISOString(),
    });

    return { token: data.token };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[ElevenLabs] Error fetching scribe token:', {
      error: errorMessage,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    throw error instanceof Error ? error : new Error('Failed to fetch scribe token');
  }
}
