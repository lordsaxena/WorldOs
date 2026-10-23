import React from "react";
import {createRoot} from "react-dom/client";
import App from "./App.jsx";
import {SystemStatus} from "./components/SystemStatus.jsx";
import "./style.css";
createRoot(document.getElementById("root")).render(<React.StrictMode><App/><SystemStatus/></React.StrictMode>);
