import { mount } from "svelte";
import Inspector from "./Inspector.svelte";
import "./inspector.css";

export default mount(Inspector, {
  target: document.getElementById("app"),
});
