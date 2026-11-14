'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Chip, AsyncBtn, toast, PageHead, Spinner, useLoad } from '@/components/ui';
import ShippingLabel from '@/components/Label';
import { useShell } from '@/components/Shell';
import { api, uploadFile, fileUrl, qp, inr } from '@/lib/api';

const TABS = [['profile', 'My Profile'], ['kyc', 'Documents & KYC'], ['password', 'Change Password'], ['tracking', 'Branded Tracking'], ['label', 'Label Setting'], ['invoice', 'Invoice settings'],
  ['auto-assign', 'Auto-Assign Rule'], ['notifications', 'Shipping Notification'], ['cod-confirmation', 'COD Confirmation'], ['early-cod', 'Early COD']];

export default function Settings() {
  const [tab, setTab] = useState(null);
  const [welcome, setWelcome] = useState(false);
  const p = useLoad(() => api('/me/prefs'), []);
  useEffect(() => { setTab(qp('tab') || 'profile'); setWelcome(qp('welcome') === '1'); }, []);
  if (!tab) return <Spinner />;
  const go = (t) => { setTab(t); history.replaceState(null, '', '/settings/?tab=' + t); };
  const savePrefs = async (patch) => { const r = await api('/me/prefs', { method: 'PUT', body: patch }); p.setData((d) => ({ ...d, prefs: r.prefs })); toast('Saved'); };
  const props = { prefs: p.data?.prefs || {}, meta: p.data, savePrefs, reload: p.reload };
  return (
    <>
      <PageHead title="Settings" sub="Profile, KYC, label, invoice, tracking page, notifications and COD preferences" />
      {welcome && <div className="okmsg mb12">Welcome to Vishwaship! Next: complete KYC → add a warehouse → recharge wallet → book your first shipment.</div>}
      <div className="pills mb16" style={{ overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 4 }}>{TABS.map(([k, l]) => <button key={k} className={'pill' + (tab === k ? ' on' : '')} onClick={() => go(k)}>{l}</button>)}</div>
      {!p.data && !['profile', 'kyc', 'password'].includes(tab) ? <Spinner /> : (
        <>
          {tab === 'profile' && <Profile />}
          {tab === 'kyc' && <Kyc />}
          {tab === 'password' && <Password />}
          {tab === 'tracking' && <Tracking {...props} />}
          {tab === 'label' && <LabelSet {...props} />}
          {tab === 'invoice' && <InvoiceSet {...props} />}
          {tab === 'auto-assign' && <AutoAssign {...props} />}
          {tab === 'notifications' && <Notifications {...props} />}
          {tab === 'cod-confirmation' && <CodConfirm {...props} />}
          {tab === 'early-cod' && <EarlyCod {...props} />}
        </>
      )}
    </>
  );
}

function Profile() {
  const { me, refresh } = useShell();
  const [p, setP] = useState({});
  useEffect(() => { setP({ name: me.name, business_name: me.business_name || '', mobile: me.mobile || '', address: me.address || '', city: me.city || '', state: me.state || '', pincode: me.pincode || '', gstin: me.gstin || '', bank_name: me.bank_name || '', bank_account: me.bank_account || '', bank_ifsc: me.bank_ifsc || '' }); }, [me]);
  const F = (k, l) => <div className="field"><label>{l}</label><input className="input" value={p[k] || ''} onChange={(e) => setP({ ...p, [k]: e.target.value })} /></div>;
  return (
    <div className="split">
      <div className="card">
        <div className="card-h"><h3>Business profile</h3></div>
        <div className="grid2">{F('name', 'Full name')}{F('business_name', 'Business name')}{F('mobile', 'Mobile')}<div className="field"><label>Email</label><input className="input" value={me.email} disabled /></div>{F('gstin', 'GSTIN')}</div>
        <div className="card-h mt16"><h3>Business address</h3></div>
        <div className="field">{F('address', 'Address')}</div>
        <div className="grid3 mt12">{F('city', 'City')}{F('state', 'State')}{F('pincode', 'Pincode')}</div>
      </div>
      <div className="card" style={{ alignSelf: 'start' }}>
        <div className="card-h"><h3>Bank details (COD remittance)</h3></div>
        <div className="col">{F('bank_name', 'Bank name')}{F('bank_account', 'Account number')}{F('bank_ifsc', 'IFSC')}</div>
        <AsyncBtn className="btn btn-orange mt16" onClick={async () => { await api('/me/profile', { method: 'PUT', body: p }); await refresh(); toast('Profile saved'); }}>Save profile & bank</AsyncBtn>
      </div>
    </div>
  );
}

