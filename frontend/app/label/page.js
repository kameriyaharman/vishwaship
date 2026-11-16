'use client';
import { useEffect, useState } from 'react';
import ShippingLabel from '@/components/Label';
import BuyerInvoice from '@/components/BuyerInvoice';
import { LABEL_FORMATS } from '@/components/LabelButton';
import { Spinner } from '@/components/ui';
import { api, getUser, qp } from '@/lib/api';

const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

export default function LabelPage() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  const [fmt, setFmt] = useState('');
  useEffect(() => {
    const u = getUser();
    const base = u && u.role !== 'customer' ? '/admin/shipments/' : '/me/shipments/';
    const ids = (qp('id') || '').split(',').filter(Boolean);
    Promise.all(ids.map((i) => api(base + i))).then((r) => {
      setItems(r);
      const pref = r[0]?.label_prefs?.size === 'a4' ? 'a4-4' : 'thermal';
      setFmt(qp('format') || pref);
    }).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { if (items?.length && fmt && qp('format')) setTimeout(() => window.print(), 700); }, [items, fmt]);
  if (err) return <div className="err" style={{ margin: 30 }}>{err}</div>;
  if (!items || !fmt) return <Spinner />;
  // one label per box: "Box i of N", with that box's own AWB when the courier gave one
  const perBox = items.flatMap((s) => {
    const n = Math.max(1, +s.boxes || 1);
    if (n === 1) return [s];
    let kids = []; try { kids = Array.isArray(s.child_awbs) ? s.child_awbs : JSON.parse(s.child_awbs || '[]'); } catch {}
    return Array.from({ length: n }, (_, i) => ({ ...s, _key: s.id + '-' + i, box_no: i + 1, box_count: n, box_awb: i === 0 ? s.awb : kids[i - 1] || s.awb }));
  });
  const thermal = fmt === 'thermal';
  const n = thermal ? 1 : +fmt.split('-')[1] || 1;
  return (
    <div className="print-area" style={{ padding: 20, background: '#f4f3ef', minHeight: '100vh' }}>
      <style>{thermal ? '@page { size: 4in 6in; margin: 0 }' : '@page { size: A4; margin: 0 }'}</style>
      <div className="no-print row wrap mb16" style={{ justifyContent: 'center' }}>
        <select className="select" style={{ width: 'auto' }} value={fmt} onChange={(e) => setFmt(e.target.value)}>{LABEL_FORMATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <button className="btn btn-navy" onClick={() => window.print()}>Print / Save as PDF</button>
        <span className="small muted">{perBox.length} label{perBox.length > 1 ? 's' : ''}{perBox.length > items.length ? ` (${items.length} shipment${items.length > 1 ? 's' : ''}, one per box)` : ''}</span>
      </div>
      {thermal
        ? perBox.map((s) => <div key={s._key || s.id} className="sheet sheet-thermal"><ShippingLabel s={s} /></div>)
        : chunk(perBox, n).map((g, i) => <div key={i} className={`sheet sheet-a4 n${n}`}>{g.map((s) => <ShippingLabel key={s._key || s.id} s={s} />)}</div>)}
      {items.filter((s) => s.invoice_prefs?.show_on_package).map((s) => <div key={'i' + s.id} className="sheet" style={{ pageBreakBefore: 'always', padding: 20 }}><BuyerInvoice s={s} /></div>)}
    </div>
  );
}
