'use client';
import { inr, dShort } from '@/lib/api';

/** Invoice from the seller to their buyer (uses seller's Invoice settings) */
export default function BuyerInvoice({ s }) {
  const v = s.invoice_prefs || {};
  const gstRate = 0; // seller's product GST is not tracked — invoice value treated as inclusive
  const no = (v.prefix || 'INV-') + String(s.order_no).replace(/\D/g, '');
  return (
    <div style={{ background: '#fff', color: '#000', border: '1px solid #ccc', borderRadius: 8, padding: 22, maxWidth: 760, fontSize: 13, pageBreakBefore: 'always' }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div><b style={{ fontSize: 17 }}>{v.legal_name || s.customer?.business_name || s.from_name}</b><div>{v.address || `${s.from_address}, ${s.from_city} ${s.from_pincode}`}</div>{(v.gstin || s.customer?.gstin) && <div>GSTIN: {v.gstin || s.customer?.gstin}</div>}</div>
        <div className="right"><b style={{ fontSize: 17 }}>TAX INVOICE</b><div>No: {no}</div><div>Date: {dShort(s.created_at)}</div><div>Order: #{s.order_no}</div><div>AWB: {s.awb}</div></div>
      </div>
      <div style={{ borderTop: '1px solid #ddd', margin: '12px 0', paddingTop: 10 }}><b>Bill / Ship to</b><div>{s.to_name} · {s.to_phone}</div><div>{s.to_address}, {s.to_city}{s.to_state ? ', ' + s.to_state : ''} {s.to_pincode}</div></div>
      <table className="tbl" style={{ fontSize: 13 }}>
        <thead><tr><th>#</th><th>Item</th><th>HSN</th><th className="num">Qty</th><th className="num">Amount</th></tr></thead>
        <tbody><tr><td>1</td><td>{s.product || 'Goods'}</td><td>{v.hsn || '—'}</td><td className="num">1</td><td className="num">{inr(s.invoice_value, 2)}</td></tr></tbody>
      </table>
      <div className="row mt12" style={{ justifyContent: 'flex-end' }}><div style={{ width: 260 }}>
        <div className="kv"><span>Total (incl. taxes)</span><b>{inr(+s.invoice_value * (1 + gstRate), 2)}</b></div>
        <div className="kv"><span>Payment</span><b>{s.payment_mode === 'cod' ? `COD · collect ${inr(s.cod_amount, 2)}` : 'Prepaid'}</b></div>
      </div></div>
      {v.terms && <div className="tiny mt12">{v.terms}</div>}
      <div className="right mt24"><div style={{ borderTop: '1px solid #999', display: 'inline-block', paddingTop: 4, minWidth: 180, textAlign: 'center' }}>{v.signatory || 'Authorised signatory'}</div></div>
    </div>
  );
}
