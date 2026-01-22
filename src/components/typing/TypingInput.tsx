'use client';

import { useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';

interface TypingInputProps {
  onInput: (char: string) => void;
  onNewText: () => void;
  onDelete?: () => void;
  onDeleteWord?: () => void;
  disabled?: boolean;
  hasError?: boolean;
  isComplete?: boolean;
}

export function TypingInput({
  onInput,
  onNewText,
  onDelete,
  onDeleteWord,
  disabled,
  hasError,
  isComplete
}: TypingInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep textarea focused at all times
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.focus();

    // Refocus when clicking anywhere on the page (except chat interface)
    const handleClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.chat-interface')) {
        return; // Don't steal focus from chat input
      }
      textarea.focus();
    };

    // Refocus if textarea loses focus (except when chat is focused)
    const handleBlur = () => {
      setTimeout(() => {
        const activeEl = document.activeElement;
        if (activeEl?.closest('.chat-interface')) {
          return; // Don't steal focus from chat input
        }
        textarea.focus();
      }, 10);
    };

    document.addEventListener('click', handleClick);
    textarea.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('click', handleClick);
      textarea.removeEventListener('blur', handleBlur);
    };
  }, []);

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    if (disabled || isComplete) return;

    const value = e.target.value;
    if (value.length > 0) {
      // Get the last character (could be newline from Enter)
      onInput(value[value.length - 1]);
      e.target.value = '';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (e.altKey || e.ctrlKey) {
        // Option+Backspace (Mac) or Ctrl+Backspace (Windows) - delete word
        onDeleteWord?.();
      } else {
        // Regular backspace - delete single character
        onDelete?.();
      }
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      // Tab always generates new text (useful after completion)
      onNewText();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onNewText();
    }
    // Enter key is allowed - it will be captured as '\n' in handleInput
  };

  return (
    <textarea
      ref={textareaRef}
      className="typing-input-hidden"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      disabled={disabled}
      onChange={handleInput}
      onKeyDown={handleKeyDown}
      aria-label="Typing input"
    />
  );
}
