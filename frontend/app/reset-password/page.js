'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Toaster, toast } from '@/components/ui';

export default function ResetPassword() {
  const [token, setToken] = useState('');
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  useEffect(() => { setToken(new URLSearchParams(location.search).get('token') || ''); }, []);
  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 6) return toast('Password must be at least 6 characters', true);
    if (pw !== pw2) return toast('Both passwords must match', true);
    setBusy(true);
    try { await api('/auth/reset', { method: 'POST', body: { token, password: pw } }); setDone(true); }
    catch (err) { toast(err.message, true); } finally { setBusy(false); }
  };
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 28 }}>
        <Link href="/"><img src="/logo-full.png" alt="Vishwaship.com" style={{ height: 34 }} /></Link>
        {done ? (
          <>
            <h2 className="mt24">Password updated ✅</h2>
            <p className="small muted mt8">You can now login with your new password. You have been logged out of all other devices.</p>
            <Link href="/login/" className="btn btn-orange mt16" style={{ width: '100%' }}>Go to login</Link>
          </>
        ) : !token ? (
          <>
            <h2 className="mt24">Link not valid</h2>
            <p className="small muted mt8">This reset link is incomplete. Please request a new one from the login page.</p>
            <Link href="/login/" className="btn btn-orange mt16" style={{ width: '100%' }}>Back to login</Link>
          </>
        ) : (
          <form onSubmit={submit}>
            <h2 className="mt24">Set a new password</h2>
            <p className="small muted mt8">Choose a password with at least 6 characters.</p>
            <div className="field mt16"><label>New password</label><input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
            <div className="field mt12"><label>Confirm new password</label><input className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
            <button className="btn btn-orange mt16" style={{ width: '100%' }} disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
          </form>
        )}
      </div>
      <Toaster />
    </div>
  );
}
