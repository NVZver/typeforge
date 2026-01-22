'use client';

import { useMemo } from 'react';
import { TypingEngine } from '@/lib/typing-engine';
import clsx from 'clsx';

interface TextDisplayProps {
  engine: TypingEngine;
  refreshKey?: number;
}

export function TextDisplay({ engine, refreshKey }: TextDisplayProps) {
  const text = engine.getText();
  const currentIndex = engine.getCurrentIndex();
  const charTimings = engine.getCharTimings();

  // Simple character-by-character rendering - most Safari compatible
  const characters = useMemo(() => {
    return text.split('').map((char, i) => {
      let className = 'char';

      if (i < currentIndex) {
        const timing = charTimings.find(t => t.index === i);
        className = clsx(className, timing?.correct ? 'correct' : 'incorrect');
      } else if (i === currentIndex) {
        className = clsx(className, 'current');
      } else {
        className = clsx(className, 'upcoming');
      }

      // Newline character
      if (char === '\n') {
        return (
          <span key={i} className={clsx(className, 'newline-char')}>
            <br />
          </span>
        );
      }

      // Space character - render as word-joiner after, allows wrap before
      if (char === ' ') {
        return (
          <span key={i} className={clsx(className, 'space-char')}>
            {' '}
          </span>
        );
      }

      return (
        <span key={i} className={className}>
          {char}
        </span>
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, currentIndex, charTimings, refreshKey]);

  return <div className="text-display">{characters}</div>;
}
