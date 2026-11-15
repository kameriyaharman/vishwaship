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

const STORE_INFO = {
  shopify: { name: 'Shopify', logo: '🛍️', help: ['In Shopify admin open Settings → Apps and sales channels → Develop apps → Create an app.', 'Configuration → Admin API scopes: read_orders, read_fulfillments, write_fulfillments (also read_merchant_managed_fulfillment_orders, write_merchant_managed_fulfillment_orders). Save → Install app.', 'Copy the Admin API access token (starts with shpat_) and paste it below.'] },
  woocommerce: { name: 'WooCommerce', logo: '🛒', help: ['In WordPress open WooCommerce → Settings → Advanced → REST API → Add key.', 'Permissions: Read/Write → Generate API key.', 'Copy the Consumer key (ck_…) and Consumer secret (cs_…) below. Your site must use https://.'] },
  custom: { name: 'Custom website / app', logo: '🌐', help: ['Generate your API key in the API Integration tab.', 'From your website, POST each new order to /me/orders (X-Api-Key header) — it appears in Drafts to book.', 'Optional: add a webhook URL to receive shipment status updates (signed with X-Vishwaship-Signature).'] },
};
const OTHER = [['Amazon (Easy Ship / Self Ship)', 'Ship Amazon self-fulfilled orders'], ['Flipkart / Meesho', 'Marketplace self-ship orders'], ['Excel / CSV', 'Bulk upload orders from a spreadsheet']];

