
export interface TrainingLog {
  date: string;
  session: string;
  exercise: string;
  order: number;
  weight: number;
  reps: number;
  setNum: number;
  tonnage: number;
}

export interface NutrientConfig {
  id: string;
  name: string;
  unit: string;
  goal: number;
  color: 'orange' | 'green' | 'yellow' | 'blue' | 'purple' | 'cyan' | 'red';
  emoji: string;
}

export interface ActivityConfig extends NutrientConfig {}

export interface ActivityLog {
  date: string;
  totals: Record<string, number>;
}

export interface NutritionEntry {
  nutrientId: string;
  value: number;
}

export type ActivityMetric = 'distance' | 'duration' | 'elevation' | 'incline' | 'hr' | 'watts' | 'calories' | 'cadence' | 'speed' | 'pace';

export interface CardioType {
  id: string;
  name: string;
  emoji: string;
  color: string;
  mode: 'continuous' | 'interval';
  metrics: ActivityMetric[];
}

export interface IntervalSegment {
  setNum: number;
  distance?: number;
  duration?: number; // en secondes
  hr?: number;
  watts?: number;
  speed?: number; // km/h
  notes?: string;
}

export interface ActivitySession {
  id: string;
  date: string;
  type: string;
  typeEmoji?: string;
  distance: number;
  duration: number;
  elevation: number;
  incline?: number;
  rpe: number;
  hr?: number;
  watts?: number;
  calories?: number;
  cadence?: number;
  intervalStructure?: string;
  segments?: IntervalSegment[];
  notes?: string;
  mode?: 'continuous' | 'interval';
}

export interface NutritionLog {
  date: string;
  totals: Record<string, number>;
  entries?: any[];
}

export interface SleepLog {
  date: string;
  score: number;
  hours: number;
}

export interface UserRoutine {
  id: string;
  name: string;
  exercises: string[];
  color: string;
  targetMuscles?: string[];
}

// Interface pour le Lab Analytics v2 (Dashboard)
export interface AnalysisResponse {
  headline: string;
  advice: string;
  trend: 'UP' | 'FLAT' | 'DOWN';
  metrics: {
    consistency: number; // Pourcentage
    pr: string; // Ex: "Bench 100kg"
    loadScore: number; // 0-100
  };
  groundingUrls?: { title: string, uri: string }[];
}

export interface AnalysisError {
  isError: true;
  message: string;
}

// NOUVEAU : Type pour le Chatbot
export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isThinking?: boolean;
}

export const DEFAULT_NUTRIENTS: NutrientConfig[] = [
  { id: 'prot', name: 'Protéines', unit: 'g', goal: 120, color: 'orange', emoji: '🍗' },
  { id: 'carb', name: 'Glucides', unit: 'g', goal: 250, color: 'green', emoji: '🍝' },
  { id: 'fat', name: 'Lipides', unit: 'g', goal: 70, color: 'yellow', emoji: '🥑' }
];

export const DEFAULT_ACTIVITIES: ActivityConfig[] = [
  { id: 'steps', name: 'Pas', unit: '', goal: 10000, color: 'cyan', emoji: '👣' }
];

// CLEAN SLATE : Tableau vide pour forcer la configuration utilisateur
export const INITIAL_CARDIO_TYPES: CardioType[] = [];

export const MUSCLE_GROUPS = {
  Pectoraux: {
    emoji: '💪',
    color: 'bg-red-500',
    exercises: ['Développé Couché', 'Développé Incliné', 'Pompes', 'Dips', 'Écartés']
  },
  Dos: {
    emoji: '🪵',
    color: 'bg-green-500',
    exercises: ['Tractions', 'Rowing Barre', 'Tirage Vertical', 'Lombaires', 'Tirage Horizontal']
  },
  Jambes: {
    emoji: '🦵',
    color: 'bg-blue-500',
    exercises: ['Squat', 'Fentes', 'Presse à Cuisses', 'Leg Extension', 'Leg Curl']
  },
  Épaules: {
    emoji: '🏋️',
    color: 'bg-orange-500',
    exercises: ['Développé Militaire', 'Élévations Latérales', 'Oiseau', 'Face Pull']
  },
  Bras: {
    emoji: '💪',
    color: 'bg-purple-500',
    exercises: ['Curl Haltères', 'Extensions Triceps', 'Curl Barre EZ', 'Dips Banc']
  }
};