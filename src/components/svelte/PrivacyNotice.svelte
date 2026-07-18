<script>
  import { ExternalLink, ShieldCheck, X } from "@lucide/svelte";
  import { onMount } from "svelte";

  export let onClose = () => {};
  let closeButton;

  onMount(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    const handleKeydown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeydown);
    closeButton?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeydown);
      previousFocus?.focus?.();
    };
  });
</script>

<div class="privacy-backdrop" role="presentation">
  <dialog
    class="privacy-dialog"
    open
    aria-modal="true"
    aria-labelledby="privacy-title"
    on:cancel|preventDefault={onClose}
  >
    <header>
      <div class="privacy-title">
        <ShieldCheck size={24} aria-hidden="true" />
        <div>
          <span class="eyebrow">Sist oppdatert 18. juli 2026</span>
          <h2 id="privacy-title">Personvern på Værvakt.no</h2>
        </div>
      </div>
      <button
        class="icon-button"
        type="button"
        bind:this={closeButton}
        on:click={onClose}
        aria-label="Lukk personvern"
      >
        <X size={19} />
      </button>
    </header>

    <div class="privacy-content">
      <p>
        Behandlingsansvarlig er Værvakt.no, drevet av
        <a href="https://github.com/LordM8YT" target="_blank" rel="noopener noreferrer">
          LordM8YT <ExternalLink size={13} />
        </a>.
        Personvernhenvendelser kan sendes til
        <a href="mailto:kontakt@xn--vrvakt-pua.no">kontakt@værvakt.no</a>.
      </p>

      <article>
        <h3>Vær, søk og posisjon</h3>
        <p>
          GPS brukes bare når du trykker «Bruk posisjon» og godkjenner i nettleseren.
          Koordinatene brukes til å hente vær og finne stedsnavn. Det valgte stedet
          caches lokalt på enheten, slik at det kan brukes igjen ved neste besøk.
          GPS-koordinater beholdes med full presisjon fra nettleseren i denne lokale
          cachen. De fjernes når du velger «Glem lagret sted» eller sletter
          nettleserdata. Værvakt lagrer ikke denne stedscachen på serveren.
          Stedssøk og reserveoppslag går via OpenStreetMap Nominatim. Værdata hentes fra
          Meteorologisk institutt, og norske stedsnavn kan slås opp via
          Kartverket/Geonorge. Grunnlaget er å levere tjenesten du ber om, jf. GDPR
          artikkel 6 nr. 1 bokstav b.
        </p>
      </article>

      <article>
        <h3>Lokale værrapporter</h3>
        <p>
          En rapport kan inneholde valgfritt visningsnavn, værtype, temperatur, sted og
          grovt avrundede koordinater. Rapporten vises offentlig i inntil 7 dager.
          Den kan oppbevares i maksimalt 30 dager for moderering før automatisk sletting.
          Koordinatene vises ikke i det offentlige API-et. Et pseudonymt sikkerhetshash
          brukes til å begrense spam og hindre gjentatt misbruksrapportering fra samme
          klient. IP-adressen lagres ikke i klartekst i denne funksjonen.
          Grunnlaget er vår berettigede interesse i å tilby og beskytte lokale rapporter,
          jf. artikkel 6 nr. 1 bokstav f. Ikke bruk fullt navn eller skriv sensitive
          opplysninger.
        </p>
      </article>

      <article>
        <h3>Badetemperaturer</h3>
        <p>
          Når du sender en badetemperatur, sendes badeplass, temperatur, tidspunkt og
          koordinater videre til Yr/Meteorologisk institutt. Værvakt lagrer en teknisk
          leveringslogg i maksimalt 30 dager og lagrer ikke navnet ditt. Opplysningene er
          nødvendige for funksjonen du uttrykkelig ber om, jf. artikkel 6 nr. 1 bokstav b.
        </p>
      </article>

      <article>
        <h3>Lokal lagring og statistikk</h3>
        <p>
          Værvakt setter ikke informasjonskapsler og bruker ikke reklame- eller
          sporingsverktøy. Valgt lyst eller mørkt tema lagres lokalt til du endrer valget
          eller sletter nettleserdata. Det siste valgte stedet lagres lokalt på enheten
          til du velger et annet sted eller sletter nettleserdata. Offentlige
          badeplasser og målinger kan caches lokalt. POI-cachen er gyldig i 12 timer,
          og utdaterte oppføringer ryddes neste gang cachen brukes. Den inneholder ikke
          alias eller annen brukeridentifikator. Alias fra skjemaer lagres ikke i
          nettleseren. Værvakt lager ikke individuelle besøksprofiler.
        </p>
      </article>

      <article>
        <h3>Mottakere og rettigheter</h3>
        <p>
          Webhuset leverer hosting. MET/Yr, Kartverket/Geonorge og OpenStreetMap
          Foundation mottar bare opplysninger som er nødvendige for oppslaget eller
          innsendingen. Tjenesteleverandørene kan se IP-adressen ved direkte nettverkskall
          og behandler den etter egne personvernregler.
        </p>
        <p>
          Du kan be om innsyn, retting, sletting, begrensning eller protestere på
          behandlingen. Oppgi omtrent tidspunkt, sted og eventuelt visningsnavn for å
          finne en rapport uten brukerkonto. Du kan klage til Datatilsynet.
        </p>
      </article>

      <nav class="privacy-links" aria-label="Eksterne personvernlenker">
        <a href="https://www.met.no/om-oss/personvern" target="_blank" rel="noopener noreferrer">
          MET <ExternalLink size={13} />
        </a>
        <a
          href="https://www.kartverket.no/om-kartverket/personvern"
          target="_blank"
          rel="noopener noreferrer"
        >
          Kartverket <ExternalLink size={13} />
        </a>
        <a
          href="https://osmfoundation.org/wiki/Privacy_Policy"
          target="_blank"
          rel="noopener noreferrer"
        >
          OpenStreetMap <ExternalLink size={13} />
        </a>
        <a href="https://www.datatilsynet.no/" target="_blank" rel="noopener noreferrer">
          Datatilsynet <ExternalLink size={13} />
        </a>
      </nav>
    </div>

    <button class="primary-button privacy-close" type="button" on:click={onClose}>Lukk</button>
  </dialog>
</div>
