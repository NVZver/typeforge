/**
 * Framework-agnostic typing engine for keystroke processing and metrics.
 * Tracks per-key and bigram timing, computes WPM/accuracy.
 */

export interface KeystrokeResult {
  correct: boolean;
  complete: boolean;
  expectedChar: string;
  index: number;
}

export interface TypingMetrics {
  wpm: number;
  accuracy: number;
  errors: number;
  characters: number;
  duration_ms: number;
}

export interface KeyStats {
  avgTime: number;
  count: number;
}

export class TypingEngine {
  private text: string = '';
  private currentIndex: number = 0;
  private totalKeystrokes: number = 0;
  private totalErrors: number = 0;
  private startTime: number | null = null;
  private endTime: number | null = null;
  private keyTimes: Record<string, number[]> = {};
  private bigramTimes: Record<string, number[]> = {};
  private lastKeyTime: number | null = null;
  private lastChar: string | null = null;
  private isComplete: boolean = false;

  /**
   * Initialize engine with target text.
   * @throws Error if text is empty
   */
  setText(text: string): void {
    if (!text || text.length === 0) {
      throw new Error('Text cannot be empty');
    }
    this.reset();
    this.text = text;
  }

  /**
   * Reset all state for new session.
   */
  reset(): void {
    this.text = '';
    this.currentIndex = 0;
    this.totalKeystrokes = 0;
    this.totalErrors = 0;
    this.startTime = null;
    this.endTime = null;
    this.keyTimes = {};
    this.bigramTimes = {};
    this.lastKeyTime = null;
    this.lastChar = null;
    this.isComplete = false;
  }

  /**
   * Process a single keystroke.
   * Always advances cursor - user can backspace to fix mistakes.
   */
  processKey(inputChar: string): KeystrokeResult {
    if (this.isComplete) {
      return { correct: false, complete: true, expectedChar: '', index: this.currentIndex };
    }

    const now = performance.now();

    // Start timing on first character (don't record timing for first keystroke)
    const isFirstKeystroke = this.startTime === null;
    if (isFirstKeystroke) {
      this.startTime = now;
    }

    const expectedChar = this.text[this.currentIndex];
    const correct = inputChar === expectedChar;

    // Record timing (skip first keystroke - no meaningful elapsed time)
    const lowerChar = expectedChar.toLowerCase();
    if (!isFirstKeystroke && this.lastKeyTime !== null) {
      const elapsed = now - this.lastKeyTime;

      // Track per-key timing (only for correct keystrokes)
      if (correct) {
        if (!this.keyTimes[lowerChar]) {
          this.keyTimes[lowerChar] = [];
        }
        this.keyTimes[lowerChar].push(elapsed);
      }

      // Track bigram timing (only for correct consecutive keystrokes)
      if (this.lastChar !== null && correct) {
        const bigram = this.lastChar.toLowerCase() + lowerChar;
        if (!this.bigramTimes[bigram]) {
          this.bigramTimes[bigram] = [];
        }
        this.bigramTimes[bigram].push(elapsed);
      }
    }

    // Track all keystrokes and errors (never decremented on delete)
    this.totalKeystrokes++;
    if (!correct) {
      this.totalErrors++;
    }

    // Always advance cursor
    const resultIndex = this.currentIndex;
    this.currentIndex++;
    this.lastChar = expectedChar;
    this.lastKeyTime = now;

    // Check completion
    if (this.currentIndex >= this.text.length) {
      this.endTime = now;
      this.isComplete = true;
    }

    return {
      correct,
      complete: this.isComplete,
      expectedChar,
      index: resultIndex,
    };
  }

  /**
   * Delete last character (backspace).
   * Returns true if deletion occurred.
   */
  deleteChar(): boolean {
    if (this.currentIndex <= 0) {
      return false;
    }

    // Allow resuming from completed state
    if (this.isComplete) {
      this.isComplete = false;
      this.endTime = null;
    }

    this.currentIndex--;

    // Update lastChar for bigram tracking
    if (this.currentIndex > 0) {
      this.lastChar = this.text[this.currentIndex - 1];
    } else {
      this.lastChar = null;
    }

    return true;
  }

  /**
   * Delete last word (Ctrl+Backspace).
   * Returns number of characters deleted.
   */
  deleteWord(): number {
    if (this.currentIndex <= 0) {
      return 0;
    }

    let deleted = 0;

    // Skip any spaces at current position
    while (this.currentIndex > 0 && this.text[this.currentIndex - 1] === ' ') {
      this.deleteChar();
      deleted++;
    }

    // Delete until we hit a space or start of text
    while (this.currentIndex > 0 && this.text[this.currentIndex - 1] !== ' ') {
      this.deleteChar();
      deleted++;
    }

    return deleted;
  }

  /**
   * Get current typing metrics.
   * WPM = (characters / 5) / minutes
   * Accuracy = (correct / total) * 100
   */
  getMetrics(): TypingMetrics {
    const now = this.endTime || performance.now();
    const duration_ms = now - (this.startTime || now);
    const elapsedMinutes = duration_ms / 60000;

    // WPM: characters typed divided by 5 (standard word length) divided by minutes
    const wpm = elapsedMinutes > 0 ? Math.round((this.currentIndex / 5) / elapsedMinutes) : 0;

    // Accuracy: correct keystrokes / total keystrokes
    const correctKeystrokes = this.totalKeystrokes - this.totalErrors;
    const accuracy = this.totalKeystrokes > 0
      ? correctKeystrokes / this.totalKeystrokes
      : 0;

    return {
      wpm,
      accuracy,
      errors: this.totalErrors,
      characters: this.currentIndex,
      duration_ms: Math.round(duration_ms),
    };
  }

  /**
   * Convert timing arrays to stats format.
   */
  private computeTimingStats(timesMap: Record<string, number[]>): Record<string, KeyStats> {
    const stats: Record<string, KeyStats> = {};
    for (const [key, times] of Object.entries(timesMap)) {
      if (times.length > 0) {
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        stats[key] = { avgTime: Math.round(avgTime), count: times.length };
      }
    }
    return stats;
  }

  /**
   * Get per-key timing statistics in API-ready format.
   */
  getKeyStats(): Record<string, KeyStats> {
    return this.computeTimingStats(this.keyTimes);
  }

  /**
   * Get bigram timing statistics in API-ready format.
   */
  getBigramStats(): Record<string, KeyStats> {
    return this.computeTimingStats(this.bigramTimes);
  }

  /** Get target text */
  getText(): string {
    return this.text;
  }

  /** Get current cursor position */
  getCurrentIndex(): number {
    return this.currentIndex;
  }

  /** Check if session is complete */
  getIsComplete(): boolean {
    return this.isComplete;
  }

  /** Check if session has started (first key pressed) */
  hasStarted(): boolean {
    return this.startTime !== null;
  }
}
