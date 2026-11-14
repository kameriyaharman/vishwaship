'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Chip, Spinner, ErrorBox, AsyncBtn, toast, useLoad, PageHead } from '@/components/ui';
import { api, download, inr, kg, lakh, qp, STATUS } from '@/lib/api';

const TABS = ['all', 'pickup_pending', 'in_transit', 'out_for_delivery', 'delivered', 'rto', 'ndr', 'weight_discrepancy', 'cancelled'];

export default function AllShipments() {
  const [tab, setTab] = useState('all');
  const [f, setF] = useState({ q: '', customer: '', from: '', to: '', payment: '' });
  const [applied, setApplied] = useState(null);
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState([]);
  useEffect(() => { const init = { q: qp('q') || '', customer: qp('customer') || '' }; setF((x) => ({ ...x, ...init })); setApplied(init); }, []);
  const qs = () => new URLSearchParams({ tab, page, limit: 50, ...Object.fromEntries(Object.entries(applied || {}).filter(([, v]) => v)) }).toString();
  const { data: d, err, reload, loading } = useLoad(() => applied ? api('/admin/shipments?' + qs()) : Promise.resolve(null), [tab, applied, page]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const c = d?.counts || {};
  const sum = d?.summary;

  return (
    <>
      <PageHead title="All Shipments" sub="Search by customer, AWB, status · Delhivery base rate vs final rate shown to customer">
        {sel.length > 0 && <a className="btn btn-outline" href={`/label/?id=${sel.join(',')}`} target="_blank">Print {sel.length} labels</a>}
        <AsyncBtn className="btn btn-outline" onClick={() => download('/admin/shipments?export=1&' + qs(), 'all-shipments.csv')}>Export Excel</AsyncBtn>
        <AsyncBtn className="btn btn-outline" onClick={async () => { const r = await api('/admin/sync', { method: 'POST' }); toast(r.note || `${r.synced} shipments updated`); reload(); }}>Sync status now</AsyncBtn>
      </PageHead>
      <form className="card mb12" onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied({ ...f }); }}>
        <div className="row wrap" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 170px' }}><label>AWB / order / receiver</label><input className="input" value={f.q} onChange={set('q')} /></div>
          <div className="field"><label>Customer</label><select className="select" value={f.customer} onChange={set('customer')}><option value="">All customers</option>{(d?.customers || []).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
          <div className="field"><label>From</label><input className="input" type="date" value={f.from} onChange={set('from')} /></div>
          <div className="field"><label>To</label><input className="input" type="date" value={f.to} onChange={set('to')} /></div>
          <div className="field"><label>Mode</label><select className="select" value={f.payment} onChange={set('payment')}><option value="">All</option><option value="prepaid">Prepaid</option><option value="cod">COD</option></select></div>
          <button className="btn btn-navy">Apply</button>
        </div>
      </form>
      <div className="pills mb12">{TABS.map((t) => <button key={t} className={'pill' + (tab === t ? ' on' : '')} onClick={() => { setTab(t); setPage(1); }}>{t === 'out_for_delivery' ? 'OFD' : STATUS[t]} {c[t] !== undefined ? (t === 'in_transit' ? c.in_transit + c.picked_up : c[t]).toLocaleString('en-IN') : ''}</button>)}</div>
      <ErrorBox err={err} onRetry={reload} />
      <div className="card p0 tbl-wrap">
        {!d ? <Spinner /> : (
          <table className="tbl">
            <thead><tr><th style={{ width: 30 }}><input type="checkbox" checked={sel.length > 0 && sel.length === d.items.length} onChange={(e) => setSel(e.target.checked ? d.items.map((x) => x.id) : [])} /></th><th>AWB</th><th>Customer</th><th>Route</th><th className="hide-md">Weight</th><th>Mode</th><th className="num">Delhivery base</th><th className="num">Final (customer)</th><th className="num">Margin</th><th>Status</th></tr></thead>
            <tbody>
              {d.items.map((s) => {
                const base = +s.base_rate + +s.cod_base; const fin = +s.freight + +s.cod_charge;
                return (
                  <tr key={s.id} className="click" onClick={() => (location.href = '/admin/shipment/?id=' + s.id)}>
                    <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.includes(s.id)} onChange={(e) => setSel(e.target.checked ? [...sel, s.id] : sel.filter((x) => x !== s.id))} /></td>
                    <td className="mono">{s.awb}</td><td>{s.business_name || s.cname}</td><td>{s.from_city} → {s.to_city}</td><td className="hide-md">{kg(s.chargeable_weight)}</td>
                    <td><Chip s={s.payment_mode} label={s.payment_mode === 'cod' ? 'COD' : 'Prepaid'} /></td>
                    <td className="num">{inr(base)}</td><td className="num">{inr(fin)}</td><td className="num green b">{inr(fin - base)}</td>
                    <td><Chip s={s.status_key} label={s.status_label} /></td>
                  </tr>
                );
              })}
              {!d.items.length && <tr><td colSpan={10} className="empty">No shipments found.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      {sum && (
        <div className="card mt12 row wrap" style={{ gap: 30, padding: '12px 18px' }}>
          <span className="small">Selected filter: <b>{(+sum.n).toLocaleString('en-IN')} shipments</b></span>
          <span className="small">Delhivery base: <b>{lakh(sum.base)}</b></span>
          <span className="small">Customer final: <b>{lakh(sum.final)}</b></span>
          <span className="small green">Margin: <b>{lakh(sum.final - sum.base)}</b></span>
          <span className="grow" />
          {d.total > 50 && <span className="row"><button className="btn btn-outline btn-sm" disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>←</button><span className="small">Page {page} / {Math.ceil(d.total / 50)}</span><button className="btn btn-outline btn-sm" disabled={page * 50 >= d.total || loading} onClick={() => setPage(page + 1)}>→</button></span>}
        </div>
      )}
    </>
  );
}
