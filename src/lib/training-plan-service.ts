import { TrainingPlan } from './types';
import { storage } from './storage';

const THEMES = [
  'adventure', 'science', 'nature', 'motivation', 'sports',
  'technology', 'history', 'music', 'travel', 'philosophy'
];

class TrainingPlanService {
  async getTrainingPlan(): Promise<TrainingPlan> {
    const response = await fetch('/api/training-plan');
    if (!response.ok) throw new Error('Failed to get training plan');
    return response.json();
  }

  async incrementSessionCount(): Promise<number> {
    const response = await fetch('/api/training-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'increment' })
    });
    if (!response.ok) throw new Error('Failed to increment session count');
    const data = await response.json();
    return data.sessionsSinceUpdate;
  }

  async updatePlan(updates: Partial<TrainingPlan>): Promise<TrainingPlan> {
    const response = await fetch('/api/training-plan', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update training plan');
    return response.json();
  }

  async updateSystemPrompt(prompt: string): Promise<void> {
    await this.updatePlan({ systemPrompt: prompt });
  }

  async updatePracticeMode(mode: 'words' | 'quotes'): Promise<void> {
    await this.updatePlan({ practiceMode: mode });
  }

  // Check if plan should be updated (every 5 sessions)
  shouldUpdatePlan(sessionsSinceUpdate: number): boolean {
    return sessionsSinceUpdate >= 5;
  }

  // Generate new training plan based on performance data
  async generateNewPlan(): Promise<TrainingPlan> {
    const data = await storage.load();
    const recentSessions = data.sessions.slice(-20);

    // Calculate average accuracy to determine difficulty
    const avgAccuracy = recentSessions.length > 0
      ? recentSessions.reduce((a, s) => a + s.accuracy, 0) / recentSessions.length
      : 95;

    // Determine difficulty
    let difficulty: 'easy' | 'medium' | 'hard' = 'medium';
    if (avgAccuracy > 97) difficulty = 'hard';
    else if (avgAccuracy < 93) difficulty = 'easy';

    // Get weak keys and bigrams
    const weakKeys = await storage.getWeakKeys(8);
    const weakBigrams = await storage.getWeakBigrams(8);

    // Get current plan to toggle practice mode
    const currentPlan = await this.getTrainingPlan();
    const practiceMode = currentPlan.practiceMode === 'words' ? 'quotes' : 'words';

    // Pick a random theme
    const theme = THEMES[Math.floor(Math.random() * THEMES.length)];

    // Update the plan
    return this.updatePlan({
      sessionsSinceUpdate: 0,
      currentDifficulty: difficulty,
      currentTheme: theme,
      weakKeys: weakKeys.map(k => k.key),
      weakBigrams: weakBigrams.map(b => b.bigram),
      practiceMode: practiceMode as 'words' | 'quotes',
      lastUpdated: Date.now()
    });
  }
}

export const trainingPlanService = new TrainingPlanService();
