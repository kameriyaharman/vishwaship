'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { useShell } from '@/components/Shell';
import ShippingLabel from '@/components/Label';
import { Spinner, toast, Modal } from '@/components/ui';
import { api, inr, kg, qp, today, dLong, uploadFile } from '@/lib/api';
import { useConfig } from '@/lib/config';

const EMPTY = { to_name: '', to_phone: '', to_pincode: '', to_city: '', to_state: '', to_address: '', product: '', invoice_value: '', hsn: '', order_ref: '', invoice_file_id: '', ewaybill_no: '', ewaybill_file_id: '', payment_mode: 'prepaid', cod_amount: '', weight: '', boxes: '1', length: '', breadth: '', height: '', service: 'surface', ship_type: 'b2c' };
const NEWBOX = { l: '', b: '', h: '', n: '1' };

function Stepper({ step }) {
  const S = ['Addresses', 'Package', 'Rate & pay', 'AWB'];
  return (
    <div className="stepper">
      {S.map((l, i) => (
        <span key={l} className="row" style={{ gap: 14 }}>
          <span className={'step ' + (i + 1 < step ? 'done' : i + 1 === step ? 'on' : '')}><span className="n">{i + 1 < step ? <Icon name="check" size={12} sw={3} /> : i + 1}</span>{l}</span>
          {i < 3 && <span className="step-line" />}
        </span>
      ))}
    </div>
  );
}

