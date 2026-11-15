'use client';
import { useState } from 'react';
import { API, inr } from '@/lib/api';

export const logoSrc = (l) => (!l ? '' : l.startsWith('carrier:') ? `${API}/public/carrier-logo/${l.slice(8)}` : l);

export function CourierLogo({ o, size = 44 }) {
  const [bad, setBad] = useState(false);
  const src = logoSrc(o.logo);
  const initials = (o.carrier || o.name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span className="clogo" style={{ width: size * 1.6, height: size }}>
      {src && !bad ? <img src={src} alt={o.carrier || o.name} onError={() => setBad(true)} /> : <b>{initials}</b>}
    </span>
  );
}

/** GST-inclusive breakdown for one quoted option */
export function Breakdown({ o, chargeable }) {
  const pct = o.gst_pct ?? 18;
  return (
    <div className="bkd">
      {o.to_pay && <div className="note mb8 small">To Pay (FOD): the courier collects about <b>{inr(o.receiver_pays, 2)}</b> from the receiver at delivery. You pay only the booking fee.</div>}
      <div className="kv"><span>{o.to_pay ? 'Booking fee' : `Shipping charge${chargeable ? ` (${chargeable} kg)` : ''}`}</span><b>{inr(o.shipping ?? o.freight, 2)}</b></div>
      {+o.first_mile > 0 && <div className="kv"><span>First-mile (pickup) charge</span><b>{inr(o.first_mile, 2)}</b></div>}
      {+o.other_charges > 0 && <div className="kv"><span>{o.other_label || 'Other charges'}</span><b>{inr(o.other_charges, 2)}</b></div>}
      {(+o.cod_charge > 0 || o.cod_included) && <div className="kv"><span>COD charges</span><b>{o.cod_included ? 'included' : inr(o.cod_charge, 2)}</b></div>}
      <div className="kv"><span>GST {pct}% (included)</span><b>{inr(o.gst, 2)}</b></div>
      <div className="kv tot"><span>Total payable (incl. GST)</span><b>{inr(o.total, 2)}</b></div>
    </div>
  );
}

/** one quote row: logo · courier · service · ETA · GST-inclusive price */
export default function RateOption({ o, selected, onSelect, chargeable, showBreakdown = 'selected', eta }) {
  const [open, setOpen] = useState(false);
  const show = showBreakdown === 'always' || (showBreakdown === 'selected' && selected) || open;
  return (
    <div className={'ropt' + (selected ? ' on' : '')} onClick={onSelect}>
      <div className="ropt-row">
        {onSelect && <span className="radio" />}
        <CourierLogo o={o} />
        <div className="ropt-mid">
          <div className="b">{o.name}</div>
          <div className="tiny muted">{o.via && o.via !== o.carrier ? `via ${o.via} · ` : ''}{o.days}{eta ? ` · ETA ${eta}` : ''}{o.pricing === 'card' ? ' · Vishwaship rate' : ''}</div>
        </div>
        <div className="ropt-price">
          <b>{inr(o.to_pay ? o.receiver_pays : o.total, 2)}</b>
          <span className="tiny muted">{o.to_pay ? 'paid by receiver' : 'incl. GST'}</span>
          {showBreakdown !== 'always' && <button type="button" className="link tiny" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>{show ? 'Hide' : 'Breakdown'}</button>}
        </div>
      </div>
      {show && <Breakdown o={o} chargeable={chargeable} />}
    </div>
  );
}
