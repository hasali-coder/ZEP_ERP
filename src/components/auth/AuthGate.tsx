import React, { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Mode = 'signin' | 'signup' | 'forgot' | 'recovery';
type Workspace = {
  id: string;
  name: string;
  currency: string;
  country: string;
  created_at: string;
};

const fieldClass =
  'w-full h-11 rounded-lg border border-[#DCE4EC] bg-white px-3.5 text-sm text-[#182539] placeholder:text-[#94A3B8] outline-none focus:border-[#244A73] focus:ring-2 focus:ring-[#244A73]/10 transition-all';

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#244A73] text-white font-bold text-lg shadow-sm border border-white/10">
        Z
      </div>
      <div>
        <div className="text-xl font-semibold tracking-tight">ZEP ERP</div>
        {!compact && <div className="text-xs text-current opacity-65">Financial Workspace</div>}
      </div>
    </div>
  );
}

function AuthenticationPanel({
  recoveryMode,
  onRecovered,
}: {
  recoveryMode: boolean;
  onRecovered: () => void;
}) {
  const client = supabase!;
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const currentMode = recoveryMode ? 'recovery' : mode;

  const changeMode = (next: Mode) => {
    setMode(next);
    setError('');
    setNotice('');
    setPassword('');
    setConfirmPassword('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');

    try {
      if (currentMode === 'signin') {
        const { error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
      } else if (currentMode === 'signup') {
        if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
        if (password !== confirmPassword) throw new Error('The passwords do not match.');
        const { data, error: authError } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (authError) throw authError;
        if (!data.session) {
          setNotice('Check your inbox for a verification link, then return to sign in.');
          setMode('signin');
          setPassword('');
          setConfirmPassword('');
        }
      } else if (currentMode === 'forgot') {
        const { error: authError } = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin + '/?reset=1',
        });
        if (authError) throw authError;
        setNotice('If that address has an account, a password reset link is on its way.');
      } else {
        if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
        if (password !== confirmPassword) throw new Error('The passwords do not match.');
        const { error: authError } = await client.auth.updateUser({ password });
        if (authError) throw authError;
        setNotice('Your password has been updated.');
        setPassword('');
        setConfirmPassword('');
        window.history.replaceState({}, '', window.location.pathname);
        onRecovered();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const title = {
    signin: 'Welcome back',
    signup: 'Create your account',
    forgot: 'Reset your password',
    recovery: 'Choose a new password',
  }[currentMode];

  const subtitle = {
    signin: 'Sign in to your ZEP ERP workspace.',
    signup: 'One account. A clearer view of your business finances.',
    forgot: "We'll send you a link to get back into your account.",
    recovery: 'Your new password will be used for future sign-ins.',
  }[currentMode];

  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(340px,42%)_1fr] bg-[#F6F8FB]">
      <aside className="hidden lg:flex flex-col justify-between bg-[#0D1B33] text-white px-12 xl:px-20 py-14 relative overflow-hidden">
        <Brand />
        <div className="relative z-10 max-w-md">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-[#C9D9EB]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6AC1AC]" />
            Your business, in focus
          </div>
          <h1 className="text-4xl xl:text-5xl font-semibold tracking-tight leading-tight">
            Every number tells a clearer story.
          </h1>
          <p className="mt-6 text-base leading-relaxed text-[#B5C5D9]">
            Invoices, expenses, cash movements, and reports—thoughtfully organized in one place.
          </p>
        </div>
        <div className="relative z-10 text-xs text-[#8DA0B8]">
          ZEP ERP · Built for the way small businesses work
        </div>
        <div className="pointer-events-none absolute -right-36 bottom-[-190px] h-[550px] w-[550px] rounded-full border border-white/8" />
        <div className="pointer-events-none absolute -right-10 bottom-[-80px] h-[330px] w-[330px] rounded-full border border-white/8" />
      </aside>

      <div className="flex min-h-screen items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[410px]">
          <div className="mb-12 text-[#0D1B33] lg:hidden"><Brand /></div>
          <div className="mb-8">
            <h2 className="text-[30px] font-semibold text-[#182539] tracking-tight">{title}</h2>
            <p className="mt-2 text-sm text-[#69788B]">{subtitle}</p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            {currentMode !== 'recovery' && (
              <div>
                <label htmlFor="auth-email" className="block mb-2 text-sm font-medium text-[#27364B]">Email address</label>
                <input id="auth-email" type="email" autoComplete="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" className={fieldClass} />
              </div>
            )}

            {currentMode !== 'forgot' && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="auth-password" className="text-sm font-medium text-[#27364B]">
                    {currentMode === 'recovery' ? 'New password' : 'Password'}
                  </label>
                  {currentMode === 'signin' && (
                    <button type="button" onClick={() => changeMode('forgot')} className="text-xs font-medium text-[#244A73] hover:underline">
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input id="auth-password" type={showPassword ? 'text' : 'password'}
                    autoComplete={currentMode === 'signin' ? 'current-password' : 'new-password'}
                    required minLength={currentMode === 'signin' ? undefined : 8}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password" className={fieldClass + ' pr-12'} />
                  <button type="button" onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-3 text-[#69788B] hover:text-[#244A73]">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {(currentMode === 'signup' || currentMode === 'recovery') && (
              <div>
                <label htmlFor="auth-confirm" className="block mb-2 text-sm font-medium text-[#27364B]">Confirm password</label>
                <input id="auth-confirm" type="password" autoComplete="new-password"
                  required minLength={8} value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Enter your password again" className={fieldClass} />
              </div>
            )}

            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {notice && <p role="status" className="rounded-lg border border-[#B9E3D9] bg-[#EEF9F5] p-3 text-sm text-[#256454]">{notice}</p>}

            <button disabled={busy} type="submit"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#244A73] px-4 text-sm font-medium text-white shadow-sm hover:bg-[#1B3959] disabled:opacity-60 transition-colors">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {currentMode === 'signin' ? 'Sign in' : currentMode === 'signup' ? 'Create account' : currentMode === 'forgot' ? 'Send reset link' : 'Update password'}
            </button>
          </form>

          <div className="mt-7 border-t border-[#E2E8F0] pt-6 text-center text-sm text-[#69788B]">
            {currentMode === 'signin' ? (
              <>New to ZEP ERP? <button onClick={() => changeMode('signup')} className="font-semibold text-[#244A73] hover:underline">Create an account</button></>
            ) : currentMode === 'signup' || currentMode === 'forgot' ? (
              <button onClick={() => changeMode('signin')} className="inline-flex items-center gap-2 font-medium text-[#244A73] hover:underline">
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </button>
            ) : (
              <span className="inline-flex items-center gap-2"><LockKeyhole className="w-4 h-4" /> Secure account recovery</span>
            )}
          </div>
          <p className="mt-12 flex items-center justify-center gap-2 text-xs text-[#8C9BAE]">
            <ShieldCheck className="w-3.5 h-3.5" /> Secure sign-in powered by Supabase
          </p>
        </div>
      </div>
    </div>
  );
}

function WorkspaceHome({ user, onPreview }: { user: User; onPreview: () => void }) {
  const client = supabase!;
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('KES');
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    client.from('businesses').select('id,name,currency,country,created_at')
      .order('created_at', { ascending: false })
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) setError(loadError.message);
        else { setError(''); setWorkspaces(data ?? []); }
        setLoading(false);
      });
    return () => { active = false; };
  }, [client, user.id, refresh]);

  const createWorkspace = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || creating) return;
    setCreating(true);
    setError('');
    try {
      const { error: createError } = await client.from('businesses').insert({
        owner_id: user.id,
        name: cleanName,
        currency,
        country: 'Kenya',
      });
      if (createError) throw createError;
      setName('');
      setRefresh((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create your business.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-[#182539]">
      <header className="flex items-center justify-between border-b border-[#E2E8F0] bg-white px-5 sm:px-10 py-4">
        <div className="text-[#0D1B33]"><Brand compact /></div>
        <button onClick={() => client.auth.signOut()} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#69788B] hover:text-[#0D1B33] hover:bg-[#F6F8FB]">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </header>
      <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-16">
        <div className="mb-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#E8F2F9] px-3 py-1 text-xs font-semibold text-[#244A73]">
            <Check className="w-3.5 h-3.5" /> Account connected
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Your business workspaces</h1>
          <p className="mt-3 text-sm text-[#69788B]">Signed in as {user.email}. Your business profiles are securely saved in ZEP ERP.</p>
        </div>

        {error && <p role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-semibold">Businesses</h2>
              <span className="text-xs text-[#69788B]">{workspaces.length} workspace{workspaces.length === 1 ? '' : 's'}</span>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-[#69788B]"><Loader2 className="w-4 h-4 animate-spin" /> Loading businesses…</div>
            ) : workspaces.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#FAFCFE] px-6 py-10 text-center">
                <Building2 className="mx-auto h-8 w-8 text-[#8CA1B8]" />
                <p className="mt-3 font-medium text-[#27364B]">Your first workspace is one step away.</p>
                <p className="mt-1 text-sm text-[#69788B]">Create a business profile to get started.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {workspaces.map((workspace) => (
                  <li key={workspace.id} className="flex items-center gap-3 rounded-xl border border-[#E6ECF2] p-3.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#E8F2F9] text-[#244A73]"><Building2 className="w-5 h-5" /></div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{workspace.name}</p>
                      <p className="text-xs text-[#69788B]">{workspace.currency} · {workspace.country}</p>
                    </div>
                    <Check className="ml-auto h-4 w-4 text-[#1F806F]" />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
            <h2 className="font-semibold">Add a business</h2>
            <p className="mt-1 mb-6 text-sm text-[#69788B]">Each business keeps its financial records separate.</p>
            <form onSubmit={createWorkspace} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="business-name">Business name</label>
                <input id="business-name" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} required maxLength={160} placeholder="e.g. Zavo Consulting" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium" htmlFor="business-currency">Base currency</label>
                <select id="business-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={fieldClass}>
                  {['KES', 'USD', 'EUR', 'GBP', 'TZS', 'UGX', 'ZAR'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button type="submit" disabled={creating || !name.trim()}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#244A73] px-4 text-sm font-medium text-white hover:bg-[#1B3959] disabled:opacity-60">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />} Create business
              </button>
            </form>
          </section>
        </div>

        <section className="mt-6 flex flex-col gap-4 rounded-2xl border border-[#CAD8E7] bg-[#EDF4FA] p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-[#153C62]">Your interface is ready to preview</p>
            <p className="mt-1 max-w-xl text-sm text-[#486783]">Phase 1 connects accounts and business profiles. Invoices, payments, and reports are still sample browser data until their database phases are completed.</p>
          </div>
          <button onClick={onPreview} className="shrink-0 inline-flex items-center justify-center gap-2 rounded-lg border border-[#244A73] bg-white px-4 py-2.5 text-sm font-semibold text-[#244A73] hover:bg-[#F8FBFF]">
            Preview interface <ArrowRight className="w-4 h-4" />
          </button>
        </section>
      </main>
    </div>
  );
}

export function AuthGate({ renderPreview }: { renderPreview: () => React.ReactNode }) {
  const client = supabase!;
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(window.location.search.includes('reset=1'));
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = client.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      setSession(next);
      setLoading(false);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') { setRecovery(false); setPreview(false); }
    });
    client.auth.getSession().then(({ data }) => {
      if (active) { setSession(data.session); setLoading(false); }
    }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; subscription.unsubscribe(); };
  }, [client]);

  useEffect(() => {
    if (!session?.user.id) return;
    // A profile follows the authenticated identity. Ignore duplicates so that
    // future profile edits aren't overwritten each time the user signs in.
    client.from('profiles').upsert(
      { id: session.user.id },
      { onConflict: 'id', ignoreDuplicates: true },
    ).then(({ error }) => {
      if (error) console.error('Unable to initialize user profile:', error.message);
    });
  }, [client, session?.user.id]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F6F8FB] text-[#244A73]"><Loader2 className="w-6 h-6 animate-spin" aria-label="Loading account" /></div>;
  }

  if (recovery || !session) return <AuthenticationPanel recoveryMode={recovery} onRecovered={() => setRecovery(false)} />;

  if (preview) {
    return (
      <div>
        {renderPreview()}
        <div className="fixed z-[100] bottom-4 right-4 left-4 sm:left-auto sm:max-w-[350px] rounded-xl bg-[#0D1B33] p-4 text-white shadow-xl border border-[#324762]">
          <p className="text-sm font-semibold">Interface preview</p>
          <p className="mt-1 text-xs leading-relaxed text-[#B5C5D9]">Financial records on this screen are local sample data. Your Supabase businesses are saved separately.</p>
          <button onClick={() => setPreview(false)} className="mt-3 inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-xs font-semibold text-[#244A73] hover:bg-[#E9F2FC]">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to my workspaces
          </button>
        </div>
      </div>
    );
  }

  return <WorkspaceHome user={session.user} onPreview={() => setPreview(true)} />;
}
