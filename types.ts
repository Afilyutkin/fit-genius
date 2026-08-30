export enum Tab {
  DASHBOARD = 'Dashboard',
  WORKOUTS = 'Workouts',
  NUTRITION = 'Nutrition',
  PROFILE = 'Profile'
}

export type Language = 'en' | 'ru';
export type Theme = 'light' | 'dark';

export interface MealDetails {
  name: string;
  calories: number;
  protein: number;
  fats: number;
  carbs: number;
  ingredients?: string[];
  recipe?: string;
  tip?: string;
}

export interface ExerciseDetail {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  notes?: string;
}

/** One meal in the day, in the order it is eaten. */
export interface PlannedMeal extends MealDetails {
  /** Localised slot label, e.g. "Завтрак" or "Перекус 2". */
  slot: string;
}

export interface DayPlan {
  day: string;
  workoutTitle: string;
  exercises: ExerciseDetail[]; // Changed from string[] to structured object
  totalCalories: number;
  meals: {
    /** Ordered list; its length follows the profile's mealsPerDay. */
    items: PlannedMeal[];
    sportsNutrition: MealDetails[];
  };
  workoutTip: string;
  nutritionTip: string;
}

/** One sport the user trains, with its own weekly rhythm. */
export interface SportPreference {
  name: string;
  timesPerWeek: number;
  durationMin: number;
}

export interface UserProfile {
  name: string;
  level: number;
  xp: number;
  weight: number;
  height: number;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  fitnessGoals: string[]; // Changed from single string to array
  fitnessLevel: 'Beginner' | 'Amateur' | 'Professional'; // New field
  contraindications: string;
  sports: SportPreference[];
  /** How many times a day the user eats (excluding supplements). */
  mealsPerDay: number;
  dietaryPreferences: string;
  activityLevel: 'Sedentary' | 'Moderate' | 'Active' | 'Extra Active';
  isSetup: boolean;
  weeklyPlan: DayPlan[] | null;
  planLanguage?: Language;
  completedExercises: string[];
  useSupplements: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  /** Rendered as a failure notice instead of coach advice. */
  isError?: boolean;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  total: number;
  xpReward: number;
}

export interface Workout {
  id: string;
  title: string;
  type: string;
  duration: number;
  calories: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  tags: string[];
}

export interface DailyStats {
  caloriesBurned: number;
  caloriesGoal: number;
  moveMinutes: number;
  moveGoal: number;
  standHours: number;
  standGoal: number;
  waterConsumed: number; // in ml
}