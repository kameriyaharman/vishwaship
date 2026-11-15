'use client';
import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Logo } from './ui';

export function Barcode({ value, height = 50, width = 1.6 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && value) {
      try { JsBarcode(ref.current, String(value), { format: 'CODE128', height, width, displayValue: false, margin: 0 }); } catch {}
    }
  }, [value, height, width]);
  return <svg ref={ref} style={{ maxWidth: '100%' }} />;
}

export default function ShippingLabel({ s, compact, prefs }) {
  const p = prefs || s.label_prefs || {};
  const dims = `${+s.length}×${+s.breadth}×${+s.height}`;
  return (
    <div className="label4x6" style={compact ? { width: '100%', minHeight: 0, fontSize: 11 } : undefined}>
      <div className="row between">{p.show_brand && p.brand_name ? <b style={{ fontSize: 15 }}>{p.brand_name}</b> : <Logo dark size="sm" />}<b style={{ fontSize: 11 }}>{s.courier_name || `Delhivery · ${s.service === 'express' ? 'Express' : 'Surface'}`}</b></div>
      <div className="center mt8"><Barcode value={s.awb} height={compact ? 42 : 60} /><div className="mono" style={{ fontSize: compact ? 13 : 16, marginTop: 4 }}>{s.awb}</div></div>
      <div className="sep" />
      <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
        <div className="grow"><b>TO</b><div>{s.to_name}</div><div>{s.to_address}</div><div>{s.to_city}{s.to_state ? ', ' + s.to_state : ''} {s.to_pincode}</div>{!p.hide_buyer_phone && <div>{s.to_phone}</div>}</div>
        <div className="grow"><b>{p.hide_seller_address ? 'RETURN TO' : 'FROM'}</b><div>{p.show_brand && p.brand_name ? p.brand_name : s.from_name}</div>{!p.hide_seller_address && <><div>{s.from_address}</div><div>{s.from_city} {s.from_pincode}</div><div>{s.from_phone}</div></>}</div>
      </div>
      <div className="sep" />
      <div className="b">{s.payment_mode === 'cod' ? `COD · Collect ₹${(+s.cod_amount).toLocaleString('en-IN')}` : s.payment_mode === 'topay' ? 'TO PAY (FOD) · freight collect' : 'PREPAID'}{+s.boxes > 1 ? ` · ${s.boxes} boxes` : ''} · {+s.weight} kg · {dims} · Order #{s.order_no}</div>
      {!compact && <><div className="sep" /><div>{!p.hide_product && <>Contents: {s.product || '—'}</>}{!p.hide_product && !p.hide_value && ' · '}{!p.hide_value && <>Invoice value ₹{(+s.invoice_value).toLocaleString('en-IN')}</>}{s.hsn ? ` · HSN ${s.hsn}` : ''}{s.ewaybill_no ? ` · E-way bill ${s.ewaybill_no}` : ''}</div><div className="center mt8"><Barcode value={s.order_no} height={30} width={1.3} /></div></>}
      {p.footer_note && <><div className="sep" /><div className="center" style={{ fontSize: 10 }}>{p.footer_note}</div></>}
    </div>
  );
}
