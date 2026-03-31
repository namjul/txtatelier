import { render } from "solid-js/web";
import { App } from "./App";
import "./styles.css";

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const base = import.meta.env.BASE_URL;
  const scope = base.endsWith("/") ? base : `${base}/`;
  void navigator.serviceWorker.register(`${scope}sw.js`, { scope });
}

render(() => <App />, document.getElementById("app") as HTMLElement);
