import { StorageData, Session, Settings, DailyStats, CalendarDay, WeakKey, WeakBigram } from './types';

const OLD_STORAGE_KEY = 'typeforge_data';

const defaultSettings: Settings = {
  targetWpm: 85,
  speedDuration: 30,
  enduranceDuration: 3,
  burstWords: 5,
  dailyGoal: 10,
  aiEndpoint: 'http://localhost:1234/v1'
};

const getDefaultData = (): StorageData => ({
  sessions: [],
  keyStats: {},
  bigramStats: {},
  bestWpm: 0,
  dailyGoal: 10,
  settings: { ...defaultSettings }
});

// Client-side cache to reduce API calls
let cachedData: StorageData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 seconds

async function fetchWithCache(): Promise<StorageData> {
  if (typeof window === 'undefined') {
    return getDefaultData();
  }

  const now = Date.now();
  if (cachedData && now - cacheTimestamp < CACHE_TTL) {
    return cachedData;
  }

  try {
    const response = await fetch('/api/data');
    if (!response.ok) throw new Error('Failed to fetch data');
    cachedData = await response.json();
    cacheTimestamp = now;
    return cachedData!;
  } catch (e) {
    console.error('Failed to load data:', e);
    return getDefaultData();
  }
}

function invalidateCache() {
  cachedData = null;
  cacheTimestamp = 0;
}

// Check for localStorage data and migrate it
async function migrateFromLocalStorage(): Promise<void> {
  if (typeof window === 'undefined') return;

  const localData = localStorage.getItem(OLD_STORAGE_KEY);
  if (!localData) return;

  try {
    const data = JSON.parse(localData);
    if (data.sessions && data.sessions.length > 0) {
      console.log('Migrating data from localStorage to SQLite...');
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (response.ok) {
        // Clear localStorage after successful migration
        localStorage.removeItem(OLD_STORAGE_KEY);
        invalidateCache();
        console.log('Migration complete');
      }
    }
  } catch (e) {
    console.error('Migration failed:', e);
  }
}

// Initialize and run migration
let migrationPromise: Promise<void> | null = null;
function ensureMigration(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = migrateFromLocalStorage();
  }
  return migrationPromise;
}

