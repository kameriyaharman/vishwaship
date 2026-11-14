'use client';
import { useEffect, useState } from 'react';
import { AsyncBtn, PageHead, useLoad } from '@/components/ui';
import Icon from '@/components/Icon';
import { api, download, qp, STATUS } from '@/lib/api';

const TYPES = [['shipment', 'Shipment Report', 'AWB, route, service, weight, charges, status, delivery date'], ['order', 'Order Reports', 'Receiver, address, product, invoice value, payment mode, COD'], ['ndr', 'NDR Reports', 'Failed delivery attempts, reasons, your actions, RTO charges'], ['custom', 'Custom Report', 'Pick your own columns and filters']];
const first = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };

export default function Reports() {
  const [type, setType] = useState('shipment');
  const [f, setF] = useState({ from: first(), to: new Date().toISOString().slice(0, 10), status: '', payment: '' });
  const [cols, setCols] = useState(['awb', 'order_no', 'created_at', 'to_name', 'to_city', 'to_pincode', 'payment_mode', 'total', 'status']);
  const meta = useLoad(() => api('/me/reports/columns'), []);
  useEffect(() => { const t = qp('type'); if (t) setType(t); }, []);
  const run = () => {
    const p = new URLSearchParams({ type, from: f.from, to: f.to, ...(type === 'custom' ? { columns: cols.join(','), status: f.status, payment: f.payment } : {}) });
    return download('/me/reports/export?' + p, `${type}-report-${f.from}-to-${f.to}.csv`);
  };
  return (
    <>
      <PageHead title="Reports" sub="Download shipment, order, NDR or custom reports as Excel (CSV)" />
      <div className="grid4 mb16">{TYPES.map(([k, l, d]) => (
        <button key={k} className="card" onClick={() => setType(k)} style={{ textAlign: 'left', cursor: 'pointer', borderColor: type === k ? 'var(--navy)' : undefined, boxShadow: type === k ? '0 0 0 1px var(--navy)' : undefined }}>
          <Icon name="chart" style={{ color: 'var(--orange)' }} /><div className="b mt8">{l}</div><div className="tiny muted">{d}</div></button>
      ))}</div>
      <div className="card">
        <div className="row wrap" style={{ alignItems: 'flex-end' }}>
          <div className="field"><label>From</label><input className="input" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
          <div className="field"><label>To</label><input className="input" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
          {type === 'custom' && <>
            <div className="field"><label>Status</label><select className="select" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">All</option>{['pickup_pending', 'in_transit', 'out_for_delivery', 'delivered', 'ndr', 'rto_in_transit', 'rto_delivered', 'cancelled'].map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}</select></div>
            <div className="field"><label>Payment</label><select className="select" value={f.payment} onChange={(e) => setF({ ...f, payment: e.target.value })}><option value="">All</option><option value="prepaid">Prepaid</option><option value="cod">COD</option></select></div>
          </>}
          <AsyncBtn onClick={run}><Icon name="download" />Download {TYPES.find((t) => t[0] === type)[1]}</AsyncBtn>
        </div>
        {type === 'custom' && meta.data && (
          <div className="mt16">
            <div className="lbl mb8">Columns ({cols.length})</div>
            <div className="grid4" style={{ gap: 8 }}>{Object.entries(meta.data.columns).map(([k, l]) => <label key={k} className="check"><input type="checkbox" checked={cols.includes(k)} onChange={(e) => setCols(e.target.checked ? [...cols, k] : cols.filter((x) => x !== k))} />{l}</label>)}</div>
          </div>
        )}
      </div>
    </>
  );
}
