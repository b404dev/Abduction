import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./security.css";
import "./cockpit.css";

const applicationRoot = document.getElementById("root");
if (!applicationRoot) throw new Error("Abduction could not find its application root");
ReactDOM.createRoot(applicationRoot).render(<React.StrictMode><App /></React.StrictMode>);