function Kyc() {
  const { me, refresh } = useShell();
  const [k, setK] = useState({ type: 'GST', number: '', doc_id: null });
  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <div className="card-h"><h3>Documents & KYC</h3><Chip s={me.kyc_status} /></div>
      {me.kyc_status === 'verified' ? <p className="small">Your KYC is verified ({me.kyc_type}{me.gstin ? ` · ${me.gstin}` : ''}{me.pan ? ` · PAN ${me.pan}` : ''}). You can book shipments.</p> : (
        <>
          {me.kyc_status === 'submitted' && <div className="note mb12">KYC submitted — our team will verify shortly.</div>}
          {me.kyc_status === 'rejected' && <div className="err mb12">KYC rejected{me.kyc_note ? `: ${me.kyc_note}` : ''}. Please re-submit.</div>}
          <div className="grid2">
            <div className="field"><label>Document</label><select className="select" value={k.type} onChange={(e) => setK({ ...k, type: e.target.value })}><option value="GST">GST certificate</option><option value="PAN">PAN card</option><option value="AADHAAR">Aadhaar</option></select></div>
            <div className="field"><label>{k.type === 'GST' ? 'GSTIN' : k.type === 'PAN' ? 'PAN number' : 'Aadhaar number'}</label><input className="input" value={k.number} onChange={(e) => setK({ ...k, number: e.target.value })} /></div>
          </div>
          <div className="field mt12"><label>Upload document (image / PDF, max 4 MB)</label><input type="file" accept="image/*,application/pdf" onChange={async (e) => { try { const id = await uploadFile(e.target.files[0]); setK({ ...k, doc_id: id }); toast('Document uploaded'); } catch (er) { toast(er.message, true); } }} /></div>
          <AsyncBtn className="btn btn-orange mt12" onClick={async () => { await api('/me/kyc', { method: 'POST', body: k }); await refresh(); toast('KYC submitted'); }}>Submit KYC</AsyncBtn>
        </>
      )}
    </div>
  );
}

function Password() {
  const [pw, setPw] = useState({ current: '', new: '', confirm: '' });
  return (
    <div className="card col" style={{ maxWidth: 480 }}>
      <h3 style={{ fontSize: 15 }}>Change password</h3>
      <input className="input" type="password" placeholder="Current password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
      <input className="input" type="password" placeholder="New password (min 6 characters)" value={pw.new} onChange={(e) => setPw({ ...pw, new: e.target.value })} />
      <input className="input" type="password" placeholder="Confirm new password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
      <AsyncBtn className="btn btn-navy" onClick={async () => { if (pw.new !== pw.confirm) throw new Error('New passwords do not match'); await api('/auth/password', { method: 'POST', body: pw }); setPw({ current: '', new: '', confirm: '' }); toast('Password changed'); }}>Update password</AsyncBtn>
    </div>
  );
}

function Toggle({ on, onChange, label, sub }) {
  return (
    <label className="row" style={{ cursor: 'pointer', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--line-2)' }}>
      <input type="checkbox" checked={!!on} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--orange)' }} />
      <span className="grow"><b className="small">{label}</b>{sub && <div className="tiny muted">{sub}</div>}</span>
    </label>
  );
}

