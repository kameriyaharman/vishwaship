'use client';
import { useEffect, useState } from 'react';
import { Spinner, Logo } from '@/components/ui';
import { api, getUser, qp, inr, dShort, monthLabel } from '@/lib/api';
import { loadConfig } from '@/lib/config';

function num2words(n) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const w = (x) => x < 20 ? a[x] : x < 100 ? b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : '') : x < 1000 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + w(x % 100) : '') : x < 100000 ? w(Math.floor(x / 1000)) + ' Thousand' + (x % 1000 ? ' ' + w(x % 1000) : '') : x < 10000000 ? w(Math.floor(x / 100000)) + ' Lakh' + (x % 100000 ? ' ' + w(x % 100000) : '') : w(Math.floor(x / 10000000)) + ' Crore' + (x % 10000000 ? ' ' + w(x % 10000000) : '');
  const r = Math.floor(n); return (r ? w(r) : 'Zero') + ' Rupees Only';
}

export default function InvoicePage() {
  const [inv, setInv] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    const admin = getUser()?.role !== 'customer';
    const id = qp('id'); const sid = qp('shipment');
    (async () => {
      if (id) return api((admin ? '/admin/invoices/' : '/me/invoices/') + id);
      const s = await api((admin ? '/admin/shipments/' : '/me/shipments/') + sid);
      const cfg = await loadConfig();
      return { number: 'SHP/' + s.order_no, period: null, created_at: s.created_at, customer: s.customer, company: cfg.company, lines: [s], taxable: +s.freight + +s.cod_charge, gst: +s.gst, amount: +s.total, gst_pct: cfg.gst_pct };
    })().then((d) => {
      if (!d.taxable && d.lines) { d.taxable = d.lines.reduce((t, l) => t + +l.freight + +l.cod_charge, 0); }
      setInv(d);
    }).catch((e) => setErr(e.message));
  }, []);
  if (err) return <div className="err" style={{ margin: 30 }}>{err}</div>;
  if (!inv) return <Spinner />;
  const c = inv.company || {}; const cu = inv.customer || {};
  return (
    <div className="print-area" style={{ background: '#fff', minHeight: '100vh', padding: 30 }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div className="no-print row mb16"><button className="btn btn-navy" onClick={() => window.print()}>Print / Save as PDF</button></div>
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div><Logo dark /><div className="small mt8"><b>{c.name}</b><br />{c.address}{c.gstin && <><br />GSTIN: {c.gstin}</>}</div></div>
          <div className="right"><h2 style={{ fontSize: 22 }}>TAX INVOICE</h2><div className="small">No: <b>{inv.number}</b><br />Date: {dShort(inv.created_at)}{inv.period && <><br />Period: {monthLabel(inv.period)}</>}</div></div>
        </div>
        <div className="card mt16" style={{ background: '#fafaf8' }}><div className="small muted">Bill to</div><b>{cu.business_name || cu.name}</b><div className="small">{cu.name} · {cu.mobile} · {cu.email}{cu.gstin && <> · GSTIN {cu.gstin}</>}</div></div>
        <table className="tbl mt16">
          <thead><tr><th>#</th><th>AWB</th><th>Date</th><th>Destination</th><th>Wt</th><th className="num">Freight</th><th className="num">COD</th><th className="num">GST</th><th className="num">Total</th></tr></thead>
          <tbody>{inv.lines.map((l, i) => <tr key={i}><td>{i + 1}</td><td className="mono">{l.awb}</td><td>{dShort(l.created_at)}</td><td>{l.to_city} {l.to_pincode}</td><td>{+l.chargeable_weight}</td><td className="num">{inr(l.freight, 2)}</td><td className="num">{inr(l.cod_charge, 2)}</td><td className="num">{inr(l.gst, 2)}</td><td className="num">{inr(l.total, 2)}</td></tr>)}</tbody>
        </table>
        <div className="row mt16" style={{ justifyContent: 'flex-end' }}>
          <div style={{ width: 300 }}>
            <div className="kv"><span>Taxable value</span><b>{inr(inv.taxable, 2)}</b></div>
            <div className="kv"><span>GST ({c.gst_pct || inv.gst_pct || 18}%)</span><b>{inr(inv.gst, 2)}</b></div>
            <div className="kv" style={{ fontSize: 16 }}><span>Total</span><b>{inr(inv.amount, 2)}</b></div>
          </div>
        </div>
        <div className="small mt8"><b>Amount in words:</b> {num2words(inv.amount)}</div>
        <div className="tiny muted mt24">SAC 996812 — Courier services. This is a computer-generated invoice.</div>
      </div>
    </div>
  );
}
