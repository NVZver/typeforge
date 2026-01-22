import { CharTiming, TypingStats } from './types';

export class TypingEngine {
  private text: string = '';
  private currentIndex: number = 0;
  private totalErrors: number = 0;
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

    if (correct) {
      this.currentIndex++;
      this.lastChar = expectedChar;
    } else {
      this.totalErrors++;
    }

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
      index: this.currentIndex - (correct ? 1 : 0)
    };
  }

  getStats(): TypingStats {
    const now = this.endTime || performance.now();
    const elapsedMinutes = (now - (this.startTime || now)) / 60000;

    // WPM: (characters / 5) / minutes
    const wpm = elapsedMinutes > 0 ? Math.round((this.currentIndex / 5) / elapsedMinutes) : 0;

    // Accuracy: (correctChars / totalAttempts) * 100
    const totalAttempts = this.currentIndex + this.totalErrors;
    const accuracy = totalAttempts > 0 ? Math.round((this.currentIndex / totalAttempts) * 100) : 100;

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
}
