import { useState, useEffect, useCallback } from 'react';
import { useScribe } from '@elevenlabs/react';
import { getScribeToken } from '../services/api';
import { Mic, Square, AlertCircle } from 'lucide-react';

interface LiveTranscriptionProps {
  onTranscriptUpdate?: (text: string) => void;
  className?: string;
}

export function LiveTranscription({ onTranscriptUpdate, className = '' }: LiveTranscriptionProps) {
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const scribe = useScribe({
    modelId: 'scribe_v2_realtime',
    onPartialTranscript: (data) => {
      console.log('[ElevenLabs] Partial transcript received:', {
        text: data.text,
        timestamp: new Date().toISOString(),
        data: JSON.stringify(data),
      });
      
      if (onTranscriptUpdate) {
        onTranscriptUpdate(data.text);
      }
    },
    onCommittedTranscript: (data) => {
      console.log('[ElevenLabs] Committed transcript received:', {
        text: data.text,
        timestamp: new Date().toISOString(),
        data: JSON.stringify(data),
      });
    },
    onCommittedTranscriptWithTimestamps: (data) => {
      console.log('[ElevenLabs] Committed transcript with timestamps:', {
        text: data.text,
        timestamps: data.timestamps,
        timestamp: new Date().toISOString(),
        data: JSON.stringify(data),
      });
    },
    onError: (error) => {
      console.error('[ElevenLabs] Scribe error occurred:', {
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      setError(error instanceof Error ? error.message : 'An error occurred with ElevenLabs');
      setConnectionError(error instanceof Error ? error.message : 'Connection error');
    },
  });

  const handleStart = useCallback(async () => {
    console.log('[ElevenLabs] Starting connection process...');
    setError(null);
    setConnectionError(null);
    setIsConnecting(true);

    try {
      console.log('[ElevenLabs] Fetching token from ElevenLabs API...');
      const tokenData = await getScribeToken();
      
      if (!tokenData || !tokenData.token) {
        const errorMsg = 'Failed to retrieve token from ElevenLabs API';
        console.error('[ElevenLabs] Token fetch failed:', {
          response: tokenData,
          timestamp: new Date().toISOString(),
        });
        setError(errorMsg);
        setConnectionError(errorMsg);
        setIsConnecting(false);
        return;
      }

      console.log('[ElevenLabs] Token received successfully, connecting to Scribe...', {
        tokenLength: tokenData.token.length,
        tokenPrefix: tokenData.token.substring(0, 10) + '...',
        timestamp: new Date().toISOString(),
      });

      await scribe.connect({
        token: tokenData.token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      console.log('[ElevenLabs] Successfully connected to Scribe', {
        isConnected: scribe.isConnected,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('[ElevenLabs] Connection failed:', {
        error: errorMessage,
        errorType: err instanceof Error ? err.constructor.name : typeof err,
        stack: err instanceof Error ? err.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      setError(errorMessage);
      setConnectionError(errorMessage);
    } finally {
      setIsConnecting(false);
    }
  }, [scribe]);

  const handleStop = useCallback(() => {
    console.log('[ElevenLabs] Disconnecting from Scribe...', {
      timestamp: new Date().toISOString(),
    });
    
    try {
      scribe.disconnect();
      console.log('[ElevenLabs] Successfully disconnected', {
        timestamp: new Date().toISOString(),
      });
      setError(null);
      setConnectionError(null);
    } catch (err) {
      console.error('[ElevenLabs] Error during disconnect:', {
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      });
    }
  }, [scribe]);

  // Log connection state changes
  useEffect(() => {
    console.log('[ElevenLabs] Connection state changed:', {
      isConnected: scribe.isConnected,
      timestamp: new Date().toISOString(),
    });
  }, [scribe.isConnected]);

  // Log transcript updates
  useEffect(() => {
    if (scribe.partialTranscript) {
      console.log('[ElevenLabs] Partial transcript updated:', {
        text: scribe.partialTranscript,
        timestamp: new Date().toISOString(),
      });
    }
  }, [scribe.partialTranscript]);

  useEffect(() => {
    if (scribe.committedTranscripts.length > 0) {
      console.log('[ElevenLabs] Committed transcripts updated:', {
        count: scribe.committedTranscripts.length,
        latest: scribe.committedTranscripts[scribe.committedTranscripts.length - 1]?.text,
        timestamp: new Date().toISOString(),
      });
    }
  }, [scribe.committedTranscripts]);

  const displayError = error || connectionError;

  return (
    <div className={`bg-white rounded-2xl p-6 border border-gray-200 ${className}`}>
      <h4 className="text-base font-semibold text-gray-900 mb-4">
        Transcripción en Vivo
      </h4>

      {/* Error Display */}
      {displayError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Error de conexión</p>
            <p className="text-xs text-red-600 mt-1">{displayError}</p>
            <p className="text-xs text-red-500 mt-1">
              Revisa la consola para más detalles
            </p>
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={handleStart}
          disabled={scribe.isConnected || isConnecting}
          className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 ${
            scribe.isConnected || isConnecting
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-indigo-500 text-white hover:bg-indigo-600'
          }`}
        >
          {isConnecting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Conectando...</span>
            </>
          ) : (
            <>
              <Mic size={20} />
              <span>Iniciar Transcripción</span>
            </>
          )}
        </button>

        <button
          onClick={handleStop}
          disabled={!scribe.isConnected}
          className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 ${
            !scribe.isConnected
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-red-500 text-white hover:bg-red-600'
          }`}
        >
          <Square size={20} />
          <span>Detener</span>
        </button>
      </div>

      {/* Live Transcript Display */}
      <div className="space-y-3">
        {/* Partial Transcript (Live) */}
        {scribe.partialTranscript && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <p className="text-xs font-medium text-indigo-600 mb-1">En vivo:</p>
            <p className="text-sm text-gray-800 leading-relaxed">
              {scribe.partialTranscript}
            </p>
          </div>
        )}

        {/* Committed Transcripts */}
        {scribe.committedTranscripts.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-48 overflow-y-auto">
            <p className="text-xs font-medium text-gray-600 mb-2">Transcripción confirmada:</p>
            <div className="space-y-2">
              {scribe.committedTranscripts.map((transcript) => (
                <p
                  key={transcript.id}
                  className="text-sm text-gray-700 leading-relaxed"
                >
                  {transcript.text}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!scribe.partialTranscript && scribe.committedTranscripts.length === 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500">
              {scribe.isConnected
                ? 'Habla para ver la transcripción en vivo...'
                : 'Haz clic en "Iniciar Transcripción" para comenzar'}
            </p>
          </div>
        )}
      </div>

      {/* Connection Status */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">Estado:</span>
          <span
            className={`font-medium ${
              scribe.isConnected
                ? 'text-green-600'
                : isConnecting
                ? 'text-yellow-600'
                : 'text-gray-400'
            }`}
          >
            {scribe.isConnected
              ? 'Conectado'
              : isConnecting
              ? 'Conectando...'
              : 'Desconectado'}
          </span>
        </div>
      </div>
    </div>
  );
}

