<script>
  import { onDestroy } from "svelte";
  import { LoaderCircle, MapPin, Search, TriangleAlert, X } from "@lucide/svelte";
  import { fetchCities } from "../../api/OpenWeatherService";

  export let onSelect = () => {};

  let query = "";
  let options = [];
  let isLoading = false;
  let isOpen = false;
  let activeIndex = -1;
  let requestId = 0;
  let searchError = false;
  let debounceTimer;
  let searchInput;

  export function focus() {
    searchInput?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => searchInput?.focus(), 180);
  }

  export function clear() {
    clearSearch();
  }

  onDestroy(() => {
    clearTimeout(debounceTimer);
    requestId += 1;
  });

  async function runSearch(value) {
    const currentRequest = ++requestId;
    if (value.trim().length < 2) {
      options = [];
      isOpen = false;
      isLoading = false;
      searchError = false;
      return;
    }

    isLoading = true;
    searchError = false;
    try {
      const cities = await fetchCities(value);
      if (currentRequest !== requestId) return;
      options = cities.data.map((city) => ({
        value: `${city.latitude} ${city.longitude}`,
        label: `${city.name}${city.countryCode ? `, ${city.countryCode}` : ""}`,
      }));
      activeIndex = -1;
      isOpen = true;
    } catch {
      if (currentRequest === requestId) {
        options = [];
        searchError = true;
        isOpen = true;
      }
    } finally {
      if (currentRequest === requestId) isLoading = false;
    }
  }

  function handleInput(event) {
    query = event.currentTarget.value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => runSearch(query), 450);
  }

  function selectOption(option) {
    query = option.label;
    isOpen = false;
    activeIndex = -1;
    searchError = false;
    onSelect(option);
  }

  function clearSearch() {
    query = "";
    options = [];
    isOpen = false;
    activeIndex = -1;
    searchError = false;
  }

  function handleKeydown(event) {
    if (!isOpen || options.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % options.length;
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = (activeIndex - 1 + options.length) % options.length;
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectOption(options[activeIndex]);
    } else if (event.key === "Escape") {
      isOpen = false;
    }
  }
</script>

<div class="search-shell">
  <Search size={19} strokeWidth={2} aria-hidden="true" />
  <input
    bind:this={searchInput}
    type="search"
    role="combobox"
    value={query}
    placeholder="Søk sted eller bydel, f.eks. Grünerløkka"
    aria-label="Søk etter sted"
    aria-expanded={isOpen}
    aria-controls="place-results"
    aria-autocomplete="list"
    aria-activedescendant={activeIndex >= 0 ? `place-option-${activeIndex}` : undefined}
    autocomplete="off"
    on:input={handleInput}
    on:keydown={handleKeydown}
    on:focus={() => (isOpen = options.length > 0)}
    on:blur={() => setTimeout(() => (isOpen = false), 140)}
  />

  {#if isLoading}
    <LoaderCircle class="search-spinner" size={18} aria-label="Søker" />
  {:else if query}
    <button class="icon-button clear-search" type="button" on:click={clearSearch} aria-label="Tøm søket">
      <X size={17} />
    </button>
  {/if}

  {#if isOpen}
    <div id="place-results" class="search-results" role="listbox">
      {#if options.length}
        {#each options as option, index}
          <button
            id={`place-option-${index}`}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            class:active={index === activeIndex}
            on:mousedown|preventDefault={() => selectOption(option)}
          >
            <MapPin size={17} aria-hidden="true" />
            <span>{option.label}</span>
          </button>
        {/each}
      {:else if !isLoading && searchError}
        <p class="search-error"><TriangleAlert size={16} /> Søket kunne ikke fullføres. Prøv igjen.</p>
      {:else if !isLoading}
        <p>Ingen steder funnet. Prøv et annet søk.</p>
      {/if}
    </div>
  {/if}
</div>
