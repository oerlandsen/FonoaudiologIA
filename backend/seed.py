"""Seed script to populate exercises in the database."""
import json
import sys
from app.database import SessionLocal, create_tables
from app.models.db_models import Exercise


# Exercise data
EXERCISES_DATA = {
    "read": [
        "La historia de un proyecto se cuenta a través de sus commits. Empieza con un elegante 'Initial commit' y desciende lentamente hacia la locura con mensajes como 'arreglando bug final', 'ahora sí por favor' y el clásico 'asdfg'. Es una narrativa de desesperación digital que todo programador conoce y respeta profundamente.",
        "Pasar cuatro horas buscando un error fatal solo para descubrir que te faltaba un punto y coma es un rito de iniciación. En ese momento, sientes una mezcla perfecta de alivio absoluto y ganas de lanzar la computadora por la ventana. Es la humildad forzada e inevitable que nos regala la programación.",
        "A estas alturas de la competencia, mi tipo de sangre es oficialmente Red Bull positivo. Existe un delicado equilibrio entre la lucidez genial y la taquicardia incontrolable. Escribir código en este estado es como tocar jazz: improvisas, nadie entiende qué estás haciendo, pero esperas que el resultado final suene a música.",
        "La frase más peligrosa en el desarrollo de software no es 'tengo un error', sino 'en mi local funciona'. Es la mentira piadosa que nos decimos antes de subir a producción. El servidor, sin embargo, es un juez cruel que no entiende de excusas, solo de logs de errores en rojo brillante.",
        "El silencio antes de una demo es ensordecedor. Tienes exactamente minutos contados para justificar 48 horas de mala alimentación y código espagueti. Si la app habla bien, eres un visionario; si falla, siempre podrás culpar al Wi-Fi del recinto. Respirar profundo es opcional, pero altamente recomendado para no desmayarse.",
        "Hola, este es un texto de ejemplo para probar la precisión de la transcripción.",
        "El silencio antes de una demo es ensordecedor. Tienes exactamente minutos contados para justificar cuarenta y ocho horas de mala alimentación y código spaghetti. Si la app habla bien, eres un visionario. Si falla, siempre podrás culpar al wifi del recinto. Respirar profundo es opcional, pero altamente recomendado para no desmayarse."
    ],
    "description": [
        "https://consequence.net/wp-content/uploads/2021/10/community.jpeg",
        "https://static.independent.co.uk/s3fs-public/thumbnails/image/2014/09/19/16/Pivot-Friends.jpg",
        "https://static0.srcdn.com/wordpress/wp-content/uploads/2023/08/new-project-2023-08-11t122951-028.jpg?q=50&fit=crop&w=825&dpr=1.5",
        "https://junkee.syd1.cdn.digitaloceanspaces.com/wp-content/uploads/2021/08/99_main.jpg",
        "https://www.indiewire.com/wp-content/uploads/2020/04/155053_3397.jpg"
    ],
    "question": [
        "¿Qué es lo primero que haces cada mañana?",
        "Describe con detalle tu lugar favorito en el mundo",
        "¿Qué habilidad o pasatiempo has comenzado a aprender recientemente?",
        "¿Cuál es la última película, serie o libro que viste/leíste y por qué la recomendarías (o no)?",
        "¿Cuál es una habilidad práctica que toda persona debería aprender?"
    ]
}

# Stage mapping
STAGE_MAPPING = {
    "read": 1,
    "description": 2,
    "question": 3
}


def seed_exercises():
    """Seed exercises into the database."""
    # Create tables if they don't exist
    create_tables()
    
    db = SessionLocal()
    try:
        created_count = 0
        skipped_count = 0
        
        for stage_name, stage_id in STAGE_MAPPING.items():
            exercises = EXERCISES_DATA[stage_name]
            
            for index, content in enumerate(exercises, start=1):
                # exercise_id is unique across all stages, so we use: stage_id * 100 + index
                # This gives us: stage 1 -> 101-105, stage 2 -> 201-205, stage 3 -> 301-305
                exercise_id = stage_id * 100 + index
                
                # Check if exercise already exists
                existing = db.query(Exercise).filter(
                    Exercise.exercise_id == exercise_id
                ).first()
                
                if existing:
                    print(f"⏭️  Skipping exercise_id={exercise_id} (stage_id={stage_id}, {stage_name}) - already exists")
                    skipped_count += 1
                    continue
                
                # Create new exercise
                exercise = Exercise(
                    stage_id=stage_id,
                    exercise_id=exercise_id,
                    exercise_content=content
                )
                db.add(exercise)
                created_count += 1
                print(f"✓ Created exercise_id={exercise_id} (stage_id={stage_id}, {stage_name})")
        
        db.commit()
        print(f"\n✅ Seed completed!")
        print(f"   Created: {created_count} exercises")
        print(f"   Skipped: {skipped_count} exercises (already exist)")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding database: {str(e)}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("🌱 Starting database seed...")
    seed_exercises()

