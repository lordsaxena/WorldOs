import React, {useState} from "react";
import {createRoot} from "react-dom/client";
import App from "./App.jsx";
import LoginPage from "./Login.jsx";
import "./style.css";
import "./login.css";

function WorldOsApp(){
  const [authenticated,setAuthenticated]=useState(false);
  return authenticated?<App/>:<LoginPage onLogin={()=>setAuthenticated(true)}/>;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><WorldOsApp/></React.StrictMode>);
