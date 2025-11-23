import { Mic, BookOpen, Image as ImageIcon, MessageCircle, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSession } from '../services/api';

export default function HomePage() {
  const navigate = useNavigate();

  const exercises = [
    {
        icon: BookOpen,
        title: 'Lectura',
        description: 'Lee un texto en voz alta',
    },
    {
        icon: ImageIcon,
        title: 'Descripción',
        description: 'Describe lo que ves',
    },
    {
        icon: MessageCircle,
        title: 'Pregunta',
        description: 'Responde una pregunta',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header with Logo */}
        <div className="mb-6">
          <div className="mb-4">
            <img 
              src="/images/oratoria_logo_v4.png" 
              alt="0ratorIA - Human Speech Enhancement" 
              className="h-24 md:h-44 mx-auto max-w-full" 
            />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
            ¡Hola Martín!
          </h2>
          <p className="text-base text-gray-600 text-center">
            Bienvenid@, mejora la fluidez de tus mensajes y entrena con nosotros.
          </p>
        </div>

        {/* Activity Options */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Enviar mensaje corregido */}
          <button
            onClick={() => {
              // Funcionalidad pendiente
              console.log('Enviar mensaje corregido - Próximamente');
            }}
            className="bg-white rounded-2xl p-6 border-2 border-gray-200 hover:border-indigo-500 hover:shadow-lg transition-all flex flex-col items-center text-center group"
          >
            <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mb-4 group-hover:bg-indigo-100 transition-colors">
              <Send className="text-indigo-500" size={28} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Enviar mensaje corregido
            </h3>
            <p className="text-sm text-gray-600">
              Graba un audio y recibe una versión mejorada
            </p>
          </button>

          {/* Entrenar */}
          <button
            onClick={async () => {
              // Limpiar resultados anteriores y crear sesión en backend
              sessionStorage.removeItem('exerciseResults');
              try {
                const sessionId = await getSession();
                if (sessionId) {
                  sessionStorage.setItem('session_id', sessionId);
                }
              } catch (err) {
                console.error('Error iniciando sesión de prueba', err);
              }
              navigate('/exercise/1');
            }}
            className="bg-indigo-500 rounded-2xl p-6 shadow-lg hover:bg-indigo-600 transition-colors flex flex-col items-center text-center"
          >
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-4">
              <Mic className="text-white" size={28} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              Entrenar
            </h3>
            <p className="text-sm text-white/90">
              Completa 3 ejercicios para obtener tu puntuación
            </p>
          </button>
        </div>

        {/* Exercise Overview */}
        <div>
          <div>
            <button onClick={() => navigate('/enhance')}>Ir a Enhance Speech</button>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Resumen de los ejercicios
          </h3>
          {exercises.map((exercise, index) => {
            const Icon = exercise.icon;
            return (
              <div
                key={index}
                className="bg-white rounded-2xl p-5 mb-3 flex items-center border border-gray-200"
              >
                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mr-4">
                  <Icon className="text-indigo-500" size={24} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center mb-1">
                    <span className="text-sm font-semibold text-gray-600 mr-2">
                      Paso {index + 1}
                    </span>
                    <span className="text-base font-semibold text-gray-900">
                      {exercise.title}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{exercise.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}