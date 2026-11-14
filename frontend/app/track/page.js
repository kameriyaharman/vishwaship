'use client';
import { useEffect, useState } from 'react';
import PublicNav, { PublicFooter } from '@/components/PublicNav';
import { Chip, Spinner } from '@/components/ui';
import { ProgressBar, Timeline } from '@/components/Track';
import { api, qp, dLong } from '@/lib/api';
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
    <>
      <PublicNav content={c} />
      <section className="section" style={{ maxWidth: 820, minHeight: '60vh' }}>
        <h2>Track your shipment</h2>
        <form className="row mt16" onSubmit={(e) => { e.preventDefault(); go(awb.trim()); }}>
          <input className="input" placeholder="Enter AWB / order number" value={awb} onChange={(e) => setAwb(e.target.value)} />
          <button className="btn btn-orange" disabled={busy}>Track</button>
        </form>
        {busy && <Spinner />}
        {err && <div className="err mt16">{err}</div>}
        {d && (
          <div className="card mt16">
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
    </>
  );
}
