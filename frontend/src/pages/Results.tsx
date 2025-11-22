import { BarChart3 } from 'lucide-react';

export default function ResultsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Historial de Resultados
          </h1>
          <p className="text-base text-gray-600">
            Haz seguimiento de tu progreso a lo largo del tiempo
          </p>
        </div>

        {/* Empty State */}
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center mb-6">
            <BarChart3 className="text-indigo-500" size={40} />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2 text-center">
            Aún no hay resultados
          </h3>
          <p className="text-sm text-gray-600 text-center leading-relaxed max-w-sm">
            Completa tu primera prueba para ver tus resultados y hacer seguimiento de tu progreso
          </p>
        </div>
      </div>
    </div>
  );
}