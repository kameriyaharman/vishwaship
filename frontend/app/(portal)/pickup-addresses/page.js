'use client';
import { useEffect, useState } from 'react';
import { Chip, Spinner, ErrorBox, Modal, AsyncBtn, toast, useLoad, PageHead, Empty } from '@/components/ui';
import { api, qp } from '@/lib/api';

const BLANK = { name: '', contact: '', phone: '', address: '', pincode: '', city: '', state: '', is_default: false };

export default function Pickups() {
  const { data: d, err, reload } = useLoad(() => api('/me/pickups'), []);
  const [edit, setEdit] = useState(null);
  useEffect(() => { if (qp('add')) setEdit(BLANK); }, []);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!d) return <Spinner />;
  return (
    <>
      <PageHead title="Pickup Addresses" sub="Warehouses / pickup points — auto-registered with Delhivery as pickup locations"><button className="btn btn-orange" onClick={() => setEdit(BLANK)}>+ Add pickup address</button></PageHead>
      <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {d.items.map((p) => (
          <div key={p.id} className="card">
            <div className="row between"><b>{p.name}</b><span className="row" style={{ gap: 6 }}>{p.is_default == 1 && <Chip s="delivered" label="Default" />}<Chip s={p.delhivery_status} label={p.delhivery_status === 'registered' ? 'Registered' : p.delhivery_status === 'failed' ? 'Failed' : 'Pending'} /></span></div>
            <div className="small mt8">{p.address}, {p.city}, {p.state} — {p.pincode}</div>
            <div className="small muted">{p.contact} · {p.phone}</div>
            <div className="row mt12">
              <button className="btn btn-outline btn-sm" onClick={() => setEdit({ ...p, is_default: p.is_default == 1 })}>Edit</button>
              {p.is_default != 1 && <AsyncBtn className="btn btn-outline btn-sm" onClick={async () => { await api('/me/pickups/' + p.id, { method: 'PUT', body: { is_default: true } }); reload(); }}>Make default</AsyncBtn>}
              <AsyncBtn className="btn btn-outline btn-sm" confirmText="Delete this pickup address?" onClick={async () => { await api('/me/pickups/' + p.id, { method: 'DELETE' }); reload(); }}>Delete</AsyncBtn>
            </div>
          </div>
        ))}
      </div>
      {!d.items.length && <div className="card"><Empty>No pickup address yet — add one to start booking.</Empty></div>}
      {edit && <PickupForm p={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} />}
    </>
  );
}

function PickupForm({ p, onClose, onDone }) {
  const [f, setF] = useState(p);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  useEffect(() => {
    if (!/^\d{6}$/.test(f.pincode || '') || (f.city && f.state)) return;
    api('/public/pincode/' + f.pincode).then((r) => setF((x) => ({ ...x, city: x.city || r.city || '', state: x.state || r.state || '' }))).catch(() => {});
  }, [f.pincode]);
  return (
    <Modal title={p.id ? 'Edit pickup address' : 'Add pickup address'} onClose={onClose}>
      <div className="col">
        <div className="field"><label>Warehouse / location name</label><input className="input" value={f.name} onChange={set('name')} placeholder="Kumar Traders — Warehouse 1" /></div>
        <div className="grid2"><div className="field"><label>Contact person</label><input className="input" value={f.contact} onChange={set('contact')} /></div><div className="field"><label>Phone</label><input className="input" value={f.phone} onChange={set('phone')} /></div></div>
        <div className="field"><label>Address</label><input className="input" value={f.address} onChange={set('address')} /></div>
        <div className="grid3"><div className="field"><label>Pincode</label><input className="input" maxLength={6} value={f.pincode} onChange={set('pincode')} /></div><div className="field"><label>City</label><input className="input" value={f.city} onChange={set('city')} /></div><div className="field"><label>State</label><input className="input" value={f.state} onChange={set('state')} /></div></div>
        <label className="check"><input type="checkbox" checked={!!f.is_default} onChange={set('is_default')} /> Set as default pickup address</label>
        <AsyncBtn onClick={async () => { await api(p.id ? '/me/pickups/' + p.id : '/me/pickups', { method: p.id ? 'PUT' : 'POST', body: f }); toast('Saved'); onDone(); }}>Save</AsyncBtn>
      </div>
    </Modal>
  );
}
