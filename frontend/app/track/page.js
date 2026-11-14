'use client';
import { useEffect, useState } from 'react';
import PublicNav, { PublicFooter } from '@/components/PublicNav';
import { Chip, Spinner } from '@/components/ui';
import { ProgressBar, Timeline } from '@/components/Track';
import { api, API, qp, dLong } from '@/lib/api';
import { useConfig } from '@/lib/config';

export default function TrackPage() {
  const c = useConfig()?.content || {};
  const [awb, setAwb] = useState('');
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async (v) => {
    if (!v) return;
    setBusy(true); setErr(''); setD(null);
    try { setD(await api('/public/track/' + encodeURIComponent(v))); history.replaceState(null, '', '/track/?awb=' + encodeURIComponent(v)); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  useEffect(() => { const a = qp('awb'); if (a) { setAwb(a); go(a); } }, []);

  return (
    <div className="vs">
      <PublicNav content={c} />
      <section className="vs-legal" style={{ minHeight: '60vh' }}>
        <span className="vs-eyebrow"><i />TRACK SHIPMENT</span>
        <h1 className="vs-h2" style={{ marginBottom: 8 }}>{d?.brand ? `Track your ${d.brand.name} order` : 'Where’s your shipment?'}</h1>
        <form className="row mt16" onSubmit={(e) => { e.preventDefault(); go(awb.trim()); }}>
          <input className="input" placeholder="Enter AWB / order number" value={awb} onChange={(e) => setAwb(e.target.value)} />
          <button className="vs-btn sm" disabled={busy}>Track</button>
        </form>
        {busy && <Spinner />}
        {err && <div className="err mt16">{err}</div>}
        {d?.brand && (
          <div className="card mt16 row wrap" style={{ borderTop: `4px solid ${d.brand.color}`, gap: 14 }}>
            {d.brand.logo && <img src={API + d.brand.logo} alt="" style={{ height: 44, maxWidth: 140, objectFit: 'contain' }} />}
            <div className="grow"><b style={{ fontSize: 16 }}>{d.brand.name}</b>{d.brand.message && <div className="small muted">{d.brand.message}</div>}</div>
            <div className="small" style={{ textAlign: 'right' }}>{d.brand.phone && <div>📞 {d.brand.phone}</div>}{d.brand.email && <div>{d.brand.email}</div>}{d.brand.website && <a href={d.brand.website} target="_blank" rel="noreferrer" style={{ color: d.brand.color, fontWeight: 700 }}>Visit store →</a>}</div>
          </div>
        )}
        {d && (
          <div className="card mt16" style={{ borderRadius: 18 }}>
            <div className="row between wrap">
              <div><div className="tiny muted">AWB</div><div className="mono" style={{ fontSize: 22 }}>{d.awb}</div></div>
              <Chip s={d.status} label={d.status_label} />
            </div>
            <div className="small mt8">{d.from_city} → {d.to_city} · {d.status === 'delivered' ? <>Delivered <b>{dLong(d.delivered_at)}</b></> : <>Expected delivery <b>{dLong(d.eta)}</b></>}</div>
            <ProgressBar status={d.status} />
            <h3 className="mt24 mb12" style={{ fontSize: 15 }}>Tracking history</h3>
            <Timeline events={d.events} />
          </div>
        )}
      </section>
      <PublicFooter content={c} />
    </div>
  );
}