export const storage = {
  async load(): Promise<StorageData> {
    await ensureMigration();
    return fetchWithCache();
  },

  async addSession(session: Session): Promise<StorageData> {
    await ensureMigration();
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session)
      });
      if (!response.ok) throw new Error('Failed to add session');
      invalidateCache();
      return this.load();
    } catch (e) {
      console.error('Failed to add session:', e);
      throw e;
    }
  },

  // Daily tracking methods
  async getDailyStats(date: Date = new Date()): Promise<DailyStats> {
    const data = await this.load();
    const dayStart = new Date(date).setHours(0, 0, 0, 0);
    const dayEnd = dayStart + 86400000;

    const todaySessions = data.sessions.filter(s =>
      s.timestamp >= dayStart && s.timestamp < dayEnd
    );

    if (todaySessions.length === 0) {
      return { sessions: 0, avgWpm: 0, bestWpm: 0, totalChars: 0 };
    }

    return {
      sessions: todaySessions.length,
      avgWpm: Math.round(todaySessions.reduce((a, s) => a + s.wpm, 0) / todaySessions.length),
      bestWpm: Math.max(...todaySessions.map(s => s.wpm)),
      totalChars: todaySessions.reduce((a, s) => a + s.characters, 0)
    };
  },

  async getStreak(): Promise<number> {
    const data = await this.load();
    if (data.sessions.length === 0) return 0;

    let streak = 0;
    const today = new Date().setHours(0, 0, 0, 0);
    let checkDate = today;

    // Check if practiced today
    const todayStats = await this.getDailyStats(new Date(today));
    if (todayStats.sessions === 0) {
      // Check yesterday - streak continues if yesterday had sessions
      checkDate = today - 86400000;
    }

    while (true) {
      const dayStats = await this.getDailyStats(new Date(checkDate));
      if (dayStats.sessions > 0) {
        streak++;
        checkDate -= 86400000;
      } else {
        break;
      }
    }

    return streak;
  },

  async getUniqueDays(): Promise<number> {
    const data = await this.load();
    const days = new Set<string>();
    data.sessions.forEach(s => {
      days.add(new Date(s.timestamp).toDateString());
    });
    return days.size;
  },

  async getCalendarData(weeks: number = 4): Promise<CalendarDay[]> {
    const data = await this.load();
    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start from (weeks * 7) days ago
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (weeks * 7) + 1);

    for (let i = 0; i < weeks * 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dayStart = date.getTime();
      const dayEnd = dayStart + 86400000;

      const daySessions = data.sessions.filter(s =>
        s.timestamp >= dayStart && s.timestamp < dayEnd
      );

      days.push({
        date: date,
        sessions: daySessions.length,
        avgWpm: daySessions.length > 0
          ? Math.round(daySessions.reduce((a, s) => a + s.wpm, 0) / daySessions.length)
          : 0,
        isToday: date.getTime() === today.getTime(),
        isFuture: date.getTime() > today.getTime()
      });
    }

    return days;
  },

  async updateKeyStats(keyTimes: Record<string, number[]>): Promise<StorageData> {
    await ensureMigration();
    try {
      const response = await fetch('/api/key-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keyTimes)
      });
      if (!response.ok) throw new Error('Failed to update key stats');
      invalidateCache();
      return this.load();
    } catch (e) {
      console.error('Failed to update key stats:', e);
      throw e;
    }
  },

  async updateBigramStats(bigramTimes: Record<string, number[]>): Promise<StorageData> {
    await ensureMigration();
    try {
      const response = await fetch('/api/bigram-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bigramTimes)
      });
      if (!response.ok) throw new Error('Failed to update bigram stats');
      invalidateCache();
      return this.load();
    } catch (e) {
      console.error('Failed to update bigram stats:', e);
      throw e;
    }
  },

  async getWeakKeys(count: number = 5): Promise<WeakKey[]> {
    const data = await this.load();
    const avgTimes: WeakKey[] = [];
    for (const [key, stats] of Object.entries(data.keyStats)) {
      if (stats.times.length >= 5) {
        const avg = stats.times.reduce((a, b) => a + b, 0) / stats.times.length;
        avgTimes.push({ key, avg: Math.round(avg), count: stats.times.length });
      }
    }
    return avgTimes.sort((a, b) => b.avg - a.avg).slice(0, count);
  },

  async getWeakBigrams(count: number = 8): Promise<WeakBigram[]> {
    const data = await this.load();
    const avgTimes: WeakBigram[] = [];
    for (const [bigram, times] of Object.entries(data.bigramStats)) {
      if (times.length >= 3) {
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        avgTimes.push({ bigram, avg: Math.round(avg), count: times.length });
      }
    }
    return avgTimes.sort((a, b) => b.avg - a.avg).slice(0, count);
  },

  // Data management
  async exportData(): Promise<string> {
    const data = await this.load();
    return JSON.stringify({
      ...data,
      version: '1.0',
      exportedAt: new Date().toISOString()
    }, null, 2);
  },

  async importData(jsonString: string): Promise<{ success: boolean; sessionsImported?: number; error?: string }> {
    await ensureMigration();
    try {
      const imported = JSON.parse(jsonString);
      if (!imported.sessions || !Array.isArray(imported.sessions)) {
        throw new Error('Invalid data format');
      }

      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(imported)
      });

      if (!response.ok) throw new Error('Failed to import data');

      invalidateCache();
      const result = await response.json();
      return { success: true, sessionsImported: result.sessionsImported };
    } catch (e) {
      console.error('Import failed:', e);
      return { success: false, error: (e as Error).message };
    }
  },

  async clearAll(): Promise<void> {
    try {
      const response = await fetch('/api/clear', { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to clear data');
      invalidateCache();
    } catch (e) {
      console.error('Failed to clear data:', e);
      throw e;
    }
  },

  // Settings
  async saveSettings(settings: Partial<Settings>): Promise<void> {
    await ensureMigration();
    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (!response.ok) throw new Error('Failed to save settings');
      invalidateCache();
    } catch (e) {
      console.error('Failed to save settings:', e);
      throw e;
    }
  },

  async getSettings(): Promise<Settings> {
    const data = await this.load();
    return data.settings;
  }
};
