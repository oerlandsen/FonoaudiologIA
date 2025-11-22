import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [shouldRender, setShouldRender] = useState(true);

  useEffect(() => {
    // Iniciar fade out después de 2 segundos
    const fadeOutTimer = setTimeout(() => {
      setIsVisible(false);
    }, 2000);

    // Remover el componente completamente después de la animación (2s + 500ms de transición)
    const removeTimer = setTimeout(() => {
      setShouldRender(false);
      onFinish();
    }, 2500);

    return () => {
      clearTimeout(fadeOutTimer);
      clearTimeout(removeTimer);
    };
  }, [onFinish]);

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed inset-0 z-50 bg-white flex items-center justify-center transition-opacity duration-500 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="flex flex-col items-center">
        <img
          src="/images/oratoria_v4.png"
          alt="0ratorIA"
          className="h-28 md:h-32 max-w-full"
        />
      </div>
    </div>
  );
}