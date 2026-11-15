'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Chip, Spinner, ErrorBox, Modal, AsyncBtn, toast } from '@/components/ui';
import { ProgressBar } from '@/components/Track';
import Icon from '@/components/Icon';
import { api, inr, kg, dLong, dTime, qp, uploadFile, STATUS } from '@/lib/api';

const ST = ['pickup_pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'ndr', 'rto_in_transit', 'rto_delivered', 'lost', 'cancelled'];
const LBL = { ...STATUS, rto_in_transit: 'RTO in transit' };

export default function AdminShipment() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState('');
  const [modal, setModal] = useState(null);
  const load = async () => { try { setS(await api('/admin/shipments/' + qp('id'))); } catch (e) { setErr(e.message); } };
  useEffect(() => { load(); }, []);
  if (err) return <ErrorBox err={err} />;
  if (!s) return <Spinner />;
  const base = +s.base_rate + +s.cod_base; const fin = +s.freight + +s.cod_charge;

  return (
    <>
      <div className="ph">
        <div><h1>Shipment {s.awb}</h1><p>Order #{s.order_no} · {s.customer?.business_name || s.customer?.name} · booked {dTime(s.created_at)}</p></div>
        <div className="row wrap">
          {s.provider === 'manual' && <button className="btn btn-outline" onClick={async () => { const awb = prompt('Courier AWB / tracking number for ' + (s.courier_name || 'this carrier')); if (!awb) return; try { const r = await api('/admin/shipments/' + s.id + '/courier-awb', { method: 'PUT', body: { awb } }); toast('AWB updated'); setS({ ...s, awb: r.awb }); } catch (e) { toast(e.message, true); } }}>Set courier AWB</button>}
          <button className="btn btn-orange" onClick={() => setModal('status')}>Update status</button>
          <button className="btn btn-outline" onClick={() => setModal('wd')}>Add weight discrepancy</button>
          <button className="btn btn-outline" onClick={() => setModal('edit')}>Edit</button>
          <a className="btn btn-outline" href={`/label/?id=${s.id}`} target="_blank">Label</a>
          <a className="btn btn-outline" href={`/invoice/?shipment=${s.id}`} target="_blank">Invoice</a>
        </div>
      </div>
      <div className="card mb12">
        <div className="row between wrap"><div className="row"><span className="mono" style={{ fontSize: 22 }}>{s.awb}</span><Chip s={s.status_key} label={s.status_label} /></div><span className="small">ETA <b>{dLong(s.eta)}</b></span></div>
        <ProgressBar status={s.status} />
      </div>
      <div className="split-3">
        <div className="card">
          <div className="card-h"><h3>Tracking history</h3></div>
          <div className="timeline">
            {s.events.map((e, i) => (
              <div className="tl-item" key={e.id}>
                <span className={'tl-dot' + (i === 0 ? ' cur' : '')}><Icon name="check" size={11} sw={3} /></span>
                <div className="grow"><b>{e.label}</b><span>{[e.location, dTime(e.event_time)].filter(Boolean).join(' · ')}</span>{e.remark && <div className="tiny muted">{e.remark}</div>}</div>
                <AsyncBtn className="link-navy tiny" confirmText="Delete this tracking event?" onClick={async () => { await api('/admin/events/' + e.id, { method: 'DELETE' }); load(); }}><Icon name="trash" size={13} /></AsyncBtn>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h3>Shipment info</h3></div>
          <div className="kv"><span>Customer</span><b><Link className="link" href={`/admin/customers/`}>{s.customer?.business_name || s.customer?.name}</Link></b></div>
          <div className="kv"><span>From</span><b>{s.from_name}, {s.from_city} {s.from_pincode}</b></div>
          <div className="kv"><span>To</span><b>{s.to_name}, {s.to_address}, {s.to_city} {s.to_pincode}</b></div>
          <div className="kv"><span>Receiver phone</span><b>{s.to_phone}</b></div>
          <div className="kv"><span>Product</span><b>{s.product || '—'} · {inr(s.invoice_value)}</b></div>
          <div className="kv"><span>Mode</span><b>{s.payment_mode === 'cod' ? `COD ${inr(s.cod_amount)} · ${s.cod_status}` : s.payment_mode === 'topay' ? 'To Pay (FOD)' : 'Prepaid'}</b></div>
          <div className="kv"><span>Declared</span><b>{kg(s.weight)} · {+s.length}×{+s.breadth}×{+s.height} cm</b></div>
          <div className="kv"><span>Volumetric / chargeable</span><b>{kg(s.vol_weight)} / {kg(s.chargeable_weight)}</b></div>
          <div className="kv"><span>Courier weight</span><b>{s.courier_weight ? kg(s.courier_weight) : '—'}</b></div>
          <div className="kv"><span>Pickup</span><b>{dLong(s.pickup_date)} · {s.pickup_slot}</b></div>
          {s.ndr_reason && <div className="kv"><span>NDR</span><b>{s.ndr_attempts} attempt(s) · {s.ndr_reason}{s.ndr_action ? ` · ${s.ndr_action}` : ''}</b></div>}
        </div>
        <div className="card">
          <div className="card-h"><h3>Base vs final</h3></div>
          <div className="kv"><span>Zone · courier</span><b>{s.zone} · {s.courier_name || s.service} ({s.provider || 'delhivery'})</b></div>
          <div className="kv"><span>Courier API price</span><b>{inr(base, 2)}</b></div>
          <div className="kv"><span>Commission</span><b>{+s.markup_pct}%</b></div>
          <div className="kv"><span>Final to customer</span><b>{inr(fin, 2)}</b></div>
          <div className="kv"><span>Margin</span><b className="green">{inr(fin - base, 2)}</b></div>
          <div className="kv"><span>GST</span><b>{inr(s.gst, 2)}</b></div>
          <div className="kv"><span>Total charged</span><b>{inr(s.total, 2)}</b></div>
          {+s.rto_charge > 0 && <div className="kv"><span>RTO charged</span><b className="red">{inr(s.rto_charge, 2)}</b></div>}
          {s.dispute && <div className="note mt12">Weight discrepancy: {kg(s.dispute.courier_weight)} · +{inr(s.dispute.customer_extra)} · <Chip s={s.dispute.status} /> <Link className="link" href="/admin/disputes/">Manage →</Link></div>}
        </div>
      </div>
      {modal === 'status' && <StatusModal s={s} onClose={() => setModal(null)} onDone={(x) => { setS(x); setModal(null); }} />}
      {modal === 'wd' && <WdModal s={s} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
      {modal === 'edit' && <EditModal s={s} onClose={() => setModal(null)} onDone={(x) => { setS(x); setModal(null); }} />}
    </>
  );
}

function StatusModal({ s, onClose, onDone }) {
  const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const [f, setF] = useState({ status: s.status, label: '', location: '', remark: '', time: now.toISOString().slice(0, 16), refund: true });
  return (
    <Modal title="Update status / add tracking event" onClose={onClose}>
      <div className="col">
        <div className="field"><label>Status</label><select className="select" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{ST.map((x) => <option key={x} value={x}>{LBL[x]}</option>)}</select></div>
        <div className="field"><label>Event text (optional)</label><input className="input" placeholder={LBL[f.status]} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></div>
        <div className="grid2"><div className="field"><label>Location</label><input className="input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Pune Hub" /></div><div className="field"><label>Time</label><input className="input" type="datetime-local" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></div></div>
        <div className="field"><label>Remark {f.status === 'ndr' && '(NDR reason)'}</label><input className="input" value={f.remark} onChange={(e) => setF({ ...f, remark: e.target.value })} /></div>
        {f.status === 'cancelled' && <label className="check"><input type="checkbox" checked={f.refund} onChange={(e) => setF({ ...f, refund: e.target.checked })} /> Refund {inr(s.total, 2)} to customer wallet</label>}
        {['rto_in_transit', 'rto_delivered'].includes(f.status) && !+s.rto_charged && <div className="note">RTO charges will be debited from the customer wallet as per your RTO rule.</div>}
        <AsyncBtn onClick={async () => { onDone(await api(`/admin/shipments/${s.id}/status`, { method: 'POST', body: f })); toast('Status updated'); }}>Save</AsyncBtn>
      </div>
    </Modal>
  );
}

function WdModal({ s, onClose, onDone }) {
  const [f, setF] = useState({ courier_weight: '', courier_dims: '', proof_ids: [], proof_labels: '' });
  const [up, setUp] = useState(false);
  return (
    <Modal title="Add weight discrepancy (from Delhivery re-weigh)" onClose={onClose}>
      <div className="col">
        <div className="note">Declared: {kg(s.weight)} · {+s.length}×{+s.breadth}×{+s.height} cm · charged on {kg(s.chargeable_weight)}</div>
        <div className="grid2"><div className="field"><label>Courier weight (kg)</label><input className="input" type="number" step="0.01" value={f.courier_weight} onChange={(e) => setF({ ...f, courier_weight: e.target.value })} /></div>
          <div className="field"><label>Courier dimensions (L×B×H cm)</label><input className="input" placeholder="38×28×14" value={f.courier_dims} onChange={(e) => setF({ ...f, courier_dims: e.target.value })} /></div></div>
        <div className="field"><label>Courier proof photos</label><input type="file" accept="image/*" multiple onChange={async (e) => { setUp(true); try { const ids = []; for (const x of e.target.files) ids.push(await uploadFile(x)); setF({ ...f, proof_ids: [...f.proof_ids, ...ids] }); } catch (er) { toast(er.message, true); } finally { setUp(false); } }} />
          {f.proof_ids.length > 0 && <span className="tiny green">{f.proof_ids.length} photo(s)</span>}</div>
        <div className="field"><label>Photo captions (separate with |)</label><input className="input" placeholder="Weighing scale · 2.6 kg|Length 38 cm|Width × height" value={f.proof_labels} onChange={(e) => setF({ ...f, proof_labels: e.target.value })} /></div>
        <p className="tiny muted">The difference (with this customer's markup) is shown to the customer to accept or dispute. Auto-accepted after the deadline if enabled.</p>
        <AsyncBtn disabled={up} onClick={async () => { await api(`/admin/shipments/${s.id}/discrepancy`, { method: 'POST', body: f }); toast('Discrepancy created & customer notified'); onDone(); }}>Create</AsyncBtn>
      </div>
    </Modal>
  );
}

function EditModal({ s, onClose, onDone }) {
  const keys = [['awb', 'AWB'], ['to_name', 'Receiver'], ['to_phone', 'Phone'], ['to_address', 'Address'], ['to_city', 'City'], ['to_state', 'State'], ['to_pincode', 'Pincode'], ['product', 'Product'], ['eta', 'ETA (YYYY-MM-DD)'], ['pickup_date', 'Pickup date'], ['pickup_slot', 'Pickup slot'], ['courier_weight', 'Courier weight']];
  const [f, setF] = useState(Object.fromEntries(keys.map(([k]) => [k, s[k] ?? ''])));
  return (
    <Modal title="Edit shipment" onClose={onClose} wide>
      <div className="grid3">{keys.map(([k, l]) => <div key={k} className="field"><label>{l}</label><input className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>)}</div>
      <AsyncBtn className="btn btn-orange mt16" onClick={async () => { onDone(await api('/admin/shipments/' + s.id, { method: 'PUT', body: f })); toast('Saved'); }}>Save</AsyncBtn>
    </Modal>
  );
}
