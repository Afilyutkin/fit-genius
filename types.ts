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

/** Where an exercise sits in the session, so a day reads as a real workout. */
export type SessionBlock = 'warmup' | 'main' | 'accessory' | 'cooldown';

export interface ExerciseDetail {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  /** Prescribed effort, e.g. "RPE 7", "70% от 1ПМ", "темп 5:30/км". */
  intensity?: string;
  block?: SessionBlock;
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
  /** Stable across reorder and removal, so list animations track the right row. */
  id?: string;
  name: string;
  timesPerWeek: number;
  durationMin: number;
}

/** How much this event should shape training relative to the others. */
export type CompetitionPriority = 'high' | 'medium' | 'low';

/** An event the athlete is training for; drives periodisation of the plan. */
export interface CompetitionTarget {
  /** Stable across reorder and removal, so list animations track the right row. */
  id?: string;
  enabled: boolean;
  /** Which discipline the athlete competes in. */
  sport: string;
  /** Event date, ISO yyyy-mm-dd. */
  date: string;
  /** What counts as success, e.g. "полумарафон за 1:45". */
  goal: string;
  /** How much this event should influence the plan when it isn't the nearest one. */
  priority: CompetitionPriority;
}

/**
 * One week of a multi-week programme. The outline fields come from the model
 * once, up front; `plan` is filled in when that week's detailed plan is
 * generated and stays here afterwards, which is what makes the history real.
 */
export interface ProgramWeek {
  /** 1-based position in the programme. */
  index: number;
  /** ISO date of the week's Monday. */
  startDate: string;
  phase: 'base' | 'build' | 'peak' | 'taper' | 'race' | 'off';
  /** One line: what this week is for. */
  focus: string;
  /** Volume and intensity guidance for the sessions. */
  trainingTarget: string;
  /** Calories and macro emphasis for the week. */
  nutritionTarget: string;
  /** Two or three sessions the week is built around. */
  keySessions: string[];
  /** The detailed plan once it exists. */
  plan?: DayPlan[];
  /** Filled when the week is archived. */
  completionPercent?: number;
  weightKg?: number;
}

export interface TrainingProgram {
  createdAt: string;
  /** Monday the programme starts on. */
  startDate: string;
  /** Competition date, or start + 8 weeks when there is no event. */
  endDate: string;
  /** What the whole block is for, e.g. the competition goal. */
  goal: string;
  /** True when built around a competition date. */
  forCompetition: boolean;
  language: Language;
  weeks: ProgramWeek[];
}

/** A finished week, kept so the next plan can build on it. */
export interface WeekRecord {
  /** When the plan was generated. */
  startedAt: string;
  /** When it was replaced by a new plan. */
  archivedAt: string;
  completionPercent: number;
  totalExercises: number;
  completedExercises: number;
  weightKg: number;
  mealsPerDay: number;
  /** Human-readable sports schedule at the time, e.g. "Бег 3x45 мин". */
  sports: string;
  trainedExercises: string[];
  skippedExercises: string[];
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
  /** Events the athlete is preparing for; the nearest enabled one drives periodisation. */
  competitions: CompetitionTarget[];
  dietaryPreferences: string;
  activityLevel: 'Sedentary' | 'Moderate' | 'Active' | 'Extra Active';
  isSetup: boolean;
  weeklyPlan: DayPlan[] | null;
  /** ISO timestamp of the current plan, used to date archived weeks. */
  planCreatedAt?: string;
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