<script lang="ts">
  import { TypingEngine, type TypingMetrics, type KeyStats } from '../lib/typing-engine';

  interface Props {
    text: string;
    onComplete: (data: {
      metrics: TypingMetrics;
      keyStats: Record<string, KeyStats>;
      bigramStats: Record<string, KeyStats>;
      text: string;
    }) => void;
    onCancel: () => void;
  }

  let { text, onComplete, onCancel }: Props = $props();

  const engine = new TypingEngine();
  let charSpans: HTMLSpanElement[] = [];
  let containerEl: HTMLDivElement | undefined = $state();

  // Initialize engine with text
  $effect(() => {
    engine.setText(text);
  });

  // Set up DOM refs and event listeners
  $effect(() => {
    if (!containerEl) return;

    // Collect all character span elements
    charSpans = Array.from(containerEl.querySelectorAll('.char'));

    // Mark first character as current
    if (charSpans[0]) {
      charSpans[0].classList.add('current');
      charSpans[0].classList.remove('upcoming');
    }

    // Add keyboard event listener
    window.addEventListener('keydown', handleKeydown);

    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  });

  function updateCharacterDisplay(index: number, correct: boolean) {
    // Update previous character (remove current styling)
    if (index > 0 && charSpans[index - 1]) {
      charSpans[index - 1].classList.remove('current');
    }

    // Update typed character
    if (charSpans[index]) {
      charSpans[index].classList.remove('upcoming', 'current');
      charSpans[index].classList.add(correct ? 'correct' : 'incorrect');
    }

    // Update next character as current
    if (index + 1 < charSpans.length && charSpans[index + 1]) {
      charSpans[index + 1].classList.remove('upcoming');
      charSpans[index + 1].classList.add('current');
    }
  }

  function handleBackspace(index: number) {
    // Restore the deleted character to current state
    if (charSpans[index]) {
      charSpans[index].classList.remove('correct', 'incorrect');
      charSpans[index].classList.add('current');
    }

    // Remove current from next character, make it upcoming
    if (index + 1 < charSpans.length && charSpans[index + 1]) {
      charSpans[index + 1].classList.remove('current');
      charSpans[index + 1].classList.add('upcoming');
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    // Escape cancels session
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }

    // Backspace handling
    if (e.key === 'Backspace') {
      e.preventDefault();
      const prevIndex = engine.getCurrentIndex();

      if (e.ctrlKey || e.metaKey) {
        // Delete word - update visual state for each deleted char
        const deleted = engine.deleteWord();
        const newIndex = engine.getCurrentIndex();
        for (let charIndex = newIndex; charIndex < prevIndex; charIndex++) {
          handleBackspace(charIndex);
        }
        // Ensure the new current position is highlighted
        if (charSpans[newIndex]) {
          charSpans[newIndex].classList.remove('upcoming', 'correct', 'incorrect');
          charSpans[newIndex].classList.add('current');
        }
      } else {
        // Delete single char
        if (engine.deleteChar()) {
          handleBackspace(prevIndex - 1);
        }
      }
      return;
    }

    // Ignore modifier keys and special keys (arrows, function keys, etc.)
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    e.preventDefault();

    const result = engine.processKey(e.key);
    updateCharacterDisplay(result.index, result.correct);

    if (result.complete) {
      // Auto-transition to chat with session data
      const metrics = engine.getMetrics();
      const keyStats = engine.getKeyStats();
      const bigramStats = engine.getBigramStats();

      onComplete({
        metrics,
        keyStats,
        bigramStats,
        text: engine.getText(),
      });
    }
  }
</script>

<div class="fixed inset-0 bg-[var(--color-bg-primary)] flex flex-col items-center justify-center p-8">
  <div class="max-w-4xl w-full">
    <!-- Header -->
    <div class="mb-8 text-center">
      <p class="text-[var(--color-text-secondary)] text-sm mb-2">Press ESC to cancel</p>
      <h2 class="text-[var(--color-accent-cyan)] text-xl font-semibold">Type the following:</h2>
    </div>

    <!-- Text display with character spans -->
    <div
      bind:this={containerEl}
      class="bg-[var(--color-bg-secondary)] rounded-lg p-8 text-2xl leading-relaxed font-mono tracking-wide select-none"
    >
      {#each text.split('') as char, i}
        <span class="char upcoming" data-index={i}>{char === ' ' ? '\u00A0' : char}</span>
      {/each}
    </div>

    <!-- Instructions -->
    <p class="text-center text-[var(--color-text-secondary)] mt-8 text-sm">
      Start typing to begin • Backspace to fix mistakes • Ctrl+Backspace to delete word
    </p>
  </div>
</div>

<style>
  .char {
    display: inline;
    transition: color 0.05s ease, text-shadow 0.1s ease;
  }

  .upcoming {
    color: var(--color-text-secondary);
  }

  .current {
    color: var(--color-text-primary);
    text-shadow: 0 0 8px rgba(255, 255, 255, 0.8), 0 0 16px rgba(255, 255, 255, 0.4);
  }

  .correct {
    color: var(--color-accent-cyan);
  }

  .incorrect {
    color: var(--color-accent-magenta);
    text-decoration: underline;
    text-decoration-color: var(--color-accent-magenta);
  }
</style>