function Tracking({ prefs, savePrefs }) {
  const { me } = useShell();
  const [t, setT] = useState({ enabled: false, name: me.business_name || me.name, color: '#f0712c', phone: me.mobile || '', email: '', website: '', message: 'Thank you for shopping with us!', logo_id: null, ...(prefs.tracking || {}) });
  return (
    <div className="split">
      <div className="card col">
        <h3 style={{ fontSize: 15 }}>Branded tracking page</h3>
        <p className="small muted" style={{ margin: 0 }}>When on, your buyers see your brand name, logo, colour and support details on the tracking page.</p>
        <Toggle on={t.enabled} onChange={(v) => setT({ ...t, enabled: v })} label="Show my branding on tracking page" />
        <div className="grid2">
          <div className="field"><label>Brand name</label><input className="input" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} /></div>
          <div className="field"><label>Brand colour</label><input className="input" type="color" value={t.color} onChange={(e) => setT({ ...t, color: e.target.value })} style={{ padding: 4 }} /></div>
          <div className="field"><label>Support phone</label><input className="input" value={t.phone} onChange={(e) => setT({ ...t, phone: e.target.value })} /></div>
          <div className="field"><label>Support email</label><input className="input" value={t.email} onChange={(e) => setT({ ...t, email: e.target.value })} /></div>
        </div>
        <div className="field"><label>Store website</label><input className="input" placeholder="https://" value={t.website} onChange={(e) => setT({ ...t, website: e.target.value })} /></div>
        <div className="field"><label>Message to buyers</label><input className="input" value={t.message} onChange={(e) => setT({ ...t, message: e.target.value })} /></div>
        <div className="field"><label>Logo (PNG / JPG)</label><input type="file" accept="image/*" onChange={async (e) => { try { const id = await uploadFile(e.target.files[0]); setT({ ...t, logo_id: id }); toast('Logo uploaded'); } catch (er) { toast(er.message, true); } }} /></div>
        <AsyncBtn onClick={() => savePrefs({ tracking: t })}>Save tracking page</AsyncBtn>
      </div>
      <div className="card" style={{ alignSelf: 'start' }}>
        <div className="small muted mb8">Preview</div>
        <div className="row" style={{ borderTop: `4px solid ${t.color}`, borderRadius: 10, padding: 14, background: '#fafaf8', gap: 12 }}>
          {t.logo_id && <img src={fileUrl(t.logo_id)} alt="" style={{ height: 40, maxWidth: 120, objectFit: 'contain' }} />}
          <div className="grow"><b>{t.name}</b><div className="tiny muted">{t.message}</div></div>
          <div className="tiny">{t.phone}</div>
        </div>
        <div className="small mt12">Buyers open: <span className="mono">/track/?awb=…</span> — share it from any shipment page.</div>
      </div>
    </div>
  );
}

const SAMPLE = { awb: '149081108213', order_no: 'VS-10482', service: 'surface', to_name: 'Sneha Patil', to_address: 'Flat 304, Green Park Society, Camp', to_city: 'Pune', to_state: 'Maharashtra', to_pincode: '411001', to_phone: '9700000045',
  from_name: 'Your Store — Warehouse 1', from_address: 'Plot 22, Sector 3', from_city: 'Delhi', from_pincode: '110034', from_phone: '9811000010', payment_mode: 'cod', cod_amount: 1450, weight: 1.2, length: 30, breadth: 20, height: 10, product: 'Cotton kurta ×2', invoice_value: 1450 };

function LabelSet({ prefs, savePrefs }) {
  const [l, setL] = useState({ size: '4x6', hide_buyer_phone: false, hide_product: false, hide_value: false, hide_seller_address: false, show_brand: true, brand_name: '', footer_note: '', ...(prefs.label || {}) });
  const set = (k) => (v) => setL({ ...l, [k]: v });
  return (
    <div className="split">
      <div className="card col">
        <h3 style={{ fontSize: 15 }}>Label setting</h3>
        <div className="field"><label>Label size</label><select className="select" value={l.size} onChange={(e) => setL({ ...l, size: e.target.value })}><option value="4x6">4 × 6 inch (thermal printer)</option><option value="a4">A4 (4 labels per page)</option></select></div>
        <Toggle on={l.show_brand} onChange={set('show_brand')} label="Show my brand name on label" sub="Replaces the Vishwaship logo" />
        {l.show_brand && <input className="input" placeholder="Brand name on label" value={l.brand_name} onChange={(e) => setL({ ...l, brand_name: e.target.value })} />}
        <Toggle on={l.hide_buyer_phone} onChange={set('hide_buyer_phone')} label="Hide buyer phone number" />
        <Toggle on={l.hide_product} onChange={set('hide_product')} label="Hide product / contents" />
        <Toggle on={l.hide_value} onChange={set('hide_value')} label="Hide invoice value" />
        <Toggle on={l.hide_seller_address} onChange={set('hide_seller_address')} label="Hide my pickup address (show return name only)" />
        <div className="field"><label>Footer note on label</label><input className="input" placeholder="e.g. Do not accept if seal is broken" value={l.footer_note} onChange={(e) => setL({ ...l, footer_note: e.target.value })} /></div>
        <AsyncBtn onClick={() => savePrefs({ label: l })}>Save label setting</AsyncBtn>
      </div>
      <div style={{ alignSelf: 'start' }}><div className="small muted mb8">Preview</div><ShippingLabel s={SAMPLE} prefs={l} compact /></div>
    </div>
  );
}

