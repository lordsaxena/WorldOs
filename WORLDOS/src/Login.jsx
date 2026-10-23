import React, {useEffect, useState} from "react";
import {Activity, ArrowRight, Bot, Box, Eye, EyeOff, FolderOpen, Globe2, Gauge, LockKeyhole, Mail, Map, MessageSquare, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Wifi, X} from "lucide-react";

const applications=[
  ["World Home",Globe2],
  ["Files",FolderOpen],
  ["Browser",Map],
  ["AI Assistant",Bot],
  ["Settings",Settings],
  ["Workspace",SlidersHorizontal],
  ["Media",Box],
  ["System Monitor",Gauge]
];

export default function LoginPage({onLogin}){
  const [showPassword,setShowPassword]=useState(false);
  const [showLogin,setShowLogin]=useState(false);
  const [showAssistant,setShowAssistant]=useState(false);
  const [now,setNow]=useState(()=>new Date());
  const [online,setOnline]=useState(()=>navigator.onLine);

  useEffect(()=>{
    const timer=window.setInterval(()=>setNow(new Date()),1000);
    const updateConnectivity=()=>setOnline(navigator.onLine);
    window.addEventListener("online",updateConnectivity);
    window.addEventListener("offline",updateConnectivity);
    return ()=>{
      window.clearInterval(timer);
      window.removeEventListener("online",updateConnectivity);
      window.removeEventListener("offline",updateConnectivity);
    };
  },[]);

  const openWorkspace=()=>setShowLogin(true);

  return <main className="desktop">
    <div className="desktop-atmosphere" aria-hidden="true">
      <div className="desktop-orb desktop-orb-large"/>
      <div className="desktop-orb desktop-orb-small"/>
      <div className="desktop-horizon"/>
    </div>

    <header className="system-bar">
      <a className="system-brand" href="#" aria-label="WorldOS home">
        <span className="system-brand-mark"><Globe2 size={17}/></span>
        <span><strong>WORLD<span>OS</span></strong><small>URBAN INTELLIGENCE</small></span>
      </a>
      <div className="system-bar-right">
        <span className="system-indicator"><i className="live-dot"/> LOCAL MODEL</span>
        <span className="system-divider"/>
        <span className="system-indicator"><Wifi size={13}/> NETWORK {online?"ONLINE":"OFFLINE"}</span>
        <span className="system-clock">{now.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"})} <b>{now.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})}</b></span>
      </div>
    </header>

    <section className="desktop-main">
      <div className="desktop-welcome">
        <div className="desktop-eyebrow"><span className="live-dot"/> YOUR CITY, IN FOCUS</div>
        <div className="desktop-hero-mark"><div className="hero-orbit hero-orbit-one"/><div className="hero-orbit hero-orbit-two"/><div className="hero-globe"><Globe2 size={39} strokeWidth={1.2}/></div><span className="hero-satellite"/></div>
        <h1>Your world.<br/><span>One system.</span></h1>
        <p className="desktop-description">A clearer way to explore the systems that shape a city. See how mobility, energy, water, and housing move together.</p>
        <div className="desktop-actions">
          <button className="desktop-primary" onClick={()=>setShowAssistant(value=>!value)}>Explore WorldOS <ArrowRight size={16}/></button>
          <button className="desktop-secondary" onClick={openWorkspace}>Open Workspace <span>↗</span></button>
        </div>
        <div className="desktop-status-note"><span className="status-dots"><i/><i/><i/></span><span>MODEL READY</span><span className="desktop-status-separator"/>LOCAL · SYNTHETIC DATA</div>
        {showAssistant&&<div className="assistant-pill">
          <span className="assistant-pill-icon"><Sparkles size={15}/></span>
          <span><b>WorldOS Intelligence</b><small>Explore a local, illustrative model of connected city systems.</small></span>
          <button type="button" aria-label="Close assistant message" onClick={()=>setShowAssistant(false)}><X size={14}/></button>
        </div>}
      </div>
    </section>

    <nav className="app-dock" aria-label="WorldOS applications">
      <div className="dock-label">APPLICATIONS</div>
      <div className="dock-apps">
        {applications.map(([name,Icon])=><button className="dock-app" type="button" key={name} onClick={openWorkspace} aria-label={`Open ${name}`}>
          <span className="dock-icon"><Icon size={19} strokeWidth={1.6}/></span>
          <span className="dock-name">{name}</span>
        </button>)}
      </div>
      <div className="dock-divider"/>
      <button className="dock-assistant" type="button" onClick={()=>setShowAssistant(value=>!value)} aria-label="Open AI assistant"><MessageSquare size={17}/><span>Ask WorldOS</span></button>
    </nav>

    <footer className="desktop-footer"><span>© WORLDOS · URBAN INTELLIGENCE</span><span>ILLUSTRATIVE DIGITAL CITY · LOCAL DEMO</span></footer>

    {showLogin&&<div className="login-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setShowLogin(false)}}>
      <section className="login-card" role="dialog" aria-modal="true" aria-labelledby="login-title">
        <button className="login-close" type="button" aria-label="Close sign in" onClick={()=>setShowLogin(false)}><X size={17}/></button>
        <div className="login-card-top">
          <span className="login-card-icon"><LockKeyhole size={18}/></span>
          <span className="login-card-label">YOUR CITY WORKSPACE</span>
        </div>
        <h2 id="login-title">Welcome back</h2>
        <p className="login-card-description">Sign in to continue to your urban intelligence workspace.</p>
        <form className="login-form" onSubmit={event=>{event.preventDefault();onLogin()}}>
          <label htmlFor="login-email">Email address</label>
          <div className="login-input-wrap"><Mail size={16}/><input id="login-email" name="email" type="email" autoComplete="username" placeholder="you@organization.com" required/></div>
          <div className="login-password-label"><label htmlFor="login-password">Password</label><span>Secure access</span></div>
          <div className="login-input-wrap"><LockKeyhole size={16}/><input id="login-password" name="password" type={showPassword?"text":"password"} autoComplete="current-password" placeholder="Enter your password" required/><button className="password-toggle" type="button" aria-label={showPassword?"Hide password":"Show password"} onClick={()=>setShowPassword(value=>!value)}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></div>
          <button className="login-submit" type="submit">Enter workspace <ArrowRight size={16}/></button>
        </form>
        <div className="login-security"><ShieldCheck size={14}/><span>Prototype mode · this form does not authenticate or transmit credentials.</span></div>
        <div className="login-card-footer"><span>WORLDOS</span><span>URBAN INTELLIGENCE PLATFORM</span></div>
      </section>
    </div>}
  </main>;
}