export default function Book() {
  const { me, refresh } = useShell();
  const cfg = useConfig();
  const [step, setStep] = useState(1);
  const [pickups, setPickups] = useState(null);
  const [pickupId, setPickupId] = useState(null);
  const [pdate, setPdate] = useState(today());
  const [slot, setSlot] = useState('');
  const [f, setF] = useState(EMPTY);
  const [boxes, setBoxes] = useState([{ ...NEWBOX }]);
  const setBox = (i, k, v) => setBoxes((bs) => bs.map((b, j) => (j === i ? { ...b, [k]: v.replace(/[^0-9.]/g, '') } : b)));
  const boxList = boxes.filter((b) => +b.l && +b.b && +b.h).map((b) => ({ l: +b.l, b: +b.b, h: +b.h, n: Math.max(1, Math.round(+b.n || 1)) }));
  const boxCount = boxList.reduce((a, b) => a + b.n, 0) || 1;
  const [pin, setPin] = useState(null);
  const [quote, setQuote] = useState(null);
  const [qErr, setQErr] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [draftId, setDraftId] = useState(null);
  const [pickPicker, setPickPicker] = useState(false);
  const [manualSvc, setManualSvc] = useState(false);
  const qTimer = useRef(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    api('/me/pickups').then((r) => { setPickups(r.items); const d = r.items.find((p) => p.is_default == 1) || r.items[0]; if (d) setPickupId(d.id); });
    const did = qp('draft');
    if (did) api('/me/drafts').then((r) => {
      const d = r.items.find((x) => String(x.id) === did); if (!d) return;
      setDraftId(d.id); setPickupId(d.pickup_id);
      const n = {}; Object.keys(EMPTY).forEach((k) => (n[k] = d[k] == null || d[k] === '0.000' || d[k] === '0.00' ? EMPTY[k] : String(d[k])));
      setF(n);
      try { const bl = JSON.parse(d.box_list || '[]'); if (bl.length) setBoxes(bl.map((b) => ({ l: String(b.l), b: String(b.b), h: String(b.h), n: String(b.n || 1) }))); else if (+d.length) setBoxes([{ l: String(+d.length), b: String(+d.breadth), h: String(+d.height), n: String(d.boxes || 1) }]); } catch {}
    });
  }, []);
  useEffect(() => { if (cfg && !slot) setSlot(cfg.pickup_slots?.[1] || cfg.pickup_slots?.[0] || ''); }, [cfg, slot]);

  // pincode check
  useEffect(() => {
    if (!/^\d{6}$/.test(f.to_pincode)) { setPin(null); return; }
    let ok = true;
    api('/public/pincode/' + f.to_pincode).then((r) => {
      if (!ok) return; setPin(r);
      setF((x) => ({ ...x, to_city: x.to_city || r.city || '', to_state: x.to_state || r.state || '' }));
    }).catch(() => setPin(null));
    return () => { ok = false; };
  }, [f.to_pincode]);

  const pickup = pickups?.find((p) => p.id == pickupId);

  // live quote
  useEffect(() => {
    if (step !== 2 || !pickup || !+f.weight || !/^\d{6}$/.test(f.to_pincode)) { setQuote(null); return; }
    clearTimeout(qTimer.current);
    qTimer.current = setTimeout(async () => {
      try {
        setQErr('');
        const q = await api('/me/quote', { method: 'POST', body: { from: pickup.pincode, to: f.to_pincode, weight: +f.weight, l: boxList[0]?.l || 0, b: boxList[0]?.b || 0, h: boxList[0]?.h || 0, payment: f.payment_mode, cod_amount: +f.cod_amount || +f.invoice_value || 0, invoice_value: +f.invoice_value || 0, boxes: boxCount, box_list: boxList, kind: f.ship_type } });
        setQuote(q);
        if (!manualSvc && q.options.length) {
          const a = me.prefs?.auto_assign || {};
          let rule = a.default || 'cheapest';
          if (f.payment_mode === 'cod' && a.cod) rule = a.cod;
          if (a.heavy && +f.weight > +(a.heavy_kg || 0)) rule = a.heavy;
          const pick = rule === 'cheapest' ? [...q.options].sort((x, y) => x.total - y.total)[0]
            : rule === 'fastest' ? (q.options.find((o) => o.service === 'express') || q.options[0])
              : (q.options.find((o) => o.service === rule) || q.options[0]);
          if (pick && pick.service !== f.service) setF((x) => ({ ...x, service: pick.service }));
        } else if (!q.options.find((o) => o.service === f.service) && q.options[0]) setF((x) => ({ ...x, service: q.options[0].service }));
      } catch (e) { setQErr(e.message); setQuote(null); }
    }, 350);
  }, [step, pickup, f.weight, JSON.stringify(boxList), f.ship_type, f.payment_mode, f.cod_amount, f.invoice_value, f.to_pincode, f.service]);

  const next1 = () => {
    setErr('');
    if (!pickup) return setErr('Add a pickup address first');
    for (const [k, l] of [['to_name', 'Receiver name'], ['to_phone', 'Mobile'], ['to_pincode', 'Pincode'], ['to_address', 'Full address']]) if (!String(f[k]).trim()) return setErr(l + ' is required');
    if (!/^\d{10}$/.test(f.to_phone.replace(/\D/g, '').slice(-10))) return setErr('Enter a valid 10-digit mobile');
    if (pin && !pin.serviceable) return setErr('This pincode is not serviceable');
    setStep(2); window.scrollTo(0, 0);
  };
  const saveDraft = async () => {
    try {
      const r = await api('/me/shipments', { method: 'POST', body: { ...f, box_list: boxList, boxes: boxCount, pickup_id: pickupId, pickup_date: pdate, pickup_slot: slot, draft: true, draft_id: draftId } });
      setDraftId(r.draft_id); toast('Draft saved');
    } catch (e) { toast(e.message, true); }
  };
  const confirm = async () => {
    setErr('');
    if (!+f.weight) return setErr('Enter actual weight');
    if (!boxList.length || boxList.length !== boxes.length) return setErr('Enter Length, Breadth and Height for every box');
    if (+f.invoice_value > 50000 && !f.ewaybill_no && !f.ewaybill_file_id) return setErr('E-way bill is required for invoice value above ₹50,000 — enter the number or upload it.');
    setBusy(true);
    try {
      const s = await api('/me/shipments', { method: 'POST', body: { ...f, weight: +f.weight, boxes: boxCount, box_list: boxList, length: boxList[0].l, breadth: boxList[0].b, height: boxList[0].h, pickup_id: pickupId, pickup_date: pdate, pickup_slot: slot, draft_id: draftId } });
      setDone(s); setStep(4); refresh(); window.scrollTo(0, 0);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!pickups) return <Spinner />;
  const opt = quote?.options.find((o) => o.service === f.service);
  const vol = boxList.reduce((a, b) => a + b.l * b.b * b.h * b.n, 0) / (cfg?.vol_divisor || 5000);
  const trackUrl = done ? `${location.origin}/track/?awb=${done.awb}` : '';

  return (
    <>
      <div className="ph"><div><h1>{step === 4 ? <>Shipment Booked <Icon name="check" size={20} /></> : 'Book Shipment'}</h1>
        <p>{step === 1 ? 'Step 1 — pickup & delivery address with pincode check' : step === 4 ? 'Step 4 — AWB generated from Delhivery, label ready, pickup scheduled' : 'Step 2 & 3 — package details, volumetric weight and final rate'}</p></div></div>
      <Stepper step={step === 2 ? 3 : step === 4 ? 5 : step} />

      {step === 1 && (
        <>
          <div className="split">
            <div className="card">
              <div className="card-h"><h3><Icon name="pin" style={{ color: 'var(--orange)' }} />Pickup address</h3>{pickups.length > 1 && <button className="link-navy small" onClick={() => setPickPicker(true)}>Change</button>}</div>
              {pickup ? (
                <div className="addr-box">
                  <div className="row"><b>{pickup.name}</b>{pickup.is_default == 1 && <span className="chip c-delivered">Default</span>}</div>
                  <div>{pickup.address}, {pickup.city} — {pickup.pincode}</div><div>{pickup.contact} · {pickup.phone}</div>
                </div>
              ) : <div className="note">No pickup address yet.</div>}
              <Link href="/pickup-addresses/?add=1" className="small muted mt8" style={{ display: 'block' }}>+ Add new pickup address (registered with Delhivery as pickup location)</Link>
              <div className="grid2 mt16">
                <div className="field"><label>Pickup date</label><input className="input" type="date" min={today()} value={pdate} onChange={(e) => setPdate(e.target.value)} /></div>
                <div className="field"><label>Pickup slot</label><select className="select" value={slot} onChange={(e) => setSlot(e.target.value)}>{(cfg?.pickup_slots || []).map((s) => <option key={s}>{s}</option>)}</select></div>
              </div>
            </div>
            <div className="card">
              <div className="card-h"><h3><Icon name="map" style={{ color: 'var(--orange)' }} />Delivery address</h3></div>
              <div className="grid2">
                <div className="field"><label>Receiver name</label><input className="input" value={f.to_name} onChange={set('to_name')} /></div>
                <div className="field"><label>Mobile</label><input className="input" inputMode="tel" value={f.to_phone} onChange={set('to_phone')} /></div>
                <div className="field"><label>Pincode</label><input className="input hl" inputMode="numeric" maxLength={6} value={f.to_pincode} onChange={(e) => { setF({ ...f, to_pincode: e.target.value.replace(/\D/g, ''), to_city: '', to_state: '' }); }} /></div>
                <div className="field"><label>City / State</label><div className="row" style={{ gap: 6 }}><input className="input" placeholder="City" value={f.to_city} onChange={set('to_city')} /><input className="input" placeholder="State" value={f.to_state} onChange={set('to_state')} /></div></div>
              </div>
              <div className="field mt12"><label>Full address</label><input className="input" value={f.to_address} onChange={set('to_address')} placeholder="House / flat, street, area, landmark" /></div>
              {pin && (
                <div className="row wrap mt12" style={{ gap: 6 }}>
                  {pin.serviceable ? <><span className="tag-ok">✓ Serviceable</span>{pin.prepaid && <span className="tag-ok">✓ Prepaid</span>}{pin.cod ? <span className="tag-ok">✓ COD</span> : <span className="tag-no">✗ COD</span>}{pin.reverse && <span className="tag-ok">✓ Reverse pickup</span>}</> : <span className="tag-no">✗ Not serviceable</span>}
                </div>
              )}
            </div>
          </div>
          {err && <div className="err mt12">{err}</div>}
          <div className="row between mt16">
            <button className="btn btn-outline" onClick={saveDraft}>Save draft</button>
            <button className="btn btn-orange btn-lg" onClick={next1}>Next: Package details →</button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="split">
            <div className="card">
              <div className="card-h"><h3><Icon name="box" style={{ color: 'var(--orange)' }} />Package</h3><button className="link-navy small" onClick={() => setStep(1)}>← Edit addresses</button></div>
              <div className="grid2">
                <div className="field" style={{ gridColumn: '1 / -1' }}><label>Shipment type</label>
                  <div className="seg2">
                    {[['b2c', 'B2C', 'Parcel to a consumer'], ['b2b', 'B2B', 'Business cargo / heavy, multi-box']].map(([k, l, d]) => (
                      <button type="button" key={k} className={f.ship_type === k ? 'on' : ''} onClick={() => { setManualSvc(false); setF((x) => ({ ...x, ship_type: k, payment_mode: k === 'b2c' && x.payment_mode === 'topay' ? 'prepaid' : x.payment_mode })); }}><b>{l}</b><span>{d}</span></button>
                    ))}
                  </div>
                </div>
                <div className="field"><label>Product / contents</label><input className="input" value={f.product} onChange={set('product')} placeholder="Cotton kurta ×2" /></div>
                <div className="field"><label>Invoice value (₹)</label><input className="input" type="number" min="0" value={f.invoice_value} onChange={(e) => setF({ ...f, invoice_value: e.target.value.replace(/^-/, '') })} /></div>
                <div className="field"><label>Product HSN code</label><input className="input" inputMode="numeric" maxLength={8} value={f.hsn} onChange={(e) => setF({ ...f, hsn: e.target.value.replace(/\D/g, '') })} placeholder="e.g. 6204" /></div>
                <div className="field"><label>Order reference ID <span className="muted">(optional)</span></label><input className="input" value={f.order_ref} onChange={set('order_ref')} placeholder="Your store order no." /></div>
                <div className="field" style={{ gridColumn: '1 / -1' }}><label>Upload invoice copy <span className="muted">(optional · PDF/image)</span></label>
                  <DocUpload id={f.invoice_file_id} onChange={(id) => setF((x) => ({ ...x, invoice_file_id: id }))} /></div>
                {+f.invoice_value > 50000 && (
                  <div style={{ gridColumn: '1 / -1', background: 'var(--orange-soft)', border: '1px solid var(--orange-line)', borderRadius: 10, padding: 12 }}>
                    <div className="b small mb8">E-way bill required (invoice value above ₹50,000)</div>
                    <div className="grid2">
                      <div className="field"><label>E-way bill number</label><input className="input" inputMode="numeric" maxLength={14} value={f.ewaybill_no} onChange={(e) => setF({ ...f, ewaybill_no: e.target.value.replace(/\D/g, '') })} placeholder="12-digit EWB no." /></div>
                      <div className="field"><label>Upload e-way bill</label><DocUpload id={f.ewaybill_file_id} onChange={(id) => setF((x) => ({ ...x, ewaybill_file_id: id }))} /></div>
                    </div>
                  </div>
                )}
                <div className="field"><label>Actual weight (kg){boxCount > 1 ? ` — all ${boxCount} boxes together` : ''}</label><input className="input hl" type="number" step="0.01" value={f.weight} onChange={set('weight')} /></div>
                <div className="field"><label>Payment mode</label><select className="select" value={f.payment_mode} onChange={set('payment_mode')}><option value="prepaid">Prepaid</option><option value="cod" disabled={pin && !pin.cod}>COD</option><option value="topay" disabled={f.ship_type !== 'b2b'}>To Pay (FOD){f.ship_type !== 'b2b' ? ' — B2B only' : ''}</option></select>
                  {f.payment_mode === 'topay' && <div className="tiny muted" style={{ marginTop: 4 }}>Freight is paid by the receiver at delivery.</div>}</div>
                {f.payment_mode === 'cod' && <div className="field" style={{ gridColumn: '1/-1' }}><label>COD amount to collect (₹)</label><input className="input" type="number" value={f.cod_amount} placeholder={f.invoice_value} onChange={set('cod_amount')} /></div>}
              </div>
              <div className="boxes mt12">
                {boxes.map((bx, i) => (
                  <div className="boxrow" key={i}>
                    <div className="boxhd"><b>Box {i + 1}</b>{boxes.length > 1 && <button type="button" className="link small red" onClick={() => setBoxes((bs) => bs.filter((_, j) => j !== i))}>Remove</button>}</div>
                    <div className="boxgrid">
                      <div className="field"><label>Length (cm)</label><input className="input hl" inputMode="decimal" value={bx.l} onChange={(e) => setBox(i, 'l', e.target.value)} /></div>
                      <div className="field"><label>Breadth (cm)</label><input className="input hl" inputMode="decimal" value={bx.b} onChange={(e) => setBox(i, 'b', e.target.value)} /></div>
                      <div className="field"><label>Height (cm)</label><input className="input hl" inputMode="decimal" value={bx.h} onChange={(e) => setBox(i, 'h', e.target.value)} /></div>
                      <div className="field"><label>Qty</label><input className="input" inputMode="numeric" value={bx.n} onChange={(e) => setBox(i, 'n', e.target.value)} /></div>
                    </div>
                  </div>
                ))}
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setBoxes((bs) => [...bs, { ...NEWBOX }])}><Icon name="plus" size={14} /> Add box</button>
                <span className="tiny muted" style={{ marginLeft: 10 }}>{boxCount} box{boxCount > 1 ? 'es' : ''} · use Qty for identical cartons</span>
              </div>
              <div className="note mt12" style={{ background: '#f5f6fa' }}>
                <div className="kv"><span>Volumetric weight (Σ L×B×H ÷ {cfg?.vol_divisor || 5000})</span><b>{kg(vol || 0)}</b></div>
                <div className="kv"><span>Actual weight</span><b>{kg(+f.weight || 0)}</b></div>
                <div className="kv"><span>Chargeable weight (higher, 500 g slabs)</span><b>{quote ? kg(quote.chargeable_weight) : kg(Math.max(vol || 0, +f.weight || 0))}</b></div>
              </div>
              <p className="warn mt8">⚠ Enter correct weight & size — courier re-weighs; difference is charged as weight discrepancy.</p>
            </div>
            <div className="card">
              <div className="card-h"><h3><Icon name="rupee" style={{ color: 'var(--orange)' }} />Choose service & final rate</h3></div>
              {qErr && <div className="err mb12">{qErr}</div>}
              {quote && !quote.options.length && <div className="note small">{f.ship_type === 'b2b' ? 'No B2B / cargo rate for this route yet — try B2C, or contact support for a B2B rate card.' : 'No courier available for this route and weight.'}</div>}
              {!quote ? <p className="muted small">Enter weight to see the final rate.</p> : (
                <>
                  {quote.options.map((o) => (
                    <div key={o.service} className={'opt' + (f.service === o.service ? ' on' : '')} onClick={() => { setManualSvc(true); setF({ ...f, service: o.service }); }}>
                      <span className="radio" /><div><div className="b">{o.name}</div><div className="tiny muted">{o.days} · ETA {dLong(o.eta).slice(4, 10)}</div></div>
                      <span className="price">{o.to_pay ? <span style={{ textAlign: 'right', display: 'block' }}>{inr(o.receiver_pays)}<span className="tiny muted" style={{ display: 'block', fontWeight: 500 }}>paid by receiver</span></span> : inr(o.freight + o.cod_charge)}</span>
                    </div>
                  ))}
                  {opt && (
                    <div className="mt12">
                      {opt.to_pay && <div className="note mb8 small">To Pay (FOD): the courier collects about <b>{inr(opt.receiver_pays, 2)}</b> freight from the receiver at delivery. You pay only the booking fee below.</div>}
                      <div className="kv"><span>{opt.to_pay ? 'Booking fee' : `Freight (${opt.name}, ${kg(quote.chargeable_weight)})`}</span><b>{inr(opt.freight, 2)}</b></div>
                      <div className="kv"><span>COD charges</span><b>{opt.cod_charge ? inr(opt.cod_charge, 2) : '—'}</b></div>
                      <div className="kv"><span>GST {quote.gst_pct}%</span><b>{inr(opt.gst, 2)}</b></div>
                      <div className="row between mt12"><b style={{ fontSize: 20 }}>Total payable</b><b style={{ fontSize: 22 }}>{inr(opt.total, 2)}</b></div>
                      <div className="tiny muted">Deducted from wallet · balance after booking {inr(+me.wallet_balance - opt.total, 2)}</div>
                      {+me.wallet_balance + +me.credit_limit < opt.total && <div className="err mt8">Insufficient balance. <Link href="/wallet/" className="link">Recharge wallet →</Link></div>}
                    </div>
                  )}
                </>
              )}
              {err && <div className="err mt12">{err}</div>}
              <button className="btn btn-orange btn-lg btn-block mt16" disabled={!opt || busy} onClick={confirm}>{busy ? 'Booking with Delhivery…' : 'Confirm & book shipment'}</button>
              <button className="btn btn-outline btn-block mt8" onClick={saveDraft}>Save draft</button>
            </div>
          </div>
        </>
      )}

      {step === 4 && done && (
        <div className="split-2-1" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
          <div className="card center" style={{ padding: 30 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--green-soft)', color: 'var(--green)', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}><Icon name="check" size={28} sw={3} /></div>
            <h2 style={{ fontSize: 20 }}>Shipment booked successfully</h2>
            <div className="muted small mt8">Your AWB / tracking number</div>
            <div className="mono orange" style={{ fontSize: 30, margin: '4px 0' }}>{done.awb}</div>
            <div className="tiny muted">Delhivery waybill · Order #{done.order_no}</div>
            <div className="grid4 mt16" style={{ gap: 8 }}>
              {[['Pickup', `${done.pickup_date === today() ? 'Today' : dLong(done.pickup_date).slice(4, 10)} ${done.pickup_slot}`], ['Courier', done.courier_name || (done.service === 'express' ? 'Express' : 'Surface')], ['Charged', inr(done.total, 2)], ['ETA', dLong(done.eta).slice(4, 10)]].map(([a, b]) => (
                <div key={a} className="note"><div className="tiny muted">{a}</div><b className="small">{b}</b></div>
              ))}
            </div>
            <div className="row wrap mt16" style={{ justifyContent: 'center' }}>
              <a href={`/label/?id=${done.id}`} target="_blank" className="btn btn-navy"><Icon name="download" />Download label</a>
              <button className="btn btn-outline" onClick={() => { navigator.clipboard?.writeText(trackUrl); toast('Tracking link copied'); }}>Copy tracking link</button>
              <a className="btn btn-green" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Your order #${done.order_no} is booked. Track: ${trackUrl}`)}`}>Share on WhatsApp</a>
            </div>
            <div className="row mt16" style={{ justifyContent: 'center' }}>
              <button className="link" onClick={() => { setF(EMPTY); setDone(null); setDraftId(null); setStep(1); }}>+ Book another shipment</button>
              <Link className="link-navy" href={`/shipment/?id=${done.id}`}>View details →</Link>
            </div>
          </div>
          <div><div className="b small mb8">Shipping label (4×6)</div><ShippingLabel s={done} compact /></div>
        </div>
      )}

      {pickPicker && (
        <Modal title="Choose pickup address" onClose={() => setPickPicker(false)}>
          {pickups.map((p) => (
            <div key={p.id} className={'opt' + (p.id == pickupId ? ' on' : '')} onClick={() => { setPickupId(p.id); setPickPicker(false); }}>
              <span className="radio" /><div><b>{p.name}</b><div className="tiny muted">{p.address}, {p.city} — {p.pincode}</div></div>
            </div>
          ))}
        </Modal>
      )}
    </>
  );
}

function DocUpload({ id, onChange }) {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  return (
    <div className="row wrap" style={{ gap: 8 }}>
      <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
        <Icon name="upload" size={14} />{busy ? 'Uploading…' : id ? 'Replace file' : 'Choose file'}
        <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={async (e) => {
          const file = e.target.files[0]; if (!file) return; setBusy(true);
          try { const fid = await uploadFile(file); setName(file.name); onChange(String(fid)); toast('File attached'); } catch (er) { toast(er.message, true); } finally { setBusy(false); e.target.value = ''; }
        }} />
      </label>
      {id && <span className="small green">✓ {name || 'Attached'} <button className="link-navy tiny" onClick={() => { onChange(''); setName(''); }}>Remove</button></span>}
    </div>
  );
}
