'use client';
import { useEffect, useState } from 'react';
import BuyerInvoice from '@/components/BuyerInvoice';
import { Spinner } from '@/components/ui';
import { api, getUser, qp } from '@/lib/api';

export default function BuyerInvoicePage() {
  const [s, setS] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { const admin = getUser()?.role !== 'customer'; api((admin ? '/admin/shipments/' : '/me/shipments/') + qp('id')).then(setS).catch((e) => setErr(e.message)); }, []);
  if (err) return <div className="err" style={{ margin: 30 }}>{err}</div>;
  if (!s) return <Spinner />;
  return (<div className="print-area" style={{ padding: 24, background: '#fff', minHeight: '100vh' }}><div className="no-print row mb16"><button className="btn btn-navy" onClick={() => window.print()}>Print / Save as PDF</button><a className="link small" href="/settings/?tab=invoice">Edit invoice settings</a></div><BuyerInvoice s={s} /></div>);
}
