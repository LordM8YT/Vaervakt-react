<script>
  import { LoaderCircle } from "@lucide/svelte";
</script>

<div class="forecast-skeleton" role="status" aria-label="Laster værdata">
  <div class="skeleton-status">
    <LoaderCircle class="spin" size={18} aria-hidden="true" />
    <span>Henter ferske værdata…</span>
  </div>
  <div class="skeleton-grid" aria-hidden="true">
    <div class="skeleton-column">
      <div class="skeleton-card skeleton-hero">
        <span></span><span></span><span></span>
      </div>
      <div class="skeleton-card skeleton-metrics">
        {#each Array(4) as _}<span></span>{/each}
      </div>
      <div class="skeleton-card skeleton-hours">
        {#each Array(6) as _}<span></span>{/each}
      </div>
    </div>
    <div class="skeleton-card skeleton-days">
      {#each Array(5) as _}<span></span>{/each}
    </div>
  </div>
</div>
