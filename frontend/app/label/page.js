'use client';
import { useEffect, useState } from 'react';
import ShippingLabel from '@/components/Label';
import BuyerInvoice from '@/components/BuyerInvoice';
import { Spinner } from '@/components/ui';
import { api, getUser, qp } from '@/lib/api';

export default function LabelPage() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    const u = getUser();
    const base = u && u.role !== 'customer' ? '/admin/shipments/' : '/me/shipments/';
    const ids = (qp('id') || '').split(',').filter(Boolean);
    Promise.all(ids.map((i) => api(base + i))).then(setItems).catch((e) => setErr(e.message));
  }, []);
  useEffect(() => { if (items?.length) setTimeout(() => window.print(), 600); }, [items]);
  if (err) return <div className="err" style={{ margin: 30 }}>{err}</div>;
  if (!items) return <Spinner />;
  return (
    <div className="print-area" style={{ padding: 24, background: '#fff', minHeight: '100vh' }}>
      <div className="no-print row mb16"><button className="btn btn-navy" onClick={() => window.print()}>Print / Save as PDF</button><span className="small muted">Use 4×6 inch label paper or A4.</span></div>
      {items[0]?.label_prefs?.size === 'a4'
        ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 100mm)', gap: '6mm' }}>{items.map((s) => <ShippingLabel key={s.id} s={s} />)}</div>
        : <div className="col" style={{ gap: 24 }}>{items.map((s) => <div key={s.id} style={{ pageBreakAfter: 'always' }}><ShippingLabel s={s} />{s.invoice_prefs?.show_on_package && <div className="mt16"><BuyerInvoice s={s} /></div>}</div>)}</div>}
    </div>
  );
}
