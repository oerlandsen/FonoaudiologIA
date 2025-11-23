"""Feedback generation service using OpenAI."""
import asyncio
import logging
from typing import Optional, Dict
from app.services.open_ai import OpenAIService
from app.models.schemas import MetricScore

logger = logging.getLogger(__name__)


async def generate_dimension_feedback(
    dimension_name: str,
    score: float,
    metrics: Optional[Dict[str, MetricScore]] = None
) -> str:
    """Generate AI feedback for a dimension using OpenAI service (async).
    
    Args:
        dimension_name: Name of the dimension (clarity, rhythm, vocabulary, overall)
        score: Dimension score (0-100)
        metrics: Optional dict of related metrics with their raw values and scores
        
    Returns:
        Feedback string in Spanish
    """
    try:
        service = OpenAIService()
        
        # Build metrics information string
        metrics_info = ""
        if metrics:
            metrics_list = []
            for metric_name, metric_score in metrics.items():
                metrics_list.append(
                    f"- {metric_name}: valor {metric_score.raw:.2f}, puntuación {metric_score.score:.2f}/100"
                )
            if metrics_list:
                metrics_info = "\nMétricas relacionadas:\n" + "\n".join(metrics_list)
        
        # Create Spanish prompts based on dimension type
        if dimension_name == "clarity":
            system_prompt = (
                "Eres un experto en fonoaudiología que proporciona retroalimentación constructiva y alentadora "
                "en español sobre la claridad del habla. Tu estilo es profesional y motivador. "
                "IMPORTANTE: NO menciones puntuaciones numéricas en tu respuesta, solo proporciona retroalimentación cualitativa. "
                "Máximo 25 palabras."
            )
            user_prompt = (
                f"El estudiante tiene una puntuación de {score:.2f}/100 en la dimensión de CLARIDAD "
                f"(precisión en la transcripción).{metrics_info}\n\n"
                f"Proporciona retroalimentación constructiva y alentadora en español (máximo 25 palabras, 2-3 oraciones). "
                f"Destaca aspectos positivos cuando los haya y sugiere mejoras específicas si es necesario. "
                f"NO menciones números, puntuaciones o porcentajes en tu respuesta."
            )
        elif dimension_name == "rhythm":
            system_prompt = (
                "Eres un experto en fonoaudiología que proporciona retroalimentación constructiva y alentadora "
                "en español sobre el ritmo del habla. Tu estilo es profesional y motivador. "
                "IMPORTANTE: NO menciones puntuaciones numéricas en tu respuesta, solo proporciona retroalimentación cualitativa. "
                "Máximo 25 palabras."
            )
            user_prompt = (
                f"El estudiante tiene una puntuación de {score:.2f}/100 en la dimensión de RITMO "
                f"(velocidad del habla y uso de palabras de relleno).{metrics_info}\n\n"
                f"Proporciona retroalimentación constructiva y alentadora en español (máximo 25 palabras, 2-3 oraciones). "
                f"Destaca aspectos positivos cuando los haya y sugiere mejoras específicas sobre el ritmo y uso de muletillas si es necesario. "
                f"NO menciones números, puntuaciones o porcentajes en tu respuesta."
            )
        elif dimension_name == "vocabulary":
            system_prompt = (
                "Eres un experto en fonoaudiología que proporciona retroalimentación constructiva y alentadora "
                "en español sobre la variedad léxica del habla. Tu estilo es profesional y motivador. "
                "IMPORTANTE: NO menciones puntuaciones numéricas en tu respuesta, solo proporciona retroalimentación cualitativa. "
                "Máximo 25 palabras."
            )
            user_prompt = (
                f"El estudiante tiene una puntuación de {score:.2f}/100 en la dimensión de VOCABULARIO "
                f"(variedad léxica).{metrics_info}\n\n"
                f"Proporciona retroalimentación constructiva y alentadora en español (máximo 25 palabras, 2-3 oraciones). "
                f"Destaca aspectos positivos cuando los haya y sugiere mejoras específicas sobre cómo enriquecer el vocabulario si es necesario. "
                f"NO menciones números, puntuaciones o porcentajes en tu respuesta."
            )
        elif dimension_name == "overall":
            system_prompt = (
                "Eres un experto en fonoaudiología que proporciona retroalimentación general constructiva y alentadora "
                "en español sobre el desempeño general del habla. Tu estilo es profesional y motivador. "
                "IMPORTANTE: NO menciones puntuaciones numéricas en tu respuesta, solo proporciona retroalimentación cualitativa. "
                "Máximo 25 palabras."
            )
            user_prompt = (
                f"El estudiante tiene una puntuación promedio de {score:.2f}/100 en el desempeño general "
                f"(promedio de claridad, ritmo y vocabulario).\n\n"
                f"Proporciona retroalimentación general constructiva y alentadora en español (máximo 25 palabras, 2-3 oraciones). "
                f"Destaca fortalezas y proporciona una visión general del progreso. "
                f"NO menciones números, puntuaciones o porcentajes en tu respuesta."
            )
        else:
            # Fallback for unknown dimensions
            system_prompt = (
                "Eres un experto en fonoaudiología que proporciona retroalimentación constructiva y alentadora "
                "en español. Tu estilo es profesional y motivador. "
                "IMPORTANTE: NO menciones puntuaciones numéricas en tu respuesta, solo proporciona retroalimentación cualitativa. "
                "Máximo 25 palabras."
            )
            user_prompt = (
                f"El estudiante tiene una puntuación de {score:.2f}/100 en la dimensión de {dimension_name}.{metrics_info}\n\n"
                f"Proporciona retroalimentación constructiva y alentadora en español (máximo 25 palabras, 2-3 oraciones). "
                f"NO menciones números, puntuaciones o porcentajes en tu respuesta."
            )
        
        # Add timeout to prevent hanging (3 seconds per call)
        feedback = await asyncio.wait_for(
            service.chat(
                text=user_prompt,
                system_prompt=system_prompt,
                model="gpt-4o-mini"
            ),
            timeout=3.0
        )
        
        return feedback.strip()
        
    except asyncio.TimeoutError:
        logger.warning(f"Feedback generation timeout for {dimension_name}")
        # Return concise fallback feedback on timeout (without score, max 30 words)
        fallback_messages = {
            "clarity": "Continúa trabajando en la precisión de tu habla. Cada práctica te acerca más a una comunicación más clara y efectiva.",
            "rhythm": "Sigue practicando para encontrar tu ritmo natural. El ritmo mejora gradualmente con la práctica consciente.",
            "vocabulary": "Explora nuevas palabras a través de la lectura y conversación. Tu vocabulario se enriquecerá con constancia y curiosidad.",
            "overall": "Tu dedicación es valiosa. Continúa trabajando en las diferentes dimensiones de tu habla con paciencia y constancia."
        }
        return fallback_messages.get(dimension_name, f"Continúa practicando para mejorar tu {dimension_name}. Tu esfuerzo es fundamental.")
    except Exception as e:
        logger.error(
            f"Failed to generate feedback for {dimension_name}: {str(e)}",
            exc_info=True
        )
        # Return empty feedback on error
        return ""

