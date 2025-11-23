import { useState, useEffect, useRef } from 'react';

interface SpeechRateResult {
  wordsPerMinute: number;
  wordCount: number;
  isListening: boolean;
}

export function useSpeechRate(isRecording: boolean): SpeechRateResult {
  const [wordsPerMinute, setWordsPerMinute] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [isListening, setIsListening] = useState(false);
  
  const startTimeRef = useRef<number>(0);
  const totalWordsRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chunkIntervalRef = useRef<any>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const selectedFormatRef = useRef<{ mime: string; ext: string } | null>(null);
  const chunkStartTimeRef = useRef<number>(0); // Tiempo de inicio del chunk actual

  // Configuración para enviar chunks de audio cada 5 segundos (mayor calidad)
 const CHUNK_DURATION = 3000;

  useEffect(() => {
    if (!import.meta.env.VITE_ELEVENLABS_API_KEY) {
      console.error('VITE_ELEVENLABS_API_KEY no está configurada');
      return;
    }

    if (isRecording) {
      console.log('Iniciando grabación para análisis WPM con Eleven Labs');
      startTimeRef.current = Date.now();
      totalWordsRef.current = 0;
      setIsListening(true);
      
      startRecordingChunks();
    } else {
      // Detener cuando se deja de grabar
      stopRecordingChunks();
      setWordsPerMinute(0);
      setWordCount(0);
      setIsListening(false);
    }

    // Función para iniciar grabación en chunks
    async function startRecordingChunks() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;
        
        // Priorizar formatos que Eleven Labs acepta mejor
        const supportedTypes = [
          { mime: 'audio/mp4', ext: 'mp4' },
          { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
          { mime: 'audio/webm;codecs=opus', ext: 'webm' },
          { mime: 'audio/webm', ext: 'webm' }
        ];
        
        let selectedFormat = supportedTypes[0];
        for (const format of supportedTypes) {
          if (MediaRecorder.isTypeSupported(format.mime)) {
            selectedFormat = format;
            break;
          }
        }
        
        selectedFormatRef.current = selectedFormat;
        console.log('Formato de grabación:', selectedFormat.mime);
        
        // Iniciar primera grabación
        startNewRecording();
        
        // Cada CHUNK_DURATION, detener y reiniciar para obtener archivo completo
        chunkIntervalRef.current = setInterval(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop(); // Esto disparará onstop
          }
        }, CHUNK_DURATION);
        
        console.log('Grabación iniciada');
      } catch (error) {
        console.error('Error al iniciar grabación:', error);
      }
    }
    
    // Función para iniciar una nueva grabación
    function startNewRecording() {
      if (!audioStreamRef.current || !selectedFormatRef.current) return;
      
      const mediaRecorder = new MediaRecorder(audioStreamRef.current, { 
        mimeType: selectedFormatRef.current.mime 
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      // Marcar el tiempo de inicio de este chunk
      chunkStartTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        // Cuando se detiene, crear el archivo completo y enviarlo
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: selectedFormatRef.current!.mime 
          });
          
          if (audioBlob.size > 2048) {
            // Calcular duración del chunk en minutos
            const chunkDurationMinutes = (Date.now() - chunkStartTimeRef.current) / 60000;
            await transcribeAudio(audioBlob, selectedFormatRef.current!.ext, chunkDurationMinutes);
          }
        }
        
        // Reiniciar grabación si aún estamos grabando
        if (isRecording && audioStreamRef.current) {
          startNewRecording();
        }
      };

      mediaRecorder.start();
    }

    // Función para transcribir audio con Eleven Labs
    async function transcribeAudio(audioBlob: Blob, fileExtension: string, chunkDurationMinutes: number) {
      try {
        // Verificar si tenemos una API key válida
        const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
        if (!apiKey || apiKey.trim().length === 0) {
          console.error('API key no válida o no configurada');
          return;
        }

        // Verificar tamaño mínimo del audio
        if (audioBlob.size < 1024) {
          console.log('Audio demasiado pequeño, omitiendo...');
          return;
        }
        
        console.log(`Procesando audio de ${(audioBlob.size / 1024).toFixed(2)} KB`);
        
        const formData = new FormData();
        // Enviar con el formato y extensión real
        formData.append('file', audioBlob, `audio.${fileExtension}`);
        formData.append('model_id', 'scribe_v2');
        
        console.log(`Tipo MIME: ${audioBlob.type}, Extensión: ${fileExtension}`);

        console.log('Enviando solicitud a Eleven Labs...');
        
        const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'xi-api-key': apiKey
          },
          body: formData,
        });

        // Mejor manejo de errores
        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`Error en transcripción (${response.status}):\n`, errorBody);
          return;
        }

        const data = await response.json();
        console.log('Respuesta de Eleven Labs:', data);
        const transcript = data.text || '';
        
        if (transcript.trim()) {
          const words = transcript.trim().split(/\s+/).filter((w: string) => w.length > 0);
          const chunkWords = words.length;
          totalWordsRef.current += chunkWords;
          
          // Calcular WPM solo para este chunk
          if (chunkDurationMinutes > 0 && chunkWords > 0) {
            const chunkWPM = chunkWords / chunkDurationMinutes;
            setWordsPerMinute(Math.round(chunkWPM));
            setWordCount(totalWordsRef.current);
            console.log(`Chunk: "${transcript}" | Palabras: ${chunkWords} | WPM chunk: ${Math.round(chunkWPM)} | Total: ${totalWordsRef.current}`);
          }
        }
      } catch (error) {
        console.error('Error al transcribir audio:', error);
      }
    }

    // Función para detener grabación
    function stopRecordingChunks() {
      if (chunkIntervalRef.current) {
        clearInterval(chunkIntervalRef.current);
        chunkIntervalRef.current = null;
      }
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
      
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
    }

    // Cleanup
    return () => {
      stopRecordingChunks();
    };
  }, [isRecording]);

  return { wordsPerMinute, wordCount, isListening };
}