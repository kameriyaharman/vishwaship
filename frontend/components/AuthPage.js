'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from './Icon';
import { Logo, Modal, Toaster, toast } from './ui';
import { api, setToken, setUser, qp } from '@/lib/api';
import { useConfig } from '@/lib/config';

export default function AuthPage({ mode }) {
  const cfg = useConfig();
  const c = cfg?.content || {};
  const [isAdmin, setIsAdmin] = useState(false);
  const [f, setF] = useState({ name: '', business_name: '', mobile: '', email: '', password: '', monthly_volume: '100 – 500', gstin: '', agree: false });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [fe, setFe] = useState('');
  useEffect(() => setIsAdmin(qp('admin') === '1'), []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await api(mode === 'signup' ? '/auth/signup' : '/auth/login', { method: 'POST', body: f });
      setToken(r.token); setUser(r.user);
      location.href = r.user.role === 'customer' ? (mode === 'signup' ? '/settings/?welcome=1' : '/dashboard/') : '/admin/';
    } catch (er) { setErr(er.message); } finally { setBusy(false); }
  };

  return (
    <div className="auth">
      <div className="l">
        <Link href="/"><Logo brand={c} /></Link>
        <h2>{c.signup_title_1 || 'Your shipping,'}<span>{c.signup_title_2 || 'one dashboard.'}</span></h2>
        <ul>{(c.signup_points || []).map((p, i) => <li key={i}><Icon name="check" style={{ color: 'var(--orange)' }} />{p}</li>)}</ul>
        <div className="ring" />
        <div className="awbcard"><Icon name="box" size={26} style={{ color: 'var(--orange)' }} /><div><b>Track any shipment</b><div className="small" style={{ color: '#c4cbe0' }}>Live status from the Delhivery network</div></div></div>
      </div>
      <div className="r">
        <div className="form">
          <div className="hide" style={{ display: 'none' }} />
          <div className="mb16" style={{ display: 'none' }}><Logo dark /></div>
          {isAdmin ? <div className="chip c-in_transit mb12">Admin / staff login</div> : (
            <div className="seg mb16" style={{ width: 'fit-content' }}>
              <Link href="/signup/"><button className={mode === 'signup' ? 'on' : ''} style={{ width: 110 }}>Sign up</button></Link>
              <Link href="/login/"><button className={mode === 'login' ? 'on' : ''} style={{ width: 110 }}>Login</button></Link>
            </div>
          )}
          <h1 style={{ fontSize: 24 }}>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
          <p className="muted small" style={{ margin: '4px 0 18px' }}>{mode === 'signup' ? 'Start shipping in 2 minutes' : 'Login with your email or mobile number'}</p>
          <form onSubmit={submit} className="col" style={{ gap: 14 }}>
            {mode === 'signup' ? (
              <>
                <div className="grid2">
                  <div className="field"><label>Full name</label><input className="input" value={f.name} onChange={set('name')} placeholder="Rahul Kumar" required /></div>
                  <div className="field"><label>Business name</label><input className="input" value={f.business_name} onChange={set('business_name')} placeholder="Kumar Traders" /></div>
                  <div className="field"><label>Mobile</label><input className="input" inputMode="tel" value={f.mobile} onChange={set('mobile')} placeholder="+91 98xxxxxx10" required /></div>
                  <div className="field"><label>Email</label><input className="input" type="email" value={f.email} onChange={set('email')} placeholder="you@business.in" required /></div>
                  <div className="field"><label>Password</label><input className="input" type="password" value={f.password} onChange={set('password')} placeholder="Min 6 characters" required /></div>
                  <div className="field"><label>Monthly shipments</label>
                    <select className="select" value={f.monthly_volume} onChange={set('monthly_volume')}>{['0 – 100', '100 – 500', '500 – 2,000', '2,000+'].map((o) => <option key={o}>{o}</option>)}</select></div>
                </div>
                <div className="field"><label>GSTIN (optional)</label><input className="input" value={f.gstin} onChange={set('gstin')} placeholder="07AAxxxxxx1Z5" /></div>
                <label className="check"><input type="checkbox" checked={f.agree} onChange={set('agree')} /> I agree to the <Link href="/terms/" className="link" target="_blank">Terms & shipping policy</Link></label>
              </>
            ) : (
              <>
                <div className="field"><label>Email or mobile</label><input className="input" value={f.email} onChange={set('email')} required autoFocus /></div>
                <div className="field"><label>Password</label><input className="input" type="password" value={f.password} onChange={set('password')} required /></div>
              </>
            )}
            {err && <div className="err">{err}</div>}
            <button className="btn btn-orange btn-lg btn-block" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Login'}</button>
            <div className="center small muted">
              {mode === 'signup' ? <>Already have an account? <Link href="/login/" className="link">Login</Link></> : <>New here? <Link href="/signup/" className="link">Create account</Link></>}
              {' · '}<button type="button" className="link-navy small" onClick={() => setForgot(true)}>Forgot password</button>
              {!isAdmin && mode === 'login' && <> · <Link href="/login/?admin=1" className="link-navy" onClick={() => setTimeout(() => setIsAdmin(true), 0)}>Admin login</Link></>}
            </div>
            {mode === 'signup' && <div className="note row" style={{ gap: 6 }}><Icon name="lock" size={13} /> After sign-up: KYC (PAN / GST / Aadhaar) → add pickup address → recharge wallet → book</div>}
          </form>
        </div>
      </div>
      {forgot && (
        <Modal title="Reset password" onClose={() => setForgot(false)}>
          <p className="small muted">Enter your registered email. Our team will verify and help you reset your password.</p>
          <input className="input" type="email" value={fe} onChange={(e) => setFe(e.target.value)} placeholder="you@business.in" />
          <button className="btn btn-orange mt12" onClick={async () => { try { const r = await api('/auth/forgot', { method: 'POST', body: { email: fe } }); toast(r.message); setForgot(false); } catch (e) { toast(e.message, true); } }}>Send request</button>
        </Modal>
      )}
      <Toaster />
    </div>
  );
}
