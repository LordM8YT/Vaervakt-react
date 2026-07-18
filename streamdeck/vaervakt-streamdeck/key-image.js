import { flushSync, mount, unmount } from "svelte";
import KeyImage from "./KeyImage.svelte";

export function makeKeyImage(input) {
  const target = document.createElement("div");
  let component;

  flushSync(() => {
    component = mount(KeyImage, {
      target,
      props: { input },
    });
  });

  const svg = target.querySelector("svg")?.outerHTML;
  void unmount(component);

  if (!svg) {
    throw new Error("Kunne ikke tegne Stream Deck-knappen.");
  }

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
