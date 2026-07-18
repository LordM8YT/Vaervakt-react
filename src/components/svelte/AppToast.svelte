<script>
  import { CircleCheck, Info, TriangleAlert } from "@lucide/svelte";
  import { fade, fly } from "svelte/transition";

  export let message = "";
  export let type = "info";
</script>

{#if message}
  <div
    class={`toast toast-${type}`}
    role="status"
    aria-live="polite"
    in:fly={{ y: 18, duration: 220 }}
    out:fade={{ duration: 140 }}
  >
    {#if type === "success"}
      <CircleCheck size={18} aria-hidden="true" />
    {:else if type === "error"}
      <TriangleAlert size={18} aria-hidden="true" />
    {:else}
      <Info size={18} aria-hidden="true" />
    {/if}
    <span>{message}</span>
  </div>
{/if}
