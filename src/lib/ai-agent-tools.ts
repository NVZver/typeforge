import { storage } from './storage';
import { trainingPlanService } from './training-plan-service';
import { AgentTool, TrainingPlan } from './types';

// Tool definitions for the AI agent
export const agentTools: AgentTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_performance_summary',
      description: 'Get overall typing performance: WPM, accuracy, trend, gap to target. Call this first to understand the user\'s current level.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_weak_keys',
      description: 'Get the slowest keys by average timing in milliseconds. Use to identify specific keys needing practice.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'string',
            description: 'Number of weak keys to return (default: 5)'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_weak_bigrams',
      description: 'Get the slowest key pairs (bigrams) by timing. Useful for identifying problematic letter combinations.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'string',
            description: 'Number of weak bigrams to return (default: 5)'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_sessions',
      description: 'Get stats from recent practice sessions including WPM, accuracy, and mode.',
      parameters: {
        type: 'object',
        properties: {
          count: {
            type: 'string',
            description: 'Number of recent sessions to return (default: 5)'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_training_plan',
      description: 'Get current training plan: difficulty, mode, theme, and targeted weak keys/bigrams.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_training_plan',
      description: 'Modify the training plan settings. Only call when the user explicitly requests changes.',
      parameters: {
        type: 'object',
        properties: {
          difficulty: {
            type: 'string',
            description: 'Difficulty level',
            enum: ['easy', 'medium', 'hard']
          },
          mode: {
            type: 'string',
            description: 'Practice mode',
            enum: ['words', 'quotes']
          },
          theme: {
            type: 'string',
            description: 'Theme for quote generation (e.g., "space exploration", "mystery")'
          }
        }
      }
    }
  }
];

// Tool executor functions
export async function executeGetPerformanceSummary(): Promise<string> {
  const data = await storage.load();
  const sessions = data.sessions;

  if (sessions.length < 3) {
    return JSON.stringify({ error: 'Not enough data', sessions: sessions.length, required: 3 });
  }

  const recentSessions = sessions.slice(-20);
  const avgWpm = Math.round(recentSessions.reduce((a, s) => a + s.wpm, 0) / recentSessions.length);
  const avgAccuracy = Math.round(recentSessions.reduce((a, s) => a + s.accuracy, 0) / recentSessions.length);

  // Calculate trend
  let trend = 'stable';
  if (sessions.length >= 10) {
    const recent5 = sessions.slice(-5).reduce((a, s) => a + s.wpm, 0) / 5;
    const prev5 = sessions.slice(-10, -5).reduce((a, s) => a + s.wpm, 0) / 5;
    if (recent5 > prev5 + 3) trend = 'improving';
    else if (recent5 < prev5 - 3) trend = 'declining';
  }

  return JSON.stringify({
    avgWpm,
    avgAccuracy,
    bestWpm: data.bestWpm,
    totalSessions: sessions.length,
    trend,
    targetWpm: 100,
    gapToTarget: 100 - avgWpm
  });
}

export async function executeGetWeakKeys(args: { limit?: string }): Promise<string> {
  const limit = parseInt(args.limit || '5', 10);
  const weakKeys = await storage.getWeakKeys(limit);

  if (weakKeys.length === 0) {
    return JSON.stringify({ error: 'No weak key data yet', hint: 'Complete more sessions' });
  }

  return JSON.stringify(weakKeys.map(k => ({
    key: k.key,
    avgMs: k.avg,
    samples: k.count
  })));
}

export async function executeGetWeakBigrams(args: { limit?: string }): Promise<string> {
  const limit = parseInt(args.limit || '5', 10);
  const weakBigrams = await storage.getWeakBigrams(limit);

  if (weakBigrams.length === 0) {
    return JSON.stringify({ error: 'No bigram data yet', hint: 'Complete more sessions' });
  }

  return JSON.stringify(weakBigrams.map(b => ({
    bigram: b.bigram,
    avgMs: b.avg,
    samples: b.count
  })));
}

export async function executeGetRecentSessions(args: { count?: string }): Promise<string> {
  const count = parseInt(args.count || '5', 10);
  const data = await storage.load();
  const sessions = data.sessions.slice(-count).reverse();

  if (sessions.length === 0) {
    return JSON.stringify({ error: 'No sessions yet' });
  }

  return JSON.stringify(sessions.map(s => ({
    wpm: s.wpm,
    accuracy: s.accuracy,
    errors: s.errors,
    mode: s.mode,
    timestamp: new Date(s.timestamp).toLocaleDateString()
  })));
}

export async function executeGetTrainingPlan(): Promise<string> {
  const plan = await trainingPlanService.getTrainingPlan();

  return JSON.stringify({
    difficulty: plan.currentDifficulty,
    mode: plan.practiceMode,
    theme: plan.currentTheme,
    weakKeys: plan.weakKeys.slice(0, 5),
    weakBigrams: plan.weakBigrams.slice(0, 5),
    sessionsSinceUpdate: plan.sessionsSinceUpdate
  });
}

export async function executeUpdateTrainingPlan(args: {
  difficulty?: string;
  mode?: string;
  theme?: string;
}): Promise<string> {
  const plan = await trainingPlanService.getTrainingPlan();
  const updates: Partial<TrainingPlan> = {};

  if (args.difficulty && ['easy', 'medium', 'hard'].includes(args.difficulty)) {
    updates.currentDifficulty = args.difficulty as 'easy' | 'medium' | 'hard';
  }
  if (args.mode && ['words', 'quotes'].includes(args.mode)) {
    updates.practiceMode = args.mode as 'words' | 'quotes';
  }
  if (args.theme) {
    updates.currentTheme = args.theme;
  }

  if (Object.keys(updates).length > 0) {
    await trainingPlanService.updatePlan(updates);
    return JSON.stringify({ success: true, updated: updates });
  }

  return JSON.stringify({ success: false, error: 'No valid updates provided' });
}

// Main tool executor
export async function executeTool(name: string, args: Record<string, string>): Promise<string> {
  switch (name) {
    case 'get_performance_summary':
      return executeGetPerformanceSummary();
    case 'get_weak_keys':
      return executeGetWeakKeys(args);
    case 'get_weak_bigrams':
      return executeGetWeakBigrams(args);
    case 'get_recent_sessions':
      return executeGetRecentSessions(args);
    case 'get_training_plan':
      return executeGetTrainingPlan();
    case 'update_training_plan':
      return executeUpdateTrainingPlan(args);
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
