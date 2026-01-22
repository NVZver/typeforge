import { CharTiming, TypingStats } from './types';

export class TypingEngine {
  private text: string = '';
  private currentIndex: number = 0;
  private totalKeystrokes: number = 0;  // All characters typed (not decremented on delete)
  private totalErrors: number = 0;       // All errors made (not decremented on delete)
  private startTime: number | null = null;
  private endTime: number | null = null;
  private keyTimes: Record<string, number[]> = {};
  private bigramTimes: Record<string, number[]> = {};
  private lastKeyTime: number | null = null;
  private lastChar: string | null = null;
  private charTimings: CharTiming[] = [];
  private isComplete: boolean = false;

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
    this.charTimings = [];
    this.isComplete = false;
  }

  setText(text: string): void {
    this.reset();
    this.text = text;
  }

  processInput(inputChar: string): { correct: boolean; complete: boolean; expectedChar: string; index: number } {
    if (this.isComplete) {
      return { correct: false, complete: true, expectedChar: '', index: this.currentIndex };
    }

    const now = performance.now();

    // Start timing on first character
    if (this.startTime === null) {
      this.startTime = now;
      this.lastKeyTime = now;
    }

    const expectedChar = this.text[this.currentIndex];
    const correct = inputChar === expectedChar;

    // Record timing
    const elapsed = now - (this.lastKeyTime || now);
    this.charTimings.push({
      char: expectedChar,
      time: elapsed,
      correct: correct,
      index: this.currentIndex
    });

    // Track key timing
    const lowerChar = expectedChar.toLowerCase();
    if (!this.keyTimes[lowerChar]) {
      this.keyTimes[lowerChar] = [];
    }
    if (correct) {
      this.keyTimes[lowerChar].push(elapsed);
    }

    // Track bigram timing
    if (this.lastChar !== null && correct) {
      const bigram = this.lastChar.toLowerCase() + lowerChar;
      if (!this.bigramTimes[bigram]) {
        this.bigramTimes[bigram] = [];
      }
      this.bigramTimes[bigram].push(elapsed);
    }

    // Track all keystrokes and errors (never decremented, even on delete)
    this.totalKeystrokes++;
    if (!correct) {
      this.totalErrors++;
    }

    // Always advance cursor - user can backspace to fix mistakes
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
      index: this.currentIndex - 1
    };
  }

  getStats(): TypingStats {
    const now = this.endTime || performance.now();
    const elapsedMinutes = (now - (this.startTime || now)) / 60000;

    // WPM: (text progress / 5) / total minutes
    // Measures how fast you complete the text, including all errors and fixes
    const wpm = elapsedMinutes > 0 ? Math.round((this.currentIndex / 5) / elapsedMinutes) : 0;

    // Accuracy: correct keystrokes / total keystrokes (errors count even if fixed)
    const correctKeystrokes = this.totalKeystrokes - this.totalErrors;
    const accuracy = this.totalKeystrokes > 0
      ? Math.round((correctKeystrokes / this.totalKeystrokes) * 100)
      : 100;

    return {
      wpm,
      accuracy,
      errors: this.totalErrors,
      characters: this.currentIndex,
      elapsed: Math.round((now - (this.startTime || now)) / 1000),
      complete: this.isComplete
    };
  }

  getKeyTimes(): Record<string, number[]> {
    return this.keyTimes;
  }

  getBigramTimes(): Record<string, number[]> {
    return this.bigramTimes;
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  getText(): string {
    return this.text;
  }

  getCharTimings(): CharTiming[] {
    return this.charTimings;
  }

  getIsComplete(): boolean {
    return this.isComplete;
  }

  hasStarted(): boolean {
    return this.startTime !== null;
  }

  deleteChar(): boolean {
    if (this.currentIndex <= 0) {
      return false;
    }

    // Allow deleting from completed state
    if (this.isComplete) {
      this.isComplete = false;
      this.endTime = null;
    }

    // Save index before decrementing to remove correct timing entries
    const indexToRemove = this.currentIndex - 1;
    this.currentIndex--;

    // Remove ALL timing entries for this index (handles error retries)
    this.charTimings = this.charTimings.filter(t => t.index !== indexToRemove);

    // Update lastChar for bigram tracking
    if (this.currentIndex > 0) {
      this.lastChar = this.text[this.currentIndex - 1];
    } else {
      this.lastChar = null;
    }

    return true;
  }

  deleteWord(): number {
    if (this.currentIndex <= 0) {
      return 0;
    }

    let deleted = 0;
    const text = this.text;

    // Skip any spaces at current position
    while (this.currentIndex > 0 && text[this.currentIndex - 1] === ' ') {
      this.deleteChar();
      deleted++;
    }

    // Delete until we hit a space or start of text
    while (this.currentIndex > 0 && text[this.currentIndex - 1] !== ' ') {
      this.deleteChar();
      deleted++;
    }

    return deleted;
  }
}
