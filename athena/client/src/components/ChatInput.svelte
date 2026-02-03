<script lang="ts">
  interface Props {
    onSend: (message: string) => void;
    disabled?: boolean;
    placeholder?: string;
  }

  let { onSend, disabled = false, placeholder = 'Talk to Athena...' }: Props = $props();

  let input = $state('');

  function handleSubmit(e: Event) {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || disabled) return;
    onSend(msg);
    input = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }
</script>

<form onsubmit={handleSubmit} class="p-4 border-t border-[var(--color-bg-tertiary)]">
  <div class="flex gap-2 max-w-2xl mx-auto">
    <input
      type="text"
      bind:value={input}
      onkeydown={handleKeydown}
      {placeholder}
      {disabled}
      class="flex-1 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-tertiary)] rounded px-3 py-2 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-accent-cyan)] disabled:opacity-50"
    />
    <button
      type="submit"
      disabled={disabled || !input.trim()}
      class="bg-[var(--color-accent-cyan)] text-[var(--color-bg-primary)] px-4 py-2 rounded font-bold disabled:opacity-50 disabled:cursor-not-allowed"
    >
      Send
    </button>
  </div>
</form>
