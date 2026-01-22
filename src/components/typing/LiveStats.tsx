'use client';

import { TypingStats } from '@/lib/types';
import clsx from 'clsx';

interface LiveStatsProps {
  stats: TypingStats;
  bestWpm: number;
}

export function LiveStats({ stats, bestWpm }: LiveStatsProps) {
  const getWpmClass = (wpm: number) => {
    if (wpm >= 90) return 'success';
    if (wpm >= 70) return 'warning';
    return '';
  };

  const getAccuracyClass = (accuracy: number) => {
    if (accuracy >= 98) return 'success';
    if (accuracy >= 95) return 'warning';
    return 'error';
  };

  return (
    <div className="stats-bar">
      <div className="stat-card">
        <div className={clsx('stat-value', getWpmClass(stats.wpm))}>
          {stats.wpm}
        </div>
        <div className="stat-label">WPM</div>
      </div>
      <div className="stat-card">
        <div className={clsx('stat-value', getAccuracyClass(stats.accuracy))}>
          {stats.accuracy}
        </div>
        <div className="stat-label">Accuracy %</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{stats.errors}</div>
        <div className="stat-label">Errors</div>
      </div>
      <div className="stat-card">
        <div className="stat-value">{bestWpm}</div>
        <div className="stat-label">Best WPM</div>
      </div>
    </div>
  );
}
