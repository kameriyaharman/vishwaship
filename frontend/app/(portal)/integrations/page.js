'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { Spinner, AsyncBtn, toast, useLoad, PageHead, Modal } from '@/components/ui';
import { api, API, qp, dShort } from '@/lib/api';

const TABS = [['channels', 'Order Channels'], ['oms', 'OMS'], ['edd', 'EDD Widget'], ['api', 'API Integration']];
const CHANNELS = [['Shopify', 'Import Shopify orders and push AWB & tracking back'], ['WooCommerce', 'WordPress / WooCommerce store orders'], ['Amazon (Easy Ship / Self Ship)', 'Ship Amazon self-fulfilled orders'], ['Flipkart / Meesho', 'Marketplace self-ship orders'], ['Custom website', 'Use the API or CSV upload'], ['Excel / CSV', 'Bulk upload orders from a spreadsheet']];

export default function Integrations() {
  const [tab, setTab] = useState(null);
  useEffect(() => setTab(qp('tab') || 'channels'), []);
  if (!tab) return <Spinner />;
  const go = (t) => { setTab(t); history.replaceState(null, '', '/integrations/?tab=' + t); };
  return (
    <>
      <PageHead title="Integrations" sub="Connect your store, manage orders, add delivery-date widget and use the API" />
      <div className="seg mb16" style={{ overflowX: 'auto', maxWidth: '100%' }}>{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => go(k)}>{l}</button>)}</div>
      {tab === 'channels' && <Channels />}
      {tab === 'oms' && <Oms />}
      {tab === 'edd' && <Edd />}
      {tab === 'api' && <ApiTab />}
    </>
  );
}

function Channels() {
  const [req, setReq] = useState(null);
  const [msg, setMsg] = useState('');
  return (
    <>
      <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {CHANNELS.map(([n, d]) => (
          <div key={n} className="card">
            <b>{n}</b><div className="small muted mt8">{d}</div>
            {n === 'Excel / CSV' ? <Link href="/shipments/" className="btn btn-outline btn-sm mt16">Bulk upload</Link>
              : n === 'Custom website' ? <Link href="/integrations/?tab=api" onClick={() => location.reload()} className="btn btn-outline btn-sm mt16">Get API key</Link>
                : <button className="btn btn-orange btn-sm mt16" onClick={() => { setReq(n); setMsg(`Please connect my ${n} store. Store URL: `); }}>Request connection</button>}
          </div>
        ))}
      </div>
      <p className="small muted mt12">Store connections are set up by the Vishwaship team — send a request and we’ll contact you to link your store.</p>
      {req && (
        <Modal title={`Connect ${req}`} onClose={() => setReq(null)}>
          <textarea className="textarea" value={msg} onChange={(e) => setMsg(e.target.value)} />
          <AsyncBtn className="btn btn-orange mt12" onClick={async () => { await api('/me/integration-request', { method: 'POST', body: { channel: req, message: msg } }); toast('Request sent — our team will contact you'); setReq(null); }}>Send request</AsyncBtn>
        </Modal>
      )}
    </>
  );
}

function Oms() {
  const d = useLoad(() => api('/me/drafts'), []);
  return (
    <>
      <div className="row between mb12 wrap"><p className="small muted" style={{ margin: 0 }}>Orders saved but not yet shipped (drafts, imported orders). Review and book them here.</p>
        <span className="row"><Link href="/book/" className="btn btn-orange btn-sm">+ New order</Link><Link href="/shipments/" className="btn btn-outline btn-sm">Bulk upload</Link></span></div>
      <div className="card p0 tbl-wrap">
        {!d.data ? <Spinner /> : (
          <table className="tbl"><thead><tr><th>Order</th><th>Created</th><th>Receiver</th><th>Pincode</th><th>Mode</th><th /></tr></thead>
            <tbody>{d.data.items.map((s) => <tr key={s.id}><td className="b">#{s.order_no}</td><td>{dShort(s.created_at)}</td><td>{s.to_name || '—'}</td><td>{s.to_pincode || '—'}</td><td>{s.payment_mode === 'cod' ? 'COD' : 'Prepaid'}</td>
              <td className="right"><Link className="btn btn-orange btn-sm" href={'/book/?draft=' + s.id}>Ship now</Link> <AsyncBtn className="link-navy small" onClick={async () => { await api('/me/drafts/' + s.id, { method: 'DELETE' }); d.reload(); }}>Delete</AsyncBtn></td></tr>)}
              {!d.data.items.length && <tr><td colSpan={6} className="empty">No pending orders. Use “Save draft” while booking to keep orders here.</td></tr>}</tbody></table>
        )}
      </div>
    </>
  );
}

