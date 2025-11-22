export interface ExerciseResponse {
  id: number;
  stage_id: number;
  exercise_id: number;
  exercise_content: string;
  created_at: string;
  updated_at: string;
}

export interface DimensionResponse {
  name: string;
  score: number;
  feedback: string;
}

export interface ResultsResponse {
  session_id: string;
  overallScore: number;
  dimensions: DimensionResponse[];
}