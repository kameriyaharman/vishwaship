'use client';
import { useEffect, useState } from 'react';
import { Spinner, ErrorBox, AsyncBtn, toast, useLoad, PageHead } from '@/components/ui';
import { api } from '@/lib/api';
import { loadConfig } from '@/lib/config';

const ICONS = ['rupee', 'tag', 'truck', 'chart'];

export default function Content() {
  const c = useLoad(() => api('/admin/content'), []);
  const s = useLoad(() => api('/admin/settings'), []);
  const [f, setF] = useState(null);
  const [g, setG] = useState(null);
  const [tab, setTab] = useState('site');
  useEffect(() => { if (c.data) setF(c.data.content); }, [c.data]);
  useEffect(() => { if (s.data) setG({ ...s.data, pickup_slots: (() => { try { return JSON.parse(s.data.pickup_slots).join('\n'); } catch { return ''; } })(), razorpay_key_secret: '' }); }, [s.data]);
  if (c.err || s.err) return <ErrorBox err={c.err || s.err} />;
  if (!f || !g) return <Spinner />;
  const T = (k, l, area) => <div className="field"><label>{l}</label>{area ? <textarea className="textarea" value={f[k] || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} /> : <input className="input" value={f[k] || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}</div>;
  const arr = (k, i, sub, v) => { const a = [...(f[k] || [])]; a[i] = sub ? { ...a[i], [sub]: v } : v; setF({ ...f, [k]: a }); };
  const G = (k, l, t = 'text') => <div className="field"><label>{l}</label><input className="input" type={t} value={g[k] ?? ''} onChange={(e) => setG({ ...g, [k]: e.target.value })} /></div>;
  const saveSite = async () => { await api('/admin/content', { method: 'PUT', body: { content: f } }); await loadConfig(true); toast('Website content saved — live now'); };
  const saveGen = async () => { const b = { ...g, pickup_slots: JSON.stringify(g.pickup_slots.split('\n').map((x) => x.trim()).filter(Boolean)) }; if (!b.razorpay_key_secret) delete b.razorpay_key_secret; delete b.razorpay_secret_set; await api('/admin/settings', { method: 'PUT', body: b }); toast('Settings saved'); s.reload(); };

  return (
    <>
      <PageHead title="Website Content & Settings" sub="Edit everything on the public website and portal-wide settings — changes go live instantly">
        <AsyncBtn onClick={tab === 'site' ? saveSite : saveGen}>Save changes</AsyncBtn>
      </PageHead>
      <div className="seg mb16"><button className={tab === 'site' ? 'on' : ''} onClick={() => setTab('site')}>Website content</button><button className={tab === 'gen' ? 'on' : ''} onClick={() => setTab('gen')}>General settings & payments</button></div>
      {tab === 'site' ? (
        <div className="split">
          <div className="col" style={{ gap: 14 }}>
            <div className="card col"><h3 style={{ fontSize: 15 }}>Brand & hero</h3>
              <div className="grid2">{T('brand_name', 'Brand name')}{T('brand_suffix', 'Suffix (e.g. .com)')}</div>
              {T('hero_badge', 'Badge text')}{T('hero_title_1', 'Headline line 1')}{T('hero_title_2', 'Headline line 2 (orange)')}{T('hero_sub', 'Sub text', true)}
              <div className="lbl">Hero stats</div>
              {(f.stats || []).map((x, i) => <div key={i} className="grid2"><input className="input" value={x.v} onChange={(e) => arr('stats', i, 'v', e.target.value)} /><input className="input" value={x.l} onChange={(e) => arr('stats', i, 'l', e.target.value)} /></div>)}
            </div>
            <div className="card col"><h3 style={{ fontSize: 15 }}>Feature strip</h3>
              {(f.features || []).map((x, i) => <div key={i} className="grid3" style={{ gridTemplateColumns: '90px 1fr 1.4fr' }}><select className="select" value={x.icon} onChange={(e) => arr('features', i, 'icon', e.target.value)}>{ICONS.map((o) => <option key={o}>{o}</option>)}</select><input className="input" value={x.t} onChange={(e) => arr('features', i, 't', e.target.value)} /><input className="input" value={x.d} onChange={(e) => arr('features', i, 'd', e.target.value)} /></div>)}
              <div className="lbl">How it works (4 steps)</div>
              <div className="grid2">{(f.steps || []).map((x, i) => <input key={i} className="input" value={x} onChange={(e) => arr('steps', i, null, e.target.value)} />)}</div>
            </div>
          </div>
          <div className="col" style={{ gap: 14 }}>
            <div className="card col"><h3 style={{ fontSize: 15 }}>Services section</h3>
              {(f.services || []).map((x, i) => <div key={i} className="grid2" style={{ gridTemplateColumns: '1fr 2fr' }}><input className="input" value={x.t} onChange={(e) => arr('services', i, 't', e.target.value)} /><input className="input" value={x.d} onChange={(e) => arr('services', i, 'd', e.target.value)} /></div>)}
            </div>
            <div className="card col"><h3 style={{ fontSize: 15 }}>Login / sign-up panel</h3>
              <div className="grid2">{T('signup_title_1', 'Title line 1')}{T('signup_title_2', 'Title line 2 (orange)')}</div>
              <div className="grid2">{(f.signup_points || []).map((x, i) => <input key={i} className="input" value={x} onChange={(e) => arr('signup_points', i, null, e.target.value)} />)}</div>
            </div>
            <div className="card col"><h3 style={{ fontSize: 15 }}>Contact & footer</h3>
              <div className="grid2">{T('contact_phone', 'Phone')}{T('contact_email', 'Email')}{T('contact_address', 'Address')}{T('whatsapp', 'WhatsApp number (with 91)')}</div>
              {T('footer_text', 'Footer text')}{T('terms_text', 'Terms & shipping policy', true)}
            </div>
          </div>
        </div>
      ) : (
        <div className="split">
          <div className="card col"><h3 style={{ fontSize: 15 }}>Company (for invoices)</h3>
            {G('company_name', 'Company name')}{G('company_gstin', 'GSTIN')}{G('company_address', 'Address')}<div className="grid2">{G('invoice_prefix', 'Invoice prefix')}{G('gst_pct', 'GST %', 'number')}</div>
            <h3 style={{ fontSize: 15 }} className="mt12">Customer rules</h3>
            <label className="check"><input type="checkbox" checked={g.require_kyc === '1'} onChange={(e) => setG({ ...g, require_kyc: e.target.checked ? '1' : '0' })} /> Require verified KYC before booking</label>
            <div className="grid2">{G('min_recharge', 'Minimum recharge (₹)', 'number')}{G('low_wallet_threshold', 'Low wallet alert below (₹)', 'number')}</div>
            <div className="field"><label>Pickup slots (one per line)</label><textarea className="textarea" value={g.pickup_slots} onChange={(e) => setG({ ...g, pickup_slots: e.target.value })} /></div>
          </div>
          <div className="card col" style={{ alignSelf: 'start' }}><h3 style={{ fontSize: 15 }}>Wallet payments</h3>
            <div className="field"><label>Payment gateway</label><select className="select" value={g.payment_gateway} onChange={(e) => setG({ ...g, payment_gateway: e.target.value })}><option value="test">Test mode (credit instantly — for testing only)</option><option value="razorpay">Razorpay (live)</option></select></div>
            {G('razorpay_key_id', 'Razorpay Key ID')}
            <div className="field"><label>Razorpay Key Secret {g.razorpay_secret_set && <span className="green tiny">(saved)</span>}</label><input className="input" type="password" placeholder={g.razorpay_secret_set ? '•••••••• (leave blank to keep)' : ''} value={g.razorpay_key_secret} onChange={(e) => setG({ ...g, razorpay_key_secret: e.target.value })} /></div>
            <p className="tiny muted">Get keys from Razorpay Dashboard → Settings → API Keys. Customers pay by UPI / card / netbanking and the wallet is credited automatically after payment verification.</p>
          </div>
        </div>
      )}
    </>
  );
}
