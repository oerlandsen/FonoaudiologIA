import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Mic,
  Square,
  Play,
  BookOpen,
  Image as ImageIcon,
  MessageCircle,
  LucideIcon,
} from 'lucide-react';
import { uploadTranscript } from '../services/api';

const EXERCISES: Record<number, {
  type: string;
  title: string;
  icon: LucideIcon;
  instruction: string;
  content: string;
}> = {
  1: {
    type: 'reading',
    title: 'Ejercicio de Lectura',
    icon: BookOpen,
    instruction: 'Lee el siguiente texto en voz alta de forma clara y natural',
    content:
      'El veloz zorro marrón salta sobre el perro perezoso. Esta frase contiene muchas letras del alfabeto y es comúnmente utilizada para pruebas. Practica hablar claramente y a un ritmo cómodo.',
  },
  2: {
    type: 'description',
    title: 'Descripción de Imagen',
    icon: ImageIcon,
    instruction: 'Describe lo que ves en la imagen a continuación',
    content:
      'Imagina un paisaje sereno con montañas en el fondo, un lago azul claro en el primer plano y pinos a lo largo de la orilla. Describe esta escena con tus propias palabras.',
  },
  3: {
    type: 'question',
    title: 'Pregunta y Respuesta',
    icon: MessageCircle,
    instruction: 'Responde la siguiente pregunta',
    content:
      '¿Cuáles son tus objetivos para mejorar tu habla, y cómo crees que esta aplicación puede ayudarte a lograrlos?',
  },
};

export default function ExercisePage() {
  const navigate = useNavigate();
  const { step } = useParams<{ step: string }>();
  const currentStep = parseInt(step || '1');
  const exercise = EXERCISES[currentStep];

  const [isRecording, setIsRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setRecordingUri(null);
    setIsRecording(false);
    setIsPlaying(false);
  }, [step, currentStep]);

  const Icon = exercise.icon;

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        const audioUrl = URL.createObjectURL(audioBlob);
  
        setRecordingUri(audioUrl);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error al iniciar la grabación:', error);
      alert('No se pudo iniciar la grabación. Verifica los permisos del micrófono.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const playRecording = useCallback(() => {
    if (recordingUri && audioRef.current) {
      audioRef.current.src = recordingUri;
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [recordingUri]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onended = () => setIsPlaying(false);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!recordingUri) {
      alert('Por favor graba tu respuesta antes de continuar.');
      return;
    }

    setIsSubmitting(true);

    try {
      const exerciseData = {
        step: currentStep,
        type: exercise.type,
        audioUrl: recordingUri,
        timestamp: new Date().toISOString(),
      };

      const response = await uploadTranscript(
        exerciseData.step.toString(),
        {
          id: `exercise-${currentStep}-${Date.now()}`,
          blob: audioBlob || new Blob(),
          url: recordingUri,
          duration: 0,
          timestamp: new Date(),
          mimeType: 'audio/webm',
        }
      );

      if (!response.success) {
        throw new Error(response.error || 'Error desconocido al subir la grabación');
      }

      if (currentStep < 3) {
        navigate(`/exercise/${currentStep + 1}`);
      } else {
        navigate('/score');
      }

    } catch (error) {
      console.error('Error al enviar la grabación:', error);
      alert('No se pudo enviar tu grabación. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  }, [recordingUri, audioBlob, currentStep, exercise, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <audio ref={audioRef} className="hidden" />
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center mb-4">
            <button
              onClick={() => navigate(-1)}
              className="mr-4"
            >
              <ArrowLeft className="text-gray-900" size={24} />
            </button>
            <div className="flex-1">
              <p className="text-xs text-gray-600 mb-0.5">
                Paso {currentStep} de 3
              </p>
              <h2 className="text-lg font-semibold text-gray-900">
                {exercise.title}
              </h2>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex gap-2">
            {[1, 2, 3].map((num) => (
              <div
                key={num}
                className={`flex-1 h-1 rounded-full ${
                  num <= currentStep ? 'bg-indigo-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6">
          {/* Exercise Card */}
          <div className="bg-white rounded-2xl p-6 mb-6 border border-gray-200">
            <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
              <Icon className="text-indigo-500" size={28} />
            </div>

            <h3 className="text-base font-semibold text-gray-900 mb-3">
              {exercise.instruction}
            </h3>

            <div className="bg-gray-50 rounded-xl p-4 border-l-4 border-indigo-500">
              <p className="text-sm text-gray-700 leading-6">
                {exercise.content}
              </p>
            </div>
            {isLoading ? (
              <div className="bg-gray-50 rounded-xl p-4 border-l-4 border-indigo-500 flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
              </div>
            ) : exercise.type === 'description' ? (
              <div className="bg-gray-50 rounded-xl p-4 border-l-4 border-indigo-500 flex justify-center relative min-h-[200px]">
                {isImageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                  </div>
                )}
                <img 
                  src={exercise.content} 
                  alt="Imagen para describir" 
                  className={`max-w-full h-auto rounded max-h-64 object-contain ${isImageLoading ? 'invisible' : 'visible'}`}
                  onLoad={() => setIsImageLoading(false)}
                  onError={(e) => {
                    e.currentTarget.src = 'https://static.independent.co.uk/s3fs-public/thumbnails/image/2014/09/19/16/Pivot-Friends.jpg';
                    setIsImageLoading(false);
                  }}
                />
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-4 border-l-4 border-indigo-500">
                <p className="text-sm text-gray-700 leading-6">
                  {exercise.content}
                </p>
              </div>
            )}
          </div>

          {/* Recording Controls */}
          <div className="bg-white rounded-2xl p-6 text-center border border-gray-200">
            <h4 className="text-base font-semibold text-gray-900 mb-5">
              {recordingUri
                ? 'Grabación completada'
                : isRecording
                ? 'Grabando...'
                : 'Listo para grabar'}
            </h4>

            {/* Record Button */}
            {!recordingUri && (
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 mx-auto shadow-lg transition-all ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-indigo-500 hover:bg-indigo-600'
                }`}
              >
                {isRecording ? (
                  <Square className="text-white" size={32} fill="white" />
                ) : (
                  <Mic className="text-white" size={32} />
                )}
              </button>
            )}

            {/* Playback Button */}
            {recordingUri && (
              <button
                onClick={playRecording}
                disabled={isPlaying}
                className={`w-20 h-20 rounded-full bg-indigo-500 flex items-center justify-center mb-4 mx-auto ${
                  isPlaying ? 'opacity-60' : 'hover:bg-indigo-600'
                }`}
              >
                <Play className="text-white" size={32} fill="white" />
              </button>
            )}

            <p className="text-sm text-gray-600 text-center">
              {recordingUri
                ? 'Toca para reproducir tu grabación'
                : isRecording
                ? 'Toca para detener la grabación'
                : 'Toca para comenzar a grabar'}
            </p>

            {/* Re-record Button */}
            {recordingUri && (
              <button
                onClick={() => setRecordingUri(null)}
                className="mt-4 text-sm text-indigo-500 font-semibold"
              >
                Grabar de nuevo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Action */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleSubmit}
            disabled={!recordingUri || isSubmitting}
            className={`w-full py-4 rounded-xl font-semibold transition-colors ${
              recordingUri && !isSubmitting
                ? 'bg-indigo-500 text-white hover:bg-indigo-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSubmitting
              ? 'Enviando...'
              : currentStep < 3
              ? 'Continuar al siguiente ejercicio'
              : 'Completar prueba'}
          </button>
        </div>
      </div>
    </div>
  );
}