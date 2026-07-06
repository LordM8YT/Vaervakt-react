import streamDeck, {
  action,
  KeyDownEvent,
  SingletonAction,
  WillAppearEvent,
  WillDisappearEvent,
  DidReceiveSettingsEvent,
} from "@elgato/streamdeck";
import { fetchVaervaktWeather } from "../lib/vaervakt-api";
import { makeKeyImage } from "../lib/key-image";
import { normalizeSettings, type VaervaktSettings } from "../settings";

type VaervaktMode = "weather" | "bath" | "bathInfo";

export abstract class BaseVaervaktAction extends SingletonAction<VaervaktSettings> {
  private timers = new Map<string, NodeJS.Timeout>();

  protected constructor(private readonly mode: VaervaktMode) {
    super();
  }

  override async onWillAppear(ev: WillAppearEvent<VaervaktSettings>): Promise<void> {
    await this.refresh(ev.action, ev.payload.settings);
    this.scheduleRefresh(ev.action, ev.payload.settings);
  }

  override onWillDisappear(ev: WillDisappearEvent<VaervaktSettings>): void {
    this.clearRefresh(ev.action.id);
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<VaervaktSettings>): Promise<void> {
    await this.refresh(ev.action, ev.payload.settings);
    this.scheduleRefresh(ev.action, ev.payload.settings);
  }

  override async onKeyDown(ev: KeyDownEvent<VaervaktSettings>): Promise<void> {
    const settings = normalizeSettings(ev.payload.settings);
    await this.refresh(ev.action, ev.payload.settings);

    if (settings.openOnPress) {
      const path = this.mode === "weather" ? "/" : "/bad/";
      await streamDeck.system.openUrl(`${settings.apiBase}${path}`);
    }
  }

  private scheduleRefresh(actionInstance: WillAppearEvent<VaervaktSettings>["action"], settings: VaervaktSettings): void {
    this.clearRefresh(actionInstance.id);
    const normalized = normalizeSettings(settings);
    const timer = setInterval(() => {
      void this.refresh(actionInstance, settings);
    }, Number(normalized.refreshMinutes) * 60 * 1000);
    this.timers.set(actionInstance.id, timer);
  }

  private clearRefresh(actionId: string): void {
    const timer = this.timers.get(actionId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(actionId);
    }
  }

  private async refresh(
    actionInstance: WillAppearEvent<VaervaktSettings>["action"],
    rawSettings: VaervaktSettings,
  ): Promise<void> {
    const settings = normalizeSettings(rawSettings);
    await actionInstance.setTitle("");
    await actionInstance.setImage(
      makeKeyImage({
        mode: this.mode,
        placeName: settings.placeName,
        status: "loading",
        message: "Oppdaterer",
      }),
    );

    try {
      const data = await fetchVaervaktWeather(settings);
      const nearestBath = data.bathing?.nearby?.[0];
      await actionInstance.setImage(
        makeKeyImage({
          mode: this.mode,
          placeName: settings.placeName,
          temperature: data.current.temperature,
          condition: data.current.condition,
          icon: data.current.icon,
          bathTemperature: nearestBath?.temperature ?? data.bathing?.waterTemperature,
          bathPlace: nearestBath?.name ?? data.bathing?.waterTemperatureLocation,
          bathDistanceKm: nearestBath?.distanceKm ?? data.bathing?.waterTemperatureDistanceKm,
          bathTime: nearestBath?.time ?? data.bathing?.waterTemperatureTime,
          status: "ok",
        }),
      );
    } catch (error) {
      await actionInstance.setImage(
        makeKeyImage({
          mode: this.mode,
          placeName: settings.placeName,
          status: "error",
          message: error instanceof Error ? error.message : "Kunne ikke hente data",
        }),
      );
    }
  }
}

export function vaervaktAction(uuid: string) {
  return action({ UUID: uuid });
}
