import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, supabaseReady, type ZavoBusiness } from './supabase';
import './myzavo.css';

const FinancialApplication = lazy(() => import('../App'));
const ACTIVE_KEY = 'myzavo_active_business_id';

function Brand({ light = false }: { light?: boolean }) {
  return <a className={`mz-brand ${light ? 'mz-brand-light' : ''}`} href="/" aria-label="ZEP ERP home"><img src={light ? '/zep-erp-lockup-on-dark.png' : '/zep-erp-lockup.png'} alt="ZEP ERP" style={{ width: 178, height: 'auto', maxHeight: 45, objectFit: 'contain', objectPosition: 'left center' }} /></a>;
}

function Arrow() { return <span aria-hidden="true">→</span>; }

function Landing({ onAuth }: { onAuth: (mode: 'signIn' | 'signUp') => void }) {
  return <div className="mz-shell mz-landing">
    <header className="mz-public-header"><Brand/><nav aria-label="Public navigation"><a href="#features">Features</a><a href="#how-it-works">How it works</a></nav><div className="mz-actions"><button className="mz-button mz-button-quiet" onClick={() => onAuth('signIn')}>Sign in</button><button className="mz-button mz-button-primary" onClick={() => onAuth('signUp')}>Get started <Arrow/></button></div></header>
    <main>
      <section className="mz-hero"><div className="mz-hero-copy"><p className="mz-eyebrow">A clearer way to run your business</p><h1>More clarity.<br/><span>Less paperwork.</span></h1><p className="mz-hero-sub">Invoices, expenses, payments and reports—all in one place. Know where your business stands, without the busywork.</p><div className="mz-hero-cta"><button className="mz-button mz-button-primary mz-button-large" onClick={() => onAuth('signUp')}>Start with ZEP ERP <Arrow/></button><button className="mz-button mz-button-outline mz-button-large" onClick={() => onAuth('signIn')}>I have an account</button></div><div className="mz-hero-proof"><span>Clear financial records</span><span>One simple workspace</span><span>Built for growing businesses</span></div></div>
        <div className="mz-hero-art" aria-label="Illustration of a clean financial overview"><div className="mz-ribbon mz-ribbon-one"/><div className="mz-ribbon mz-ribbon-two"/><div className="mz-ribbon mz-ribbon-three"/><div className="mz-art-card mz-art-revenue"><small>Cash received</small><strong>KES 128,450</strong><span>Illustrative example</span><div className="mz-sparkline" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/></div></div><div className="mz-art-card mz-art-expense"><small>Money out</small><strong>KES 42,800</strong><span>Stay on top of spending</span></div><div className="mz-art-orbit"><div className="mz-orbit-mark"><img src="/zep-mark.png" alt=""/></div><p>Your business.<br/><b>All in view.</b></p></div></div></section>
      <section id="features" className="mz-features"><div className="mz-section-intro"><p className="mz-eyebrow">A little less admin</p><h2>Everything financial, finally together.</h2><p>One place to create, record, review and understand.</p></div><div className="mz-feature-grid">{[{n:'01',t:'Invoices & quotations',d:'Create professional documents and keep track of what you are owed.'},{n:'02',t:'Expenses & payments',d:'Record the money coming in and going out, without losing the detail.'},{n:'03',t:'Customers & suppliers',d:'Keep the right contacts and their financial history close at hand.'},{n:'04',t:'Reports & statements',d:'Understand cash flow and prepare customer statements of account.'}].map(f=><article className="mz-feature" key={f.n}><span className="mz-feature-number">{f.n}</span><h3>{f.t}</h3><p>{f.d}</p></article>)}</div></section>
      <section id="how-it-works" className="mz-closing"><p className="mz-eyebrow">Make room for what matters</p><h2>A better view of your money starts here.</h2><button className="mz-button mz-button-primary mz-button-large" onClick={() => onAuth('signUp')}>Create your account <Arrow/></button></section>
    </main><footer className="mz-footer"><Brand/><span>© {new Date().getFullYear()} ZEP ERP. Built for clarity.</span></footer>
  </div>;
}

