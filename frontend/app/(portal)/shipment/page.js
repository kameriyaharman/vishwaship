'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Chip, Spinner, ErrorBox, Modal, AsyncBtn, toast } from '@/components/ui';
import LabelButton from '@/components/LabelButton';
import { RaiseTicket } from '@/components/Tickets';
import { ProgressBar, Timeline } from '@/components/Track';
import { useShell } from '@/components/Shell';
import { api, inr, kg, dLong, qp } from '@/lib/api';

export default function ShipmentDetail() {
  const router = useRouter();
  const { refresh } = useShell();
  const [id, setId] = useState(null);
  const [s, setS] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [ticket, setTicket] = useState(false);
  const [tk, setTk] = useState({ subject: '', message: '' });

  const load = async (i) => { setErr(''); try { setS(await api('/me/shipments/' + i)); } catch (e) { setErr(e.message); } };
  useEffect(() => { const i = qp('id'); setId(i); if (i) load(i); }, []);

  const find = async (e) => {
    e.preventDefault(); setErr('');
    try {
      const r = await api('/me/shipments?q=' + encodeURIComponent(q.trim()));
      if (!r.items.length) return setErr('No shipment found for “' + q + '”');
      router.push('/shipment/?id=' + r.items[0].id); setId(r.items[0].id); load(r.items[0].id);
    } catch (er) { setErr(er.message); }
  };

  if (!id) return (
    <>
      <div className="ph"><div><h1>Track shipment</h1><p>Enter AWB, order ID or receiver phone</p></div></div>
      <form className="card row" onSubmit={find}><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="149081108213" autoFocus /><button className="btn btn-orange">Track</button></form>
      {err && <div className="err mt12">{err}</div>}
    </>
  );
  if (err) return <ErrorBox err={err} />;
  if (!s) return <Spinner />;
  const trackUrl = `${location.origin}/track/?awb=${s.awb}`;
  const cw = s.courier_weight;
  const disc = s.dispute;

  return (
    <>
      <div className="ph">
        <div><h1>Shipment Details & Tracking</h1><p>AWB {s.awb} · status auto-updated from Delhivery</p></div>
        <div className="row wrap">
          {s.status !== 'cancelled' && <LabelButton ids={s.id} small={false} />}
          {s.provider === 'shipmozo' && s.status !== 'cancelled' && <AsyncBtn className="btn btn-outline" onClick={async () => { try { const r = await api(`/me/shipments/${s.id}/courier-label`); const ls = r.labels || [r.url || r.data].filter(Boolean); if (ls.length === 1 && ls[0].startsWith('http')) window.open(ls[0], '_blank'); else { const w = window.open(); w.document.write('<title>Courier labels · ' + s.awb + '</title><body style="margin:0;font-family:sans-serif">' + ls.map((u, i) => `<div style="padding:6px 10px;background:#0b1f3a;color:#fff;font-size:13px">Label ${i + 1} of ${ls.length}</div>` + (/^data:image/.test(u) ? `<img src="${u}" style="max-width:100%;display:block;margin:auto">` : `<iframe src="${u}" style="border:0;width:100%;height:100vh"></iframe>`)).join('') + '</body>'); w.document.close(); } } catch (e) { toast(e.message, true); } }}>Courier label ({s.courier_name?.split(' ')[0] || 'courier'})</AsyncBtn>}
          {s.provider === 'dlvb2b' && s.status !== 'cancelled' && <AsyncBtn className="btn btn-outline" onClick={async () => { try { const r = await api(`/me/shipments/${s.id}/b2b-label?size=sm`); window.open(r.url, '_blank'); } catch (e) { toast(e.message, true); } }}>Delhivery LR label (PDF)</AsyncBtn>}
          <a className="btn btn-outline" href={`/invoice/?shipment=${s.id}`} target="_blank">Shipping invoice</a>
          <a className="btn btn-outline" href={`/buyer-invoice/?id=${s.id}`} target="_blank">Buyer invoice</a>
          <button className="btn btn-outline" onClick={() => setTicket(true)}>Raise ticket</button>
          {s.status === 'pickup_pending' && <AsyncBtn className="btn btn-red" confirmText="Cancel this shipment? The amount will be refunded to your wallet." onClick={async () => { await api(`/me/shipments/${s.id}/cancel`, { method: 'POST' }); toast('Cancelled & refunded'); refresh(); load(s.id); }}>Cancel</AsyncBtn>}
        </div>
      </div>
      <div className="card mb12">
        <div className="row between wrap">
          <div className="row"><div><div className="tiny muted">AWB</div><div className="mono" style={{ fontSize: 22 }}>{s.awb}</div></div><Chip s={s.status_key} label={s.status_label} /></div>
          <div className="small">{s.status === 'delivered' ? <>Delivered: <b>{dLong(s.delivered_at)}</b></> : s.status === 'cancelled' ? 'Cancelled' : <>Expected delivery: <b>{dLong(s.eta)}</b></>}</div>
        </div>
        <ProgressBar status={s.status} />
      </div>
      <div className="split-3">
        <div className="card"><div className="card-h"><h3>Tracking history</h3></div><Timeline events={s.events} /></div>
        <div className="card"><div className="card-h"><h3>Shipment info</h3></div>
          <div className="kv"><span>Order</span><b>#{s.order_no}</b></div>
          <div className="kv"><span>From</span><b>{s.from_name}, {s.from_city} {s.from_pincode}</b></div>
          <div className="kv"><span>To</span><b>{s.to_name}, {s.to_city} {s.to_pincode}</b></div>
          <div className="kv"><span>Receiver phone</span><b>{s.to_phone}</b></div>
          <div className="kv"><span>Courier</span><b>{s.courier_name || `Delhivery ${s.service === 'express' ? 'Express' : 'Surface'}`}</b></div>
          <div className="kv"><span>Mode</span><b>{s.payment_mode === 'cod' ? `COD · ${inr(s.cod_amount)}` : 'Prepaid'}</b></div>
          <div className="kv"><span>Declared</span><b>{kg(s.weight)} · {+s.length}×{+s.breadth}×{+s.height} cm</b></div>
          <div className="kv"><span>Chargeable</span><b>{kg(s.chargeable_weight)}</b></div>
          <div className="kv"><span>Courier weight</span><b>{cw ? <>{kg(cw)} {disc ? <span className="orange">· discrepancy</span> : <span className="green">✓ no discrepancy</span>}</> : '—'}</b></div>
        </div>
        <div className="card"><div className="card-h"><h3>Charges</h3></div>
          <div className="kv"><span>Freight</span><b>{inr(s.freight, 2)}</b></div>
          {+s.cod_charge > 0 && <div className="kv"><span>COD charges</span><b>{inr(s.cod_charge, 2)}</b></div>}
          <div className="kv"><span>GST</span><b>{inr(s.gst, 2)}</b></div>
          <div className="kv"><span>Total</span><b>{inr(s.total, 2)}</b></div>
          {+s.rto_charge > 0 && <div className="kv"><span>RTO charges</span><b className="red">{inr(s.rto_charge, 2)}</b></div>}
          {disc && <div className="kv"><span>Weight discrepancy</span><b className="orange">+{inr(disc.customer_extra)} ({disc.status})</b></div>}
          <div className="kv"><span>Paid via</span><b>Wallet</b></div>
          <div className="note mt12">Share live tracking:<br /><a className="b blue" href={trackUrl} target="_blank" style={{ wordBreak: 'break-all' }}>{trackUrl.replace(/^https?:\/\//, '')}</a></div>
        </div>
      </div>
      {ticket && <RaiseTicket presetRef={s.awb} onClose={() => setTicket(false)} onDone={(r) => { location.href = '/support/?ticket=' + r.id; }} />}
    </>
  );
}
