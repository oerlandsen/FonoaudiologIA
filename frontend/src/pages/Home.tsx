import { Mic, BookOpen, Image as ImageIcon, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            0ratorIA
          </h1>
          <p className="text-base text-gray-600">
            Mejora tu habla con ejercicios impulsados por IA
          </p>
        </div>

        {/* Start Test Card */}
        <div className="mb-8">
          <div className="bg-indigo-500 rounded-2xl p-6 shadow-lg">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-4">
              <Mic className="text-white" size={28} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Comenzar Nuevo Test
            </h2>
            <p className="text-white/90 mb-6 leading-relaxed">
              Completa 3 ejercicios para obtener tu puntuación del habla
            </p>
            <button
                onClick={() => {
                    // Limpiar resultados anteriores
                    sessionStorage.removeItem('exerciseResults');
                    navigate('/exercise/1');
                }}
                className="bg-white text-indigo-500 px-6 py-4 rounded-xl font-semibold hover:bg-gray-100 transition-colors w-full"
            >
                Iniciar Test
            </button>
          </div>
        </div>

        {/* Exercise Overview */}
        <div>
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