function Channels() {
  const { data: d, reload } = useLoad(() => api('/me/channels'), []);
  const [connect, setConnect] = useState(null);
  const [req, setReq] = useState(null);
  const [msg, setMsg] = useState('');
  const items = d?.items || [];
  return (
    <>
      {items.length > 0 && (
        <div className="card mb16">
          <div className="card-h"><h3><Icon name="link" />Connected stores</h3><Link href="/integrations/?tab=oms" onClick={() => setTimeout(() => location.reload(), 50)} className="link small">View imported orders →</Link></div>
          <div className="col" style={{ gap: 8 }}>
            {items.map((c) => (
              <div key={c.id} className="row between wrap" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', gap: 10 }}>
                <span><b>{STORE_INFO[c.type]?.logo} {c.name}</b> <span className="tiny muted">· {STORE_INFO[c.type]?.name}</span>
                  <div className="tiny muted">{c.type === 'custom' ? (c.settings.webhook_url ? 'Webhook: ' + c.settings.webhook_url : 'Orders via API · no webhook set') : `${c.imported} orders imported · last sync ${c.last_sync ? dShort(c.last_sync) + ' ' + c.last_sync.slice(11, 16) : '—'}`}</div>
                  {c.last_error && <div className="tiny red">{c.last_error}</div>}</span>
                <span className="row" style={{ gap: 8 }}>
                  {c.type !== 'custom' && <label className="check tiny"><input type="checkbox" checked={!!c.settings.push_tracking} onChange={async (e) => { await api('/me/channels/' + c.id, { method: 'PUT', body: { push_tracking: e.target.checked } }); reload(); }} /> Send tracking to store</label>}
                  {c.type !== 'custom' && <AsyncBtn className="btn btn-outline btn-sm" onClick={async () => { try { const r = await api('/me/channels/' + c.id + '/sync', { method: 'POST' }); toast(r.imported ? `${r.imported} new order(s) imported to Drafts` : 'No new orders'); } catch (e) { toast(e.message, true); } reload(); }}>Sync orders</AsyncBtn>}
                  <AsyncBtn className="btn btn-outline btn-sm" confirmText={'Disconnect ' + c.name + '?'} onClick={async () => { await api('/me/channels/' + c.id, { method: 'DELETE' }); toast('Disconnected'); reload(); }}>Disconnect</AsyncBtn>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {Object.entries(STORE_INFO).map(([k, v]) => (
          <div key={k} className="card">
            <b style={{ fontSize: 16 }}>{v.logo} {v.name}</b>
            <div className="small muted mt8">{k === 'shopify' ? 'Import unfulfilled orders automatically and push AWB & tracking back to Shopify.' : k === 'woocommerce' ? 'Import processing orders and add tracking notes to WooCommerce orders.' : 'Send orders from any website or software through our API and get status webhooks.'}</div>
            <button className="btn btn-orange btn-sm mt16" onClick={() => setConnect(k)}>Connect</button>
          </div>
        ))}
        {OTHER.map(([n, dd]) => (
          <div key={n} className="card">
            <b>{n}</b><div className="small muted mt8">{dd}</div>
            {n === 'Excel / CSV' ? <Link href="/shipments/" className="btn btn-outline btn-sm mt16">Bulk upload</Link>
              : <button className="btn btn-outline btn-sm mt16" onClick={() => { setReq(n); setMsg(`Please connect my ${n} account. Seller ID / store: `); }}>Request connection</button>}
          </div>
        ))}
      </div>
      {connect && <ConnectStore type={connect} hasKey={d?.api_key} onClose={() => setConnect(null)} onDone={() => { setConnect(null); reload(); }} />}
      {req && (
        <Modal title={`Connect ${req}`} onClose={() => setReq(null)}>
          <textarea className="textarea" value={msg} onChange={(e) => setMsg(e.target.value)} />
          <AsyncBtn className="btn btn-orange mt12" onClick={async () => { await api('/me/integration-request', { method: 'POST', body: { channel: req, message: msg } }); toast('Request sent — our team will contact you'); setReq(null); }}>Send request</AsyncBtn>
        </Modal>
      )}
    </>
  );
}

function ConnectStore({ type, hasKey, onClose, onDone }) {
  const info = STORE_INFO[type];
  const [f, setF] = useState({ store_url: '', token: '', consumer_key: '', consumer_secret: '', webhook_url: '', complete_order: false });
  const [secret, setSecret] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  if (secret) return (
    <Modal title="Custom website connected" onClose={onDone}>
      <p className="small">Webhook signing secret (shown once) — verify <code>X-Vishwaship-Signature</code> = HMAC-SHA256 of the request body:</p>
      <div className="mono note" style={{ wordBreak: 'break-all' }}>{secret}</div>
      <button className="btn btn-orange mt12" onClick={onDone}>Done</button>
    </Modal>
  );
  return (
    <Modal title={'Connect ' + info.name} onClose={onClose}>
      <ol className="small" style={{ paddingLeft: 18, margin: '0 0 12px', lineHeight: 1.6 }}>{info.help.map((h) => <li key={h}>{h}</li>)}</ol>
      {type === 'shopify' && <>
        <div className="field"><label>Store domain</label><input className="input" placeholder="yourstore.myshopify.com" value={f.store_url} onChange={set('store_url')} /></div>
        <div className="field mt8"><label>Admin API access token</label><input className="input" type="password" autoComplete="new-password" placeholder="shpat_…" value={f.token} onChange={set('token')} /></div>
      </>}
      {type === 'woocommerce' && <>
        <div className="field"><label>Store URL</label><input className="input" placeholder="https://yourstore.com" value={f.store_url} onChange={set('store_url')} /></div>
        <div className="field mt8"><label>Consumer key</label><input className="input" autoComplete="off" placeholder="ck_…" value={f.consumer_key} onChange={set('consumer_key')} /></div>
        <div className="field mt8"><label>Consumer secret</label><input className="input" type="password" autoComplete="new-password" placeholder="cs_…" value={f.consumer_secret} onChange={set('consumer_secret')} /></div>
        <label className="check mt8 small"><input type="checkbox" checked={f.complete_order} onChange={set('complete_order')} /> Mark the WooCommerce order Completed after booking</label>
      </>}
      {type === 'custom' && <>
        {!hasKey && <div className="err small mb8">Generate your API key in the API Integration tab first.</div>}
        <div className="field"><label>Website name / URL</label><input className="input" placeholder="https://mysite.com" value={f.store_url} onChange={set('store_url')} /></div>
        <div className="field mt8"><label>Webhook URL for status updates (optional)</label><input className="input" placeholder="https://mysite.com/vishwaship-webhook" value={f.webhook_url} onChange={set('webhook_url')} /></div>
      </>}
      <AsyncBtn className="btn btn-orange mt16" onClick={async () => {
        try { const r = await api('/me/channels', { method: 'POST', body: { type, ...f } }); toast(type === 'custom' ? 'Connected' : `Connected · ${r.imported_now || 0} order(s) imported to Drafts`); if (r.webhook_secret) setSecret(r.webhook_secret); else onDone(); }
        catch (e) { toast(e.message, true); }
      }}>Connect {info.name}</AsyncBtn>
    </Modal>
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
            <tbody>{d.data.items.map((s) => <tr key={s.id}><td className="b">#{s.order_no}</td><td>{dShort(s.created_at)}</td><td>{s.to_name || '—'}</td><td>{s.to_pincode || '—'}</td><td>{s.payment_mode === 'cod' ? 'COD' : s.payment_mode === 'topay' ? 'To Pay' : 'Prepaid'}</td>
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
  const ep = [['POST', '/me/orders', 'Push an order from your website (lands in Drafts) — {order_id, order_ref, to_name, to_phone, to_address, to_city, to_state, to_pincode, product, invoice_value, payment_mode, cod_amount, weight, length, breadth, height}'], ['POST', '/me/quote', 'Get rates (GST-inclusive totals, courier logo) — {from, to, weight, l, b, h, payment, cod_amount, kind: b2c|b2b, box_list}'], ['POST', '/me/shipments', 'Create shipment & get AWB — {pickup_id, to_name, to_phone, to_pincode, to_city, to_state, to_address, product, invoice_value, payment_mode, cod_amount, weight, length, breadth, height, service}'],
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
