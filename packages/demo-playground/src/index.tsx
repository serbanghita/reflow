import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/main.css";
import "./styles/gantt.css";
import "./styles/panels.css";
import "./styles/forms.css";

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");

const root = createRoot(container);
root.render(<App />);
