'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api, inr, kg } from '@/lib/api';
import RateOption, { CourierLogo } from './RateOption';

/** Rate calculator form. `compact` = hero card; full = portal page with both services */
export default function RateCalc({ compact = false, loggedIn = false, onQuote }) {
  const [f, setF] = useState({ from: '110034', to: '411001', weight: '1.2', l: '20', b: '15', h: '10', payment: 'prepaid', cod_amount: '', kind: 'b2c' });
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const run = async (e) => {
    e?.preventDefault();
    setErr(''); setBusy(true);
    try {
      const r = await api(loggedIn ? '/me/quote' : '/public/quote', { method: 'POST', body: { ...f, weight: +f.weight, cod_amount: +f.cod_amount || 0, invoice_value: +f.cod_amount || 0 } });
      setRes(r); onQuote?.(r);
    } catch (er) { setErr(er.message); setRes(null); } finally { setBusy(false); }
  };
  const best = res?.options?.[0];

  return (
    <form onSubmit={run}>
      <div className="seg2 mb12">{[['b2c', 'B2C', 'Parcel'], ['b2b', 'B2B', 'Cargo / heavy']].map(([k, l, d]) => <button type="button" key={k} className={f.kind === k ? 'on' : ''} onClick={() => { setF({ ...f, kind: k }); setRes(null); }}><b>{l}</b><span>{d}</span></button>)}</div>
      <div className="grid2" style={{ gap: 12 }}>
        <div className="field"><label>Pickup pincode</label><input className="input" inputMode="numeric" maxLength={6} value={f.from} onChange={set('from')} required /></div>
        <div className="field"><label>Delivery pincode</label><input className="input hl" inputMode="numeric" maxLength={6} value={f.to} onChange={set('to')} required /></div>
        <div className="field"><label>Weight (kg)</label><input className="input" type="number" step="0.01" min="0.01" value={f.weight} onChange={set('weight')} required /></div>
        <div className="field"><label>Payment</label>
          <select className="select" value={f.payment} onChange={set('payment')}><option value="prepaid">Prepaid</option><option value="cod">COD</option></select></div>
        {f.payment === 'cod' && <div className="field" style={{ gridColumn: '1 / -1' }}><label>COD amount (₹)</label><input className="input" type="number" value={f.cod_amount} onChange={set('cod_amount')} /></div>}
      </div>
      <div className="grid3 mt12">
        <div className="field"><label>L (cm)</label><input className="input" type="number" value={f.l} onChange={set('l')} /></div>
        <div className="field"><label>B (cm)</label><input className="input hl" type="number" value={f.b} onChange={set('b')} /></div>
        <div className="field"><label>H (cm)</label><input className="input" type="number" value={f.h} onChange={set('h')} /></div>
      </div>
      {err && <div className="err mt12">{err}</div>}
      {compact ? (
        <>
          <div className="res">
            {best && <CourierLogo o={best} size={34} />}
            <div style={{ flex: 1, minWidth: 0 }}><div className="b small">{best ? `${best.name} · ${best.days}` : res ? 'No courier for this route' : 'Check your final rate'}</div><div className="tiny muted">{res ? `Chargeable ${kg(res.chargeable_weight)} · ${res.zone_label}${res.options.length > 1 ? ` · ${res.options.length} options` : ''}` : 'final price incl. GST'}</div></div>
            <div style={{ textAlign: 'right' }}><div style={{ fontSize: 24, fontWeight: 700 }}>{best ? inr(best.total) : '—'}</div>{best && <div className="tiny muted">incl. GST</div>}</div>
          </div>
          {res ? (
            <Link href={loggedIn ? '/book/' : '/signup/'} className="btn btn-orange btn-block">{loggedIn ? 'Book now' : 'Sign up to book'}</Link>
          ) : (
            <button className="btn btn-orange btn-block" disabled={busy}>{busy ? 'Checking…' : 'Check rate'}</button>
          )}
          {res && <button type="submit" className="link-navy small mt8" style={{ width: '100%' }}>Recalculate</button>}
        </>
      ) : (
        <>
          <button className="btn btn-orange mt16" disabled={busy}>{busy ? 'Checking…' : 'Get final rate'}</button>
          {res && (
            <div className="mt16">
              <div className="note mb12">Zone <b>{res.zone} · {res.zone_label}</b> · Volumetric {kg(res.vol_weight)} · Actual {kg(res.actual_weight)} · Chargeable <b>{kg(res.chargeable_weight)}</b></div>
              {!res.options.length && <div className="note small">No courier available for this route and weight{f.kind === 'b2b' ? ' as B2B — try B2C' : ''}.</div>}
              {res.options.map((o) => <RateOption key={o.service} o={o} chargeable={res.chargeable_weight} showBreakdown="toggle" />)}
            </div>
          )}
        </>
      )}
    </form>
  );
}