function AuthView({ mode, setMode, onBack }: { mode: 'signIn' | 'signUp'; setMode: (m: 'signIn' | 'signUp') => void; onBack: () => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function handleEmail(e: React.FormEvent) {
    e.preventDefault(); setError(''); setMessage('');
    if (!supabase) { setError('Supabase is not configured. Check your local .env file.'); return; }
    setBusy(true);
    const result = mode === 'signUp' ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/workspaces` } }) : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) setError(result.error.message);
    else if (mode === 'signUp' && !result.data.session) setMessage('Check your email to confirm your account, then sign in.');
    else window.location.assign('/workspaces');
    setBusy(false);
  }
  async function handleGoogle() {
    setError('');
    if (!supabase) { setError('Supabase is not configured.'); return; }
    setBusy(true);
    try {
      // Provider availability comes from Supabase Auth settings, not the browser UI.
      // This prevents the misleading raw JSON error when Google OAuth is disabled.
      const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
      if (url && key) {
        const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, { headers: { apikey: key } });
        if (res.ok) {
          const settings = await res.json() as { external?: { google?: boolean } };
          if (settings.external?.google === false) {
            setError('Google sign-in is not enabled yet. Configure Google under Supabase Authentication → Providers.');
            return;
          }
        }
      }
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/workspaces` } });
      if (error) setError(error.message);
    } catch {
      setError('Unable to contact the sign-in service. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }
  async function handleReset() {
    setError(''); setMessage(''); if (!supabase) return setError('Supabase is not configured.');
    if (!email.trim()) return setError('Enter your email address first.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/workspaces` });
    if (error) setError(error.message); else setMessage('Password reset instructions have been sent, if the account exists.');
  }
  return <div className="mz-auth-page"><div className="mz-auth-panel"><Brand/><button className="mz-back" onClick={onBack}>← Back to home</button><div className="mz-auth-form"><p className="mz-eyebrow">Your financial workspace</p><h1>{mode === 'signIn' ? 'Welcome back.' : 'Start with clarity.'}</h1><p>{mode === 'signIn' ? 'Sign in to pick up where you left off.' : 'Create an account and keep your business finances in one place.'}</p><button className="mz-button mz-google" onClick={handleGoogle} disabled={busy}><span className="mz-google-g" aria-hidden="true">G</span> Continue with Google</button><div className="mz-or-divider"><span>or continue with email</span></div><form onSubmit={handleEmail}><label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required placeholder="you@company.com"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'} required minLength={6} placeholder="Enter your password"/></label>{mode === 'signIn' && <button type="button" className="mz-link mz-forgot" onClick={handleReset}>Forgot password?</button>}<button className="mz-button mz-button-primary mz-button-full" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : 'Create account'} <Arrow/></button></form>{error && <p className="mz-alert mz-alert-error" role="alert">{error}</p>}{message && <p className="mz-alert mz-alert-info" role="status">{message}</p>}<p className="mz-toggle">{mode === 'signIn' ? 'New to ZEP ERP?' : 'Already have an account?'} <button className="mz-link" onClick={() => { setError('');setMessage('');setMode(mode === 'signIn' ? 'signUp' : 'signIn'); }}>{mode === 'signIn' ? 'Create an account' : 'Sign in'}</button></p></div></div><aside className="mz-auth-side"><div className="mz-auth-wave"/><div className="mz-auth-side-content"><span className="mz-mini-mark"><img src="/zep-mark.png" alt=""/></span><p className="mz-eyebrow">Made for real businesses</p><h2>Know your numbers.<br/>Move with confidence.</h2><p>A cleaner way to see the whole financial picture.</p></div></aside></div>;
}

function WorkspaceView({ user, businesses, onOpen, onCreated, onSignOut }: {user:User; businesses:ZavoBusiness[];onOpen:(b:ZavoBusiness)=>void;onCreated:(b:ZavoBusiness)=>void;onSignOut:()=>void}) {
  const [name,setName] = useState(''); const [currency,setCurrency] = useState('KES'); const [busy,setBusy] = useState(false); const [error,setError]=useState('');
  async function createBusiness(e: React.FormEvent) {
    e.preventDefault(); setError(''); if(!supabase) return setError('Supabase configuration is missing.');
    setBusy(true);
    const {data,error:insertError} = await supabase.from('businesses').insert({name:name.trim(),owner_id:user.id,currency,country:'Kenya'}).select('id,owner_id,name,currency,country,created_at').single();
    setBusy(false);
    if(insertError) return setError(insertError.message);
    if(data) onCreated(data as ZavoBusiness);
  }
  return <div className="mz-workspace-page"><header className="mz-workspace-header"><Brand/><div><span className="mz-user-email">{user.email}</span><button className="mz-button mz-button-outline" onClick={onSignOut}>Sign out</button></div></header><main className="mz-workspace-main"><div className="mz-workspace-heading"><div><p className="mz-eyebrow">Your workspace</p><h1>Where would you like to start?</h1><p>Choose a business or set up another. Each keeps its own financial records.</p></div><div className="mz-workspace-count">{businesses.length} {businesses.length===1?'business':'businesses'}</div></div><div className="mz-workspace-grid"><section className="mz-workspace-card"><div className="mz-card-title"><h2>Your businesses</h2><span>Choose to continue</span></div>{businesses.length===0 ? <div className="mz-business-empty"><div className="mz-empty-icon">+</div><h3>No businesses yet</h3><p>Create your first workspace to start organising your finances.</p></div> : <div className="mz-business-list">{businesses.map(b=><button className="mz-business-row" key={b.id} onClick={()=>onOpen(b)}><span className="mz-business-icon" aria-hidden="true">▦</span><span className="mz-business-detail"><strong>{b.name}</strong><small>{b.currency} · {b.country||'Business workspace'}</small></span><span className="mz-business-arrow"><Arrow/></span></button>)}</div>}</section><section className="mz-workspace-card mz-create-card"><div className="mz-card-title"><h2>Create a business</h2><span>A separate home for each business</span></div><form onSubmit={createBusiness}><label>Business name<input autoFocus={false} value={name} onChange={e=>setName(e.target.value)} required minLength={1} maxLength={160} placeholder="e.g. My Business Ltd"/></label><label>Base currency<select value={currency} onChange={e=>setCurrency(e.target.value)}><option value="KES">KES — Kenyan shilling</option><option value="USD">USD — US dollar</option><option value="GBP">GBP — British pound</option><option value="EUR">EUR — Euro</option><option value="UGX">UGX — Ugandan shilling</option><option value="TZS">TZS — Tanzanian shilling</option></select></label>{error && <p role="alert" className="mz-alert mz-alert-error">{error}</p>}<button className="mz-button mz-button-primary mz-button-full" type="submit" disabled={busy||!name.trim()}>{busy?'Creating business…':'Create and open business'} <Arrow/></button></form></section></div><div className="mz-workspace-note"><span>◈</span><p><strong>One account, separate finances.</strong><br/>Every business has its own financial records and access permissions.</p></div></main></div>;
}

// The current financial module still uses browser storage. This bridge isolates each
// user's business preview until real financial records are moved to Supabase.
// Browser preview values are NOT durable or suitable for customer financial records.
const PREVIEW_OWNER_KEY = 'myzavo_phase2_preview_owner_id';
const PREVIEW_PREFIX = 'myzavo_phase2_preview_';
const PREVIEW_ARRAY_KEYS = [
  'myzavo_contacts_v1', 'myzavo_invoices_v1', 'myzavo_quotations_v1',
  'myzavo_expenses_v1', 'myzavo_bills_v1', 'myzavo_transactions_v1',
] as const;

function prepareLegacyInterface(b: ZavoBusiness, userId: string) {
  const previousOwner = localStorage.getItem(PREVIEW_OWNER_KEY);
  const previousBusiness = localStorage.getItem(ACTIVE_KEY);
  if (previousOwner && previousBusiness && previousOwner === userId) {
    const priorSnapshot = Object.fromEntries(PREVIEW_ARRAY_KEYS.map(k => [k, localStorage.getItem(k) || '[]']));
    localStorage.setItem(`${PREVIEW_PREFIX}${previousOwner}_${previousBusiness}`, JSON.stringify(priorSnapshot));
  }

  let snapshot: Record<string, string> = {};
  try {
    snapshot = JSON.parse(localStorage.getItem(`${PREVIEW_PREFIX}${userId}_${b.id}`) || '{}') as Record<string, string>;
  } catch { snapshot = {}; }
  for (const key of PREVIEW_ARRAY_KEYS) {
    let value = '[]';
    if (typeof snapshot[key] === 'string') {
      try { if (Array.isArray(JSON.parse(snapshot[key]))) value = snapshot[key]; } catch { /* ignore malformed preview */ }
    }
    localStorage.setItem(key, value);
  }

  localStorage.setItem(PREVIEW_OWNER_KEY, userId);
  localStorage.setItem(ACTIVE_KEY, b.id);
  localStorage.setItem('myzavo_businesses_v1', JSON.stringify([{
    id: b.id, name: b.name, currency: b.currency, email: '', phone: '',
    address: '', city: '', country: b.country || 'Kenya', taxNumber: '',
    paymentInstructions: '', notes: '', isDemo: false,
  }]));
}

export default function MyZavoGateway() {
  const [sessionUser, setSessionUser] = useState<User|null>(null);
  const [checking,setChecking] = useState(true);
  const [businesses,setBusinesses] = useState<ZavoBusiness[]>([]);
  const [loadingBusinesses,setLoadingBusinesses] = useState(false);
  const [businessesLoaded,setBusinessesLoaded] = useState(false);
  const [error,setError] = useState('');
  const [authMode,setAuthMode] = useState<'signIn'|'signUp' | null>(null);
  const [active,setActive] = useState<ZavoBusiness | null>(null);

  useEffect(() => {
    if(!supabase) {setChecking(false);return;}
    let mounted=true;
    supabase.auth.getUser().then(({data,error})=>{ if(!mounted)return; setSessionUser(error?null:(data.user||null));setChecking(false);});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{if(mounted) setSessionUser(session?.user||null);});
    return ()=>{mounted=false;subscription.unsubscribe();};
  },[]);

  const loadBusinesses=useCallback(async()=>{
    if(!supabase || !sessionUser)return;
    setLoadingBusinesses(true);
    const result=await supabase.from('businesses').select('id,owner_id,name,currency,country,created_at').order('created_at',{ascending:true});
    if(result.error) setError(result.error.message);
    else {setBusinesses((result.data || []) as ZavoBusiness[]);setError('');}
    setBusinessesLoaded(true);
    setLoadingBusinesses(false);
  },[sessionUser?.id]);

  useEffect(()=>{
    setActive(null);
    setBusinessesLoaded(false);
    if(sessionUser) void loadBusinesses();
    else {setBusinesses([]);setError('');}
  },[sessionUser?.id,loadBusinesses]);

  const page = window.location.pathname;
  const routeBusinessId = page.startsWith('/app/') ? page.slice('/app/'.length).replace(/\/$/, '') : null;
  const selectedBusiness = routeBusinessId ? businesses.find(b => b.id === routeBusinessId) : null;

  useEffect(() => {
    if (!sessionUser || loadingBusinesses || !businessesLoaded) return;
    if (page === '/app') {
      const remembered = localStorage.getItem(ACTIVE_KEY);
      const selected = businesses.find(b => b.id === remembered);
      window.location.replace(selected ? `/app/${selected.id}` : '/workspaces');
      return;
    }
    if (selectedBusiness && active?.id !== selectedBusiness.id) {
      prepareLegacyInterface(selectedBusiness, sessionUser.id);
      setActive(selectedBusiness);
    }
  }, [sessionUser?.id, loadingBusinesses, businessesLoaded, businesses, page, selectedBusiness?.id, active?.id]);

  function openBusiness(b: ZavoBusiness) {
    // On the next page load, /app/:id is checked against the Supabase business list.
    window.location.assign(`/app/${b.id}`);
  }
  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setActive(null);
    window.location.assign('/');
  }

  if (checking) return <div className="mz-loading"><Brand/><p>Opening ZEP ERP…</p></div>;
  if (!supabaseReady) return <div className="mz-config-error"><Brand/><h1>Supabase connection required</h1><p>Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your local .env file, then restart the development server.</p></div>;
  if (!sessionUser) {
    if (page === '/signup' || page === '/sign-up') return <AuthView mode="signUp" setMode={(m) => window.location.assign(m === 'signUp' ? '/signup' : '/login')} onBack={() => window.location.assign('/')}/>;
    if (page === '/login' || page === '/signin') return <AuthView mode="signIn" setMode={(m) => window.location.assign(m === 'signUp' ? '/signup' : '/login')} onBack={() => window.location.assign('/')}/>;
    if (page === '/' || page === '/features') return <Landing onAuth={mode => window.location.assign(mode === 'signIn' ? '/login' : '/signup')}/>;
    window.location.replace('/login');
    return <div className="mz-loading"><Brand/><p>Redirecting to sign in…</p></div>;
  }
  if (page === '/' || page === '/login' || page === '/signup') window.history.replaceState(null, '', '/workspaces');
  if (loadingBusinesses || !businessesLoaded) return <div className="mz-loading"><Brand/><p>Loading your businesses…</p></div>;
  if (error) return <div className="mz-config-error"><Brand/><h1>Unable to load businesses</h1><p role="alert">{error}</p><button className="mz-button mz-button-primary" onClick={() => void loadBusinesses()}>Try again</button></div>;
  if (page === '/app') return <div className="mz-loading"><Brand/><p>Opening your workspace…</p></div>;
  if (routeBusinessId && !selectedBusiness) return <div className="mz-config-error"><Brand/><h1>Business not available</h1><p>This business does not belong to your account, or it no longer exists.</p><a className="mz-button mz-button-primary" href="/workspaces">Choose a business</a></div>;
  if (selectedBusiness) {
    if (!active || active.id !== selectedBusiness.id) return <div className="mz-loading"><Brand/><p>Opening {selectedBusiness.name}…</p></div>;
    return <div className="mz-app-container">
      
      <Suspense fallback={<div className="mz-loading">Loading financial workspace…</div>}><FinancialApplication/></Suspense>
    </div>;
  }
  return <WorkspaceView user={sessionUser} businesses={businesses} onOpen={openBusiness} onCreated={openBusiness} onSignOut={signOut}/>;
}