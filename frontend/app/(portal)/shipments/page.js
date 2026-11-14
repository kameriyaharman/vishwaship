'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Chip, Spinner, ErrorBox, Modal, toast, AsyncBtn, useLoad } from '@/components/ui';
import { api, download, inr, kg, dShort, qp, STATUS } from '@/lib/api';

const TABS = ['all', 'pickup_pending', 'in_transit', 'out_for_delivery', 'delivered', 'rto', 'ndr', 'weight_discrepancy'];
const SAMPLE = 'to_name,to_phone,to_pincode,to_address,to_city,to_state,product,invoice_value,payment_mode,cod_amount,weight,length,breadth,height,service\nSneha Patil,9700000045,411001,"Flat 304, Green Park Society, Camp",Pune,Maharashtra,Cotton kurta,1450,prepaid,,1.0,30,20,10,surface\n';

export default function Shipments() {
  const [tab, setTab] = useState('all');
  const [f, setF] = useState({ q: '', from: '', to: '', payment: '', state: '' });
  const [applied, setApplied] = useState(null);
  const [page, setPage] = useState(1);
  const [bulk, setBulk] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  useEffect(() => { const q = qp('q') || ''; const t = qp('tab'); if (t) setTab(t); setF((x) => ({ ...x, q })); setApplied({ q }); }, []);
  const params = () => new URLSearchParams({ tab, page, limit: 50, ...Object.fromEntries(Object.entries({ ...f, ...applied }).filter(([, v]) => v)) }).toString();
  const { data: d, err, reload, loading } = useLoad(() => applied ? api('/me/shipments?' + params()) : Promise.resolve(null), [tab, applied, page]);
  const drafts = useLoad(() => api('/me/drafts'), []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const apply = (e) => { e?.preventDefault(); setPage(1); setApplied({ ...f }); };
  const c = d?.counts || {};

  return (
    <>
      <div className="ph">
        <div><h1>My Shipments</h1><p>Filter by status, date, payment mode · bulk label & manifest download</p></div>
        <div className="row wrap">
          {drafts.data?.items.length > 0 && <button className="btn btn-outline" onClick={() => setShowDrafts(true)}>Drafts ({drafts.data.items.length})</button>}
          <AsyncBtn className="btn btn-outline" onClick={() => download('/me/shipments?export=1&' + params(), 'shipments.csv')}>Export Excel</AsyncBtn>
          <button className="btn btn-outline" onClick={() => setBulk(true)}>Bulk upload (CSV)</button>
        </div>
      </div>
      <div className="pills mb12">
        {TABS.map((t) => <button key={t} className={'pill' + (tab === t ? ' on' : '')} onClick={() => { setTab(t); setPage(1); }}>{STATUS[t]} {c[t] !== undefined ? (t === 'in_transit' ? c.in_transit + c.picked_up : c[t]).toLocaleString('en-IN') : ''}</button>)}
      </div>
      <form className="card mb12" onSubmit={apply}>
        <div className="row wrap" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 200px' }}><label>Search</label><input className="input" placeholder="AWB / order / receiver / phone" value={f.q} onChange={set('q')} /></div>
          <div className="field"><label>From date</label><input className="input" type="date" value={f.from} onChange={set('from')} /></div>
          <div className="field"><label>To date</label><input className="input" type="date" value={f.to} onChange={set('to')} /></div>
          <div className="field"><label>Payment</label><select className="select" value={f.payment} onChange={set('payment')}><option value="">All</option><option value="prepaid">Prepaid</option><option value="cod">COD</option></select></div>
          <div className="field"><label>Destination</label><select className="select" value={f.state} onChange={set('state')}><option value="">All states</option>{(d?.states || []).map((s) => <option key={s}>{s}</option>)}</select></div>
          <button className="btn btn-navy">Apply</button>
        </div>
      </form>
      <ErrorBox err={err} onRetry={reload} />
      <div className="card p0 tbl-wrap">
        {!d ? <Spinner /> : (
          <table className="tbl">
            <thead><tr><th>AWB</th><th className="hide-sm">Order</th><th>Route</th><th className="hide-sm">Weight</th><th>Mode</th><th className="num">Rate</th><th>Status</th><th className="hide-sm">Booked</th><th></th></tr></thead>
            <tbody>
              {d.items.map((s) => (
                <tr key={s.id} className="click" onClick={() => (location.href = '/shipment/?id=' + s.id)}>
                  <td className="mono">{s.awb}</td><td className="hide-sm">#{s.order_no}</td>
                  <td>{s.from_city} {s.from_pincode} → {s.to_city} {s.to_pincode}<div className="tiny muted">{s.to_name}</div></td>
                  <td className="hide-sm">{kg(s.chargeable_weight)}</td><td><Chip s={s.payment_mode} label={s.payment_mode === 'cod' ? 'COD' : 'Prepaid'} /></td>
                  <td className="num">{inr(+s.freight + +s.cod_charge)}</td><td><Chip s={s.status_key} label={s.status_label} /></td>
                  <td className="hide-sm">{dShort(s.created_at)}</td><td><Link href={'/shipment/?id=' + s.id} className="link small" onClick={(e) => e.stopPropagation()}>Track</Link></td>
                </tr>
              ))}
              {!d.items.length && <tr><td colSpan={9} className="empty">No shipments match. <Link className="link" href="/book/">Book a shipment →</Link></td></tr>}
            </tbody>
          </table>
        )}
      </div>
      {d && d.total > 50 && (
        <div className="row between mt12 small"><span className="muted">{d.total} shipments</span>
          <div className="row"><button className="btn btn-outline btn-sm" disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>← Prev</button><span>Page {page}</span><button className="btn btn-outline btn-sm" disabled={page * 50 >= d.total || loading} onClick={() => setPage(page + 1)}>Next →</button></div></div>
      )}
      {bulk && <BulkUpload onClose={() => setBulk(false)} onDone={() => { reload(); }} />}
      {showDrafts && (
        <Modal title="Saved drafts" onClose={() => setShowDrafts(false)}>
          {drafts.data.items.map((s) => (
            <div key={s.id} className="kv"><span>#{s.order_no} · {s.to_name || 'No receiver'} {s.to_pincode}</span>
              <span className="row"><Link className="link small" href={'/book/?draft=' + s.id}>Resume</Link><button className="link-navy small" onClick={async () => { await api('/me/drafts/' + s.id, { method: 'DELETE' }); drafts.reload(); }}>Delete</button></span></div>
          ))}
        </Modal>
      )}
    </>
  );
}

function BulkUpload({ onClose, onDone }) {
  const [csv, setCsv] = useState('');
  const [res, setRes] = useState(null);
  const sample = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([SAMPLE], { type: 'text/csv' })); a.download = 'vishwaship-bulk-sample.csv'; a.click(); };
  return (
    <Modal title="Bulk upload shipments (CSV)" onClose={onClose} wide>
      <p className="small muted">Each row is booked from your default pickup address and charged from the wallet. <button className="link small" onClick={sample}>Download sample CSV</button></p>
      <input type="file" accept=".csv,text/csv" onChange={async (e) => { const file = e.target.files[0]; if (file) setCsv(await file.text()); }} />
      <textarea className="textarea mt12" style={{ minHeight: 140, fontFamily: 'var(--mono)', fontSize: 12 }} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="Or paste CSV here" />
      {res && <div className={res.errors.length ? 'err mt12' : 'okmsg mt12'}><b>{res.booked} booked.</b>{res.errors.map((e, i) => <div key={i}>{e}</div>)}</div>}
      <div className="row mt12"><AsyncBtn onClick={async () => { const r = await api('/me/shipments/bulk', { method: 'POST', body: { csv } }); setRes(r); onDone(); if (!r.errors.length) toast(r.booked + ' shipments booked'); }} disabled={!csv.trim()}>Upload & book</AsyncBtn><button className="btn btn-outline" onClick={onClose}>Close</button></div>
    </Modal>
  );
}