function Edd() {
  const [pin, setPin] = useState('110034');
  const origin = typeof window !== 'undefined' ? location.origin : '';
  const apiBase = API.startsWith('http') ? API : origin + API;
  const code = `<div id="vishwaship-edd" data-from="${pin}"></div>\n<script src="${origin}/edd-widget.js" data-api="${apiBase}" async></script>`;
  return (
    <div className="split">
      <div className="card col">
        <h3 style={{ fontSize: 15 }}>Estimated Delivery Date widget</h3>
        <p className="small muted" style={{ margin: 0 }}>Show “Delivery by &lt;date&gt;” on your product page. Buyers enter their pincode and see the delivery date and COD availability.</p>
        <div className="field"><label>Your pickup pincode</label><input className="input" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value)} /></div>
        <div className="field"><label>Paste this code on your website</label><textarea className="textarea" readOnly value={code} style={{ fontFamily: 'var(--mono)', fontSize: 12, minHeight: 110 }} /></div>
        <button className="btn btn-outline" onClick={() => { navigator.clipboard?.writeText(code); toast('Code copied'); }}><Icon name="copy" />Copy code</button>
      </div>
      <div className="card"><h3 style={{ fontSize: 15 }} className="mb12">Live preview</h3><EddPreview from={pin} apiBase={apiBase} /></div>
    </div>
  );
}

function EddPreview({ from, apiBase }) {
  const [to, setTo] = useState('');
  const [r, setR] = useState(null);
  return (
    <div style={{ border: '1px dashed var(--line)', borderRadius: 12, padding: 16 }}>
      <div className="small b mb8">Check delivery date</div>
      <div className="row"><input className="input" placeholder="Enter pincode" maxLength={6} value={to} onChange={(e) => setTo(e.target.value)} />
        <button className="btn btn-navy" onClick={async () => { try { setR(await (await fetch(`${apiBase}/public/edd?from=${from}&to=${to}`)).json()); } catch { setR({ error: 'Could not check' }); } }}>Check</button></div>
      {r && <div className="small mt8">{r.error ? <span className="red">{r.error}</span> : r.serviceable ? <><b className="green">{r.label}</b>{r.cod ? ' · COD available' : ' · Prepaid only'}</> : <span className="red">{r.message}</span>}</div>}
    </div>
  );
}

function ApiTab() {
  const k = useLoad(() => api('/me/api-key'), []);
  const [key, setKey] = useState('');
  const base = API.startsWith('http') ? API : (typeof window !== 'undefined' ? location.origin : '') + API;
  const ep = [['POST', '/me/quote', 'Get rates — {from, to, weight, l, b, h, payment, cod_amount}'], ['POST', '/me/shipments', 'Create shipment & get AWB — {pickup_id, to_name, to_phone, to_pincode, to_city, to_state, to_address, product, invoice_value, payment_mode, cod_amount, weight, length, breadth, height, service}'],
    ['GET', '/me/shipments?q=AWB', 'Search / list shipments'], ['GET', '/me/shipments/{id}', 'Shipment details with tracking history'], ['POST', '/me/shipments/{id}/cancel', 'Cancel before pickup (refund to wallet)'],
    ['GET', '/me/pickups', 'Your warehouses (pickup_id)'], ['GET', '/public/track/{awb}', 'Public tracking (no key needed)'], ['GET', '/public/edd?from=&to=', 'Estimated delivery date (no key needed)']];
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="card">
        <div className="card-h"><h3><Icon name="key" style={{ color: 'var(--orange)' }} />API key</h3>{k.data?.has_key && <span className="chip c-active">Active</span>}</div>
        {key ? <><div className="note"><b>Copy this key now — it will not be shown again.</b><div className="mono mt8" style={{ wordBreak: 'break-all' }}>{key}</div></div><button className="btn btn-outline btn-sm mt8" onClick={() => { navigator.clipboard?.writeText(key); toast('Copied'); }}>Copy</button></>
          : <p className="small muted">{k.data?.has_key ? 'You have an active key. Generating a new key stops the old one.' : 'Generate a key to create shipments from your website or software.'}</p>}
        <div className="row mt12">
          <AsyncBtn confirmText={k.data?.has_key ? 'Generate a new key? The old key will stop working.' : undefined} onClick={async () => { const r = await api('/me/api-key', { method: 'POST' }); setKey(r.key); k.reload(); }}>{k.data?.has_key ? 'Regenerate key' : 'Generate API key'}</AsyncBtn>
          {k.data?.has_key && <AsyncBtn className="btn btn-outline" confirmText="Revoke API key?" onClick={async () => { await api('/me/api-key', { method: 'DELETE' }); setKey(''); k.reload(); }}>Revoke</AsyncBtn>}
        </div>
      </div>
      <div className="card">
        <div className="card-h"><h3>Quick reference</h3></div>
        <p className="small">Base URL: <span className="mono">{base}</span> · Send header <span className="mono">X-Api-Key: &lt;your key&gt;</span> and JSON body. Charges are deducted from your wallet.</p>
        <div className="tbl-wrap"><table className="tbl"><tbody>{ep.map(([m, p, d]) => <tr key={p}><td><span className={'chip c-' + (m === 'GET' ? 'in_transit' : 'delivered')}>{m}</span></td><td className="mono" style={{ fontSize: 12 }}>{p}</td><td className="small">{d}</td></tr>)}</tbody></table></div>
        <pre style={{ background: '#0b1f3a', color: '#e6ebf3', padding: 14, borderRadius: 10, fontSize: 12, overflowX: 'auto', marginTop: 12 }}>{`curl -X POST ${base}/me/quote \\
  -H "X-Api-Key: vs_live_xxx" -H "Content-Type: application/json" \\
  -d '{"from":"110034","to":"411001","weight":1.2,"payment":"prepaid"}'`}</pre>
      </div>
    </div>
  );
}
