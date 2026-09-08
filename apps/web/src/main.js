import "./styles/main.css";
import { renderShell } from "./shell.js";

const app = document.querySelector("#app");
if (!app) {
  throw new Error("Missing #app root element");
}
app.innerHTML = renderShell();
