<script>
  import { CloudSun, MapPin, Waves } from "@lucide/svelte";

  export let tabs = [];
  export let activeTab = "weather";
  export let onSelect = () => {};
</script>

<nav
  class="bottom-nav"
  style={`--tab-count: ${tabs.length}`}
  aria-label="Hovedmeny"
>
  {#each tabs as tab}
    <button
      type="button"
      class:active={activeTab === tab.value}
      aria-current={activeTab === tab.value ? "page" : undefined}
      on:click={() => onSelect(tab.value)}
    >
      <span class="nav-icon">
        {#if tab.value === "weather"}
          <CloudSun size={19} />
        {:else if tab.value === "local"}
          <MapPin size={19} />
        {:else if tab.value === "bath"}
          <Waves size={19} />
        {/if}
      </span>
      <span>{tab.label}</span>
    </button>
  {/each}
</nav>
