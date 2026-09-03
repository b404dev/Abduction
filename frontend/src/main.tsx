import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { updateViewportUnits } from "./viewport";
import "./styles.css";
import "./security.css";
import "./cockpit.css";

const applicationRoot = document.getElementById("root");
if (!applicationRoot) throw new Error("Abduction could not find its application root");
updateViewportUnits();
window.addEventListener("resize", updateViewportUnits);
ReactDOM.createRoot(applicationRoot).render(<React.StrictMode><App /></React.StrictMode>);
