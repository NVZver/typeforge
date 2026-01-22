'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { TypingStats } from '@/lib/types';
import { KeyboardHeatmap } from './KeyboardHeatmap';
import { aiCoach } from '@/lib/ai-coach';
import clsx from 'clsx';

interface ExerciseSummaryProps {
  stats: TypingStats;
  keyTimes: Record<string, number[]>;
  bestWpm: number;
  onRefresh: () => void;
}

export function ExerciseSummary({ stats, keyTimes, bestWpm, onRefresh }: ExerciseSummaryProps) {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);

  // Generate AI summary on mount
  useEffect(() => {
    const generateSummary = async () => {
      setIsLoadingSummary(true);
      try {
        const summary = await aiCoach.generateSessionSummary(stats, keyTimes, bestWpm);
        setAiSummary(summary);
      } catch (error) {
        console.error('Failed to generate AI summary:', error);
        setAiSummary(null);
      } finally {
        setIsLoadingSummary(false);
      }
    };

    generateSummary();
  }, [stats, keyTimes, bestWpm]);

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

  const isNewBest = stats.wpm >= bestWpm && stats.wpm > 0;

  return (
    <div className="exercise-summary">
      <h2 className="summary-title">
        {isNewBest ? '🎉 New Personal Best!' : 'Exercise Complete'}
      </h2>

      <div className="summary-stats">
        <div className="summary-stat-card">
          <div className={clsx('summary-stat-value', getWpmClass(stats.wpm))}>
            {stats.wpm}
          </div>
          <div className="summary-stat-label">WPM</div>
        </div>
        <div className="summary-stat-card">
          <div className={clsx('summary-stat-value', getAccuracyClass(stats.accuracy))}>
            {stats.accuracy}%
          </div>
          <div className="summary-stat-label">Accuracy</div>
        </div>
        <div className="summary-stat-card">
          <div className="summary-stat-value">{stats.errors}</div>
          <div className="summary-stat-label">Errors</div>
        </div>
        <div className="summary-stat-card">
          <div className="summary-stat-value">{stats.elapsed}s</div>
          <div className="summary-stat-label">Time</div>
        </div>
      </div>

      <div className="summary-ai">
        <h3>AI Analysis</h3>
        {isLoadingSummary ? (
          <div className="ai-loading">
            <span className="loading-dot"></span>
            <span className="loading-dot"></span>
            <span className="loading-dot"></span>
          </div>
        ) : aiSummary ? (
          <div className="ai-summary-content markdown-content">
            <ReactMarkdown skipHtml>{aiSummary}</ReactMarkdown>
          </div>
        ) : (
          <p className="ai-error">Could not generate AI analysis</p>
        )}
      </div>

      <KeyboardHeatmap keyTimes={keyTimes} />

      <button
        className="refresh-button"
        onClick={onRefresh}
      >
        New Exercise
      </button>
      <div className="refresh-hint">
        Press <kbd>Tab</kbd> then <kbd>Space</kbd> or <kbd>Enter</kbd>
      </div>
    </div>
  );
}