function InvoiceSet({ prefs, savePrefs }) {
  const { me } = useShell();
  const [v, setV] = useState({ legal_name: me.business_name || me.name, gstin: me.gstin || '', address: [me.address, me.city, me.state, me.pincode].filter(Boolean).join(', '), prefix: 'INV-', terms: 'Goods once sold will not be taken back.', signatory: me.name, hsn: '', show_on_package: false, ...(prefs.invoice || {}) });
  const F = (k, l, ph) => <div className="field"><label>{l}</label><input className="input" placeholder={ph} value={v[k] || ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></div>;
  return (
    <div className="card col" style={{ maxWidth: 720 }}>
      <h3 style={{ fontSize: 15 }}>Invoice settings (invoice to your buyer)</h3>
      <p className="small muted" style={{ margin: 0 }}>Used for the buyer invoice you can print from any shipment (Shipment details → Buyer invoice).</p>
      <div className="grid2">{F('legal_name', 'Legal business name')}{F('gstin', 'GSTIN')}{F('prefix', 'Invoice number prefix', 'INV-')}{F('hsn', 'Default HSN code', 'e.g. 6204')}{F('signatory', 'Authorised signatory')}</div>
      {F('address', 'Registered address')}{F('terms', 'Terms printed on invoice')}
      <Toggle on={v.show_on_package} onChange={(x) => setV({ ...v, show_on_package: x })} label="Print buyer invoice with every label" />
      <AsyncBtn onClick={() => savePrefs({ invoice: v })}>Save invoice settings</AsyncBtn>
    </div>
  );
}

function AutoAssign({ prefs, savePrefs }) {
  const [a, setA] = useState({ default: 'cheapest', cod: '', heavy_kg: 5, heavy: '', ...(prefs.auto_assign || {}) });
  const opts = [['cheapest', 'Cheapest available'], ['fastest', 'Fastest available'], ['surface', 'Always Surface'], ['express', 'Always Express']];
  return (
    <div className="card col" style={{ maxWidth: 640 }}>
      <h3 style={{ fontSize: 15 }}>Auto-assign rule</h3>
      <p className="small muted" style={{ margin: 0 }}>The service selected automatically when you book or upload in bulk. You can still change it before confirming.</p>
      <div className="field"><label>Default</label><select className="select" value={a.default} onChange={(e) => setA({ ...a, default: e.target.value })}>{opts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <div className="field"><label>For COD orders</label><select className="select" value={a.cod} onChange={(e) => setA({ ...a, cod: e.target.value })}><option value="">Same as default</option>{opts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <div className="grid2">
        <div className="field"><label>Heavy parcel above (kg)</label><input className="input" type="number" value={a.heavy_kg} onChange={(e) => setA({ ...a, heavy_kg: e.target.value })} /></div>
        <div className="field"><label>…use</label><select className="select" value={a.heavy} onChange={(e) => setA({ ...a, heavy: e.target.value })}><option value="">Same as default</option>{opts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      </div>
      <AsyncBtn onClick={() => savePrefs({ auto_assign: a })}>Save rule</AsyncBtn>
    </div>
  );
}

function Notifications({ prefs, meta, savePrefs }) {
  const EV = [['booked', 'Order booked (with tracking link)'], ['picked_up', 'Picked up'], ['out_for_delivery', 'Out for delivery'], ['delivered', 'Delivered'], ['ndr', 'Delivery attempt failed'], ['rto', 'Returned to origin']];
  const [n, setN] = useState({ whatsapp: false, sms: false, email: true, events: { booked: true, out_for_delivery: true, delivered: true }, ...(prefs.notifications || {}) });
  return (
    <div className="split">
      <div className="card col">
        <h3 style={{ fontSize: 15 }}>Shipping notifications to your buyers</h3>
        <div className="lbl">Channels</div>
        <Toggle on={n.whatsapp} onChange={(v) => setN({ ...n, whatsapp: v })} label="WhatsApp" sub="1 credit per message" />
        <Toggle on={n.sms} onChange={(v) => setN({ ...n, sms: v })} label="SMS" sub="1 credit per message" />
        <Toggle on={n.email} onChange={(v) => setN({ ...n, email: v })} label="Email" sub="Free (when buyer email is available)" />
        <div className="lbl mt8">Send update when</div>
        {EV.map(([k, l]) => <Toggle key={k} on={n.events?.[k]} onChange={(v) => setN({ ...n, events: { ...n.events, [k]: v } })} label={l} />)}
        <AsyncBtn onClick={() => savePrefs({ notifications: n })}>Save notification settings</AsyncBtn>
      </div>
      <div className="card" style={{ alignSelf: 'start' }}>
        <div className="kv"><span>Notification credits</span><b>{meta?.notif_credits ?? 0}</b></div>
        <div className="kv"><span>Sending status</span><b>{meta?.provider ? <span className="green">Live</span> : <span className="orange">Not live yet</span>}</b></div>
        {!meta?.provider && <p className="small muted">Vishwaship is setting up SMS / WhatsApp sending. Your choices are saved and will start working automatically once it is live.</p>}
        <Link href="/billing/?view=notif" className="btn btn-outline btn-sm mt8">Buy credits / history</Link>
      </div>
    </div>
  );
}

function CodConfirm({ prefs, meta, savePrefs }) {
  const [c, setC] = useState({ enabled: false, cancel_unconfirmed_hours: 24, ...(prefs.cod_confirmation || {}) });
  return (
    <div className="card col" style={{ maxWidth: 640 }}>
      <h3 style={{ fontSize: 15 }}>COD order confirmation</h3>
      <p className="small muted" style={{ margin: 0 }}>Before shipping a COD order, the buyer gets a WhatsApp message to confirm or cancel — this cuts fake orders and RTO.</p>
      <Toggle on={c.enabled} onChange={(v) => setC({ ...c, enabled: v })} label="Ask buyers to confirm COD orders" />
      <div className="field"><label>If not confirmed within (hours)</label><input className="input" type="number" value={c.cancel_unconfirmed_hours} onChange={(e) => setC({ ...c, cancel_unconfirmed_hours: e.target.value })} /></div>
      {!meta?.cod_confirm_available && <div className="note">COD confirmation via WhatsApp is not live yet on Vishwaship. Your setting is saved and will apply once it is enabled.</div>}
      <AsyncBtn onClick={() => savePrefs({ cod_confirmation: c })}>Save</AsyncBtn>
    </div>
  );
}

function EarlyCod({ meta, reload }) {
  const { refresh } = useShell();
  if (!meta) return <Spinner />;
  return (
    <div className="card col" style={{ maxWidth: 640 }}>
      <div className="row between"><h3 style={{ fontSize: 15 }}>Early COD subscription</h3>{meta.early_cod ? <span className="chip c-active">Active</span> : <span className="chip c-pending">Not subscribed</span>}</div>
      <p className="small">Get your COD money faster: <b>{meta.early_cod_cycle}</b> instead of the standard weekly cycle.</p>
      <div className="kv"><span>Fee</span><b>{meta.early_cod_fee_pct}% of COD amount (deducted at remittance)</b></div>
      <div className="kv"><span>Example</span><b>COD {inr(10000)} → you receive {inr(10000 * (1 - meta.early_cod_fee_pct / 100))}</b></div>
      <div className="kv"><span>Your current cycle</span><b>{meta.cod_cycle}</b></div>
      <AsyncBtn className={meta.early_cod ? 'btn btn-outline' : 'btn btn-orange'} confirmText={meta.early_cod ? 'Cancel Early COD and go back to weekly remittance?' : `Subscribe to Early COD at ${meta.early_cod_fee_pct}% fee?`}
        onClick={async () => { await api('/me/early-cod', { method: 'POST', body: { enable: !meta.early_cod } }); await reload(); await refresh(); toast(meta.early_cod ? 'Early COD cancelled' : 'Early COD activated'); }}>{meta.early_cod ? 'Cancel subscription' : 'Subscribe to Early COD'}</AsyncBtn>
    </div>
  );
}
