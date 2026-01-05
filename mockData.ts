import { TrainingLog, NutritionLog, SleepLog, ActivitySession } from './types';

const generateMockData = () => {
  // Retourne des tableaux vides pour un démarrage à zéro (Clean Slate)
  const training: TrainingLog[] = [];
  const nutrition: NutritionLog[] = [];
  const sleep: SleepLog[] = [];
  const activity: ActivitySession[] = [];
  
  return { training, nutrition, sleep, activity };
};

export const { training: mockTraining, nutrition: mockNutrition, sleep: mockSleep, activity: mockActivity } = generateMockData();