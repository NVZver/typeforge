'use client';

import clsx from 'clsx';

interface TimerProps {
  elapsed: number;
  timeLimit: number;
  isRunning: boolean;
}

export function Timer({ elapsed, timeLimit, isRunning }: TimerProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const remaining = timeLimit > 0 ? Math.max(0, timeLimit - elapsed) : null;
  const isWarning = remaining !== null && remaining <= 10;
  const displayTime = remaining !== null ? remaining : elapsed;

  return (
    <div
      className={clsx(
        'timer',
        isRunning && 'running',
        isWarning && 'warning'
      )}
    >
      {formatTime(displayTime)}
    </div>
  );
}
