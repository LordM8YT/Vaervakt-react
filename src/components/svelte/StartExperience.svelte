<script>
  import { CloudSun, LocateFixed, Search, ShieldCheck, Sparkles } from "@lucide/svelte";

  export let onUsePosition = () => {};
  export let onSearch = () => {};
  export let isLocating = false;
</script>

<section class="start-experience">
  <div class="start-glow" aria-hidden="true"></div>
  <div class="start-icon"><CloudSun size={52} strokeWidth={1.5} aria-hidden="true" /></div>
  <span class="start-kicker"><Sparkles size={14} /> Værvakt er klar</span>
  <h1>Lokalt vær.<br /><em>Null støy.</em></h1>
  <p>
    Presist vær fra MET, lokale observasjoner og badetemperatur — samlet rundt stedet
    du faktisk bryr deg om.
  </p>
  <div class="start-actions">
    <button class="primary-button" type="button" on:click={onUsePosition} disabled={isLocating}>
      <LocateFixed size={18} class={isLocating ? "locating" : ""} />
      {isLocating ? "Finner deg…" : "Bruk min posisjon"}
    </button>
    <button class="secondary-button" type="button" on:click={onSearch}>
      <Search size={18} />
      Søk etter sted
    </button>
  </div>
  <div class="start-trust">
    <span><ShieldCheck size={15} /> Ingen annonser</span>
    <span>GPS kun når du ber om det</span>
  </div>
</section>
