'use client';
import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { Chip, Spinner, ErrorBox, Modal, AsyncBtn, toast, useLoad, PageHead } from '@/components/ui';
import { api, API, dTime, uploadFile, fileUrl } from '@/lib/api';

const APIS = [['Pincode serviceability', 'before booking'], ['Shipping cost (base rate)', 'rate shown'], ['Create shipment / AWB', 'on confirm'], ['Label / packing slip', 'PDF'], ['Pickup request', 'on booking'], ['Tracking status', 'sync + webhook'], ['Cancel shipment', 'before pickup'], ['NDR action', 're-attempt / RTO']];

export default function Delhivery() {
  const { data: d, err, reload } = useLoad(() => api('/admin/delhivery'), []);
  const [f, setF] = useState({});
  const [log, setLog] = useState(null);
  useEffect(() => { if (d) setF({ mode: d.mode, env: d.env, client: d.client, default_service: d.default_service, token: '' }); }, [d]);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!d) return <Spinner />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const webhook = (API.startsWith('http') ? API : (typeof window !== 'undefined' ? location.origin : '') + API) + '/delhivery/webhook';
  const save = async () => { const b = { ...f }; if (!b.token) delete b.token; await api('/admin/delhivery', { method: 'PUT', body: b }); toast('Saved'); reload(); };

  return (
    <>
      <PageHead title="Courier API Integrations" sub="Shipmozo, Delhivery Cargo (B2B), Delhivery and any carrier you add — keys are entered here. Customers see the API price + your commission.">
        <AsyncBtn className="btn btn-outline" onClick={async () => { await save(); const r = await api('/admin/delhivery/test', { method: 'POST' }); toast(r.message, !r.ok); reload(); }}>Test Delhivery</AsyncBtn>
        <AsyncBtn onClick={save}>Save Delhivery</AsyncBtn>
      </PageHead>
 <Carriers />
 <Shipmozo />
 <DelhiveryB2B />
      <h2 className="mt24 mb12" style={{ fontSize: 18 }}>Delhivery (direct)</h2>
      {d.mode !== 'live' && <div className="note mb12" style={{ background: 'var(--yellow-soft)', color: '#6a5200' }}><b>Simulation mode is ON.</b> Bookings get a generated AWB and use your rate card; update statuses from each shipment page. Add your Delhivery API token, choose <b>Live</b> and Save to go live.</div>}
      <div className="split-3">
        <div className="card">
          <div className="card-h"><h3><Icon name="link" style={{ color: 'var(--orange)' }} />Account connection</h3><Chip s={d.connected ? 'connected' : 'pending'} label={d.connected ? 'Connected' : 'Not live'} /></div>
          <div className="col">
            <div className="field"><label>Mode</label><select className="select" value={f.mode} onChange={set('mode')}><option value="simulation">Simulation (testing)</option><option value="live">Live — use Delhivery API</option></select></div>
            <div className="field"><label>Environment</label><select className="select" value={f.env} onChange={set('env')}><option value="staging">Staging (test)</option><option value="production">Production</option></select></div>
            <div className="field"><label>API token</label><input className="input" type="password" placeholder={d.token_masked || 'Paste your Delhivery API token'} value={f.token} onChange={set('token')} />
              {d.has_token && <button className="link-navy tiny" onClick={async () => { await api('/admin/delhivery', { method: 'PUT', body: { clear_token: true, mode: 'simulation' } }); reload(); }}>Remove token</button>}</div>
            <div className="field"><label>Client name (as per Delhivery)</label><input className="input" value={f.client} onChange={set('client')} /></div>
            <div className="field"><label>Default service</label><select className="select" value={f.default_service} onChange={set('default_service')}><option value="surface">Surface · Express on request</option><option value="express">Express</option></select></div>
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h3><Icon name="pin" style={{ color: 'var(--orange)' }} />Pickup locations (warehouses)</h3></div>
          <div style={{ maxHeight: 290, overflowY: 'auto' }}>
            {d.pickups.map((p) => (
              <div key={p.id} className="kv"><span>{p.delhivery_name || p.name}<div className="tiny muted">{p.customer} · {p.pincode}</div></span>
                <span className="row" style={{ gap: 6 }}><b className={p.delhivery_status === 'registered' ? 'green' : p.delhivery_status === 'failed' ? 'red' : ''}>{p.delhivery_status === 'registered' ? 'Registered ✓' : p.delhivery_status === 'failed' ? 'Failed' : 'Pending'}</b>
                  {p.delhivery_status !== 'registered' && <AsyncBtn className="link small" onClick={async () => { await api('/admin/pickups/' + p.id, { method: 'POST', body: { action: 'register' } }); reload(); }}>Register</AsyncBtn>}</span></div>
            ))}
          </div>
          <p className="tiny muted mt8">Customer pickup addresses are auto-registered on Delhivery via the warehouse API.</p>
          <div className="field mt12"><label>Status webhook URL (give this to Delhivery)</label><div className="row"><input className="input" readOnly value={webhook} /><button className="btn btn-outline btn-sm" onClick={() => { navigator.clipboard?.writeText(webhook); toast('Copied'); }}><Icon name="copy" size={14} /></button></div></div>
        </div>
        <div className="card">
          <div className="card-h"><h3>APIs in use</h3></div>
          {APIS.map(([a, b]) => <div key={a} className="kv"><span className="row" style={{ color: 'var(--text)', gap: 6 }}><Icon name="check" size={14} style={{ color: 'var(--green)' }} />{a}</span><span className="tiny muted" style={{ fontWeight: 400 }}>{b}</span></div>)}
        </div>
      </div>
      <div className="card p0 mt16">
        <div className="card-h" style={{ padding: '16px 18px 0' }}><h3>API logs</h3><span className="small muted">last 24 h · {d.calls_24h} calls · {d.failed_24h} failed</span></div>
        <div className="tbl-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}><table className="tbl">
          <thead><tr><th>Time</th><th>API</th><th>Request</th><th>Result</th></tr></thead>
          <tbody>{d.logs.map((l) => <tr key={l.id} className="click" onClick={async () => setLog(await api('/admin/logs/' + l.id))}><td>{dTime(l.created_at)}</td><td>{l.api}</td><td>{l.request}</td><td><Chip s={l.result} label={l.result === 'success' ? 'Success' : 'Failed'} /></td></tr>)}
            {!d.logs.length && <tr><td colSpan={4} className="empty">No API calls yet.</td></tr>}</tbody>
        </table></div>
      </div>
      {log && <Modal title={log.api} onClose={() => setLog(null)} wide><div className="small mb8">{log.request} · {dTime(log.created_at)}</div><pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#f5f6fa', padding: 12, borderRadius: 8, maxHeight: 400, overflow: 'auto' }}>{log.response || '(no response body)'}</pre></Modal>}
    </>
  );
}

function Shipmozo() {
  const { data: d, err, reload } = useLoad(() => api('/admin/shipmozo'), []);
  const [f, setF] = useState(null);
  const [wh, setWh] = useState([]);
  const [prev, setPrev] = useState(null);
  useEffect(() => { if (d) setF({ enabled: d.enabled, public_key: d.public_key, private_key: '', base: d.base, warehouse_id: d.warehouse_id, package_type: d.package_type, b2b_package_type: d.b2b_package_type, rov_type: d.rov_type, max_options: d.max_options, schedule_pickup: d.schedule_pickup, delhivery_enabled: d.delhivery_enabled }); }, [d]);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!f) return <Spinner />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = async () => { const b = { ...f }; if (!b.private_key) delete b.private_key; await api('/admin/shipmozo', { method: 'PUT', body: b }); reload(); };
  return (
    <div className="card mb16" style={{ border: '2px solid var(--orange)' }}>
      <div className="card-h"><h3><Icon name="plug" style={{ color: 'var(--orange)' }} />Shipmozo (multi-courier)</h3><Chip s={d.live ? 'connected' : 'pending'} label={d.live ? 'Live' : 'Off'} /></div>
      <div className="split">
        <div className="col">
          <label className="check"><input type="checkbox" checked={f.enabled} onChange={set('enabled')} /> <b>Use Shipmozo couriers in booking</b></label>
          <label className="check"><input type="checkbox" checked={f.delhivery_enabled} onChange={set('delhivery_enabled')} /> Also show direct Delhivery options</label>
          <div className="field"><label>Public key</label><input className="input" value={f.public_key} onChange={set('public_key')} placeholder="From Shipmozo panel → Profile → API keys" /></div>
          <div className="field"><label>Private key</label><input className="input" type="password" value={f.private_key} onChange={set('private_key')} placeholder={d.private_masked || 'Paste private key'} /></div>
          <div className="grid2">
            <div className="field"><label>Fallback warehouse ID</label><input className="input" value={f.warehouse_id} onChange={set('warehouse_id')} /></div>
            <div className="field"><label>Courier options to show</label><input className="input" type="number" min="1" max="10" value={f.max_options} onChange={set('max_options')} /></div>
          </div>
          {wh.length > 0 && <div className="note">Warehouses: {wh.map((w) => <button key={w.id} className="link small" style={{ marginRight: 10 }} onClick={() => setF({ ...f, warehouse_id: w.id })}>{w.id} · {w.name} {w.pincode}</button>)}</div>}
        </div>
        <div className="col">
          <div className="field"><label>API base URL</label><input className="input" value={f.base} onChange={set('base')} /></div>
          <div className="grid2">
            <div className="field"><label>Package type (B2C)</label><input className="input" value={f.package_type} onChange={set('package_type')} /></div>
            <div className="field"><label>Package type (B2B)</label><input className="input" value={f.b2b_package_type || ''} onChange={set('b2b_package_type')} placeholder="B2B" /></div>
            <div className="field"><label>ROV type</label><input className="input" value={f.rov_type} onChange={set('rov_type')} /></div>
          </div>
          <div className="field"><label>Schedule pickup after booking</label><select className="select" value={f.schedule_pickup} onChange={set('schedule_pickup')}><option value="auto">Yes (call schedule-pickup)</option><option value="never">No (courier auto-schedules)</option></select></div>
          <div className="row wrap mt8">
            <AsyncBtn onClick={async () => { await save(); toast('Shipmozo settings saved'); }}>Save</AsyncBtn>
            <AsyncBtn className="btn btn-outline" onClick={async () => { await save(); const r = await api('/admin/shipmozo/test', { method: 'POST' }); toast(r.message, !r.ok); if (r.warehouses) setWh(r.warehouses); }}>Test connection</AsyncBtn>
            <AsyncBtn className="btn btn-outline" onClick={async () => { await save(); setPrev(await api('/admin/quote-preview', { method: 'POST', body: { from: '110034', to: '411001', weight: 1, l: 20, b: 15, h: 10 } })); }}>Preview rates</AsyncBtn>
          </div>
          {prev && <div className="note">Delhi 110034 → Pune 411001, 1 kg (global commission {prev.markup}%):{prev.options.map((o) => <div key={o.service} className="row between small"><span>{o.name} <span className="muted">({o.provider})</span></span><span>API ₹{o.base} → <b>₹{o.freight}</b></span></div>)}{!prev.options.some((o) => o.provider === 'shipmozo') && <div className="small red mt8">No Shipmozo rates returned — check API logs below.</div>}</div>}
        </div>
      </div>
      <p className="tiny muted mt12">Each customer pickup address is registered on Shipmozo automatically (create-warehouse); the fallback ID is used only if that fails. Booking flow: rate-calculator → push-order → assign-courier (AWB) → schedule-pickup. Status sync via track-order. Every call appears in API logs below.</p>
    </div>
  );
}

function DelhiveryB2B() {
  const { data: d, err, reload } = useLoad(() => api('/admin/dlvb2b'), []);
  const [f, setF] = useState(null);
  const [prev, setPrev] = useState(null);
  useEffect(() => { if (d) setF({ enabled: d.enabled, username: d.username, password: '', base: d.base, min_kg: d.min_kg, freight_mode: d.freight_mode, rov: d.rov }); }, [d]);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!f) return <Spinner />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = async () => { const b = { ...f }; if (!b.password) delete b.password; await api('/admin/dlvb2b', { method: 'PUT', body: b }); reload(); };
  return (
    <div className="card mb16" style={{ border: '2px solid var(--navy)' }}>
      <div className="card-h"><h3><Icon name="truck" />Delhivery Cargo — B2B / heavy cargo (LTL)</h3><Chip s={d.live ? 'connected' : 'pending'} label={d.live ? 'Live' : 'Off'} /></div>
      <div className="split">
        <div className="col">
          <label className="check"><input type="checkbox" checked={f.enabled} onChange={set('enabled')} /> <b>Show Delhivery Cargo (B2B) in booking</b></label>
          <div className="field"><label>B2B API username</label><input className="input" value={f.username} onChange={set('username')} placeholder="e.g. VISHWASHIPB2B (from Delhivery SPOC)" autoComplete="off" /></div>
          <div className="field"><label>B2B API password</label><input className="input" type="password" value={f.password} onChange={set('password')} placeholder={d.has_password ? d.password_masked + ' (saved)' : 'API user password'} autoComplete="new-password" /></div>
          <div className="grid2">
            <div className="field"><label>Show from weight (kg)</label><input className="input" type="number" min="0" step="1" value={f.min_kg} onChange={set('min_kg')} /></div>
            <div className="field"><label>Freight mode</label><select className="select" value={f.freight_mode} onChange={set('freight_mode')}><option value="fop">FOP — bill to Vishwaship</option><option value="fod">FOD — consignee pays freight</option></select></div>
          </div>
          <label className="check"><input type="checkbox" checked={f.rov} onChange={set('rov')} /> Add Delhivery risk cover (ROV insurance)</label>
        </div>
        <div className="col">
          <div className="field"><label>API base URL</label><input className="input" value={f.base} onChange={set('base')} /><div className="tiny muted mt8">Live: https://ltl-clients-api.delhivery.com · Staging: https://ltl-clients-api-dev.delhivery.com</div></div>
          {!d.company_gstin && <div className="err small">Company GSTIN is empty — Delhivery B2B bills freight to your company. Add it in Website Content → General.</div>}
          <div className="row wrap mt8">
            <AsyncBtn onClick={async () => { await save(); toast('Delhivery B2B settings saved'); }}>Save</AsyncBtn>
            <AsyncBtn className="btn btn-outline" onClick={async () => { await save(); const r = await api('/admin/dlvb2b/test', { method: 'POST' }); toast(r.message, !r.ok); }}>Test login</AsyncBtn>
            <AsyncBtn className="btn btn-outline" onClick={async () => { await save(); setPrev(await api('/admin/quote-preview', { method: 'POST', body: { from: '110034', to: '411001', weight: Math.max(+f.min_kg || 10, 20), l: 60, b: 40, h: 40 } })); }}>Preview rates</AsyncBtn>
          </div>
          {prev && <div className="note">Delhi 110034 → Pune 411001, {Math.max(+f.min_kg || 10, 20)} kg:{prev.options.filter((o) => o.provider === 'dlvb2b').map((o) => <div key={o.service} className="row between small"><span>{o.name}</span><span>API ₹{o.base} → <b>₹{o.freight}</b></span></div>)}{!prev.options.some((o) => o.provider === 'dlvb2b') && <div className="small red mt8">No B2B rate returned — check API logs below.</div>}</div>}
        </div>
      </div>
      <p className="tiny muted mt12">Flow: login (JWT) → pincode-service → freight/estimate → client-warehouse/create (once per customer pickup address) → manifest (LR number) → pickup request → LR label (PDF) → lrn/track → lrn/cancel. {d.shipments} B2B shipment(s) so far.</p>
    </div>
  );
}

const CARRIER_PRESETS = ['DTDC', 'DHL', 'TCI Express', 'FedEx', 'Blue Dart', 'Xpressbees', 'Ekart', 'Ecom Express', 'Shadowfax', 'Gati', 'India Post', 'Aramex', 'Other'];
const AUTH_FIELDS = {
  api_key: ['API key'],
  key_secret: ['API key', 'API secret'],
  user_pass: ['Username', 'Password', 'Customer / account code'],
  token: ['Access token'],
  oauth: ['Client ID', 'Client secret', 'Account number'],
};
const CSTATUS = { pending: ['pending', 'Details saved'], credentials_saved: ['connected', 'API reachable'], live: ['connected', 'Live'], paused: ['cancelled', 'Paused'] };

function Carriers() {
  const { data: d, reload } = useLoad(() => api('/admin/carriers'), []);
  const [edit, setEdit] = useState(null);
  const items = d?.items || [];
  return (
    <div className="card mb16">
      <div className="card-h"><h3><Icon name="truck" />Carrier partners</h3><button className="btn btn-orange btn-sm" onClick={() => setEdit({})}><Icon name="plus" size={14} /> Add carrier</button></div>
      {!items.length ? <p className="small muted">Add DTDC, DHL, TCI, FedEx or any new partner — save their API details and contacts here. Shipmozo, Delhivery and Delhivery Cargo are already connected below.</p> : (
        <div className="col" style={{ gap: 8 }}>
          {items.map((c) => (
            <div key={c.id} className="row between" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px', gap: 10, flexWrap: 'wrap' }}>
              <span className="row" style={{ gap: 10, minWidth: 0 }}>
                {c.logo_file_id ? <img src={fileUrl(c.logo_file_id)} alt="" style={{ width: 54, height: 30, objectFit: 'contain' }} /> : <Icon name="truck" size={22} />}
                <span style={{ minWidth: 0 }}><b>{c.name}</b><div className="tiny muted">{c.api_base || 'No API URL yet'}{c.services ? ' · ' + c.services : ''}</div>{c.last_test && <div className="tiny muted">{c.last_test}</div>}</span>
              </span>
              <span className="row" style={{ gap: 8 }}>
                <Chip s={(CSTATUS[c.status] || CSTATUS.pending)[0]} label={(CSTATUS[c.status] || CSTATUS.pending)[1]} />
                <AsyncBtn className="btn btn-outline btn-sm" onClick={async () => { try { const r = await api(`/admin/carriers/${c.id}/test`, { method: 'POST' }); toast(r.message, !r.ok); } catch (e) { toast(e.message, true); } reload(); }}>Test</AsyncBtn>
                <button className="btn btn-outline btn-sm" onClick={() => setEdit(c)}>Edit</button>
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="tiny muted mt12">A saved carrier goes live for booking once its API connector is switched on (built per carrier from their API docs). Until then customers keep booking through Shipmozo / Delhivery, which already cover most of these couriers.</p>
      {edit && <CarrierForm c={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} />}
    </div>
  );
}

function CarrierForm({ c, onClose, onDone }) {
  const isNew = !c.id;
  const [f, setF] = useState({ name: c.name || '', website: c.website || '', api_base: c.api_base || '', auth_type: c.auth_type || 'api_key', services: c.services || '', modes: c.modes || 'B2C', contact_name: c.contact_name || '', contact_phone: c.contact_phone || '', contact_email: c.contact_email || '', notes: c.notes || '', logo_file_id: c.logo_file_id || '' });
  const [cred, setCred] = useState(() => ({ ...(c.credentials || {}) }));
  const [preset, setPreset] = useState(c.name && !CARRIER_PRESETS.includes(c.name) ? 'Other' : (c.name || ''));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const fields = AUTH_FIELDS[f.auth_type] || AUTH_FIELDS.api_key;
  const save = async () => {
    if (!f.name.trim()) return toast('Enter the carrier name', true);
    const body = { ...f, credentials: Object.fromEntries(fields.map((k) => [k, cred[k] || ''])) };
    try { await api(isNew ? '/admin/carriers' : `/admin/carriers/${c.id}`, { method: isNew ? 'POST' : 'PUT', body }); toast(isNew ? 'Carrier added' : 'Saved'); onDone(); } catch (e) { toast(e.message, true); }
  };
  return (
    <Modal title={isNew ? 'Add carrier partner' : 'Edit ' + c.name} onClose={onClose} wide>
      <div className="grid2">
        <div className="field"><label>Carrier</label><select className="select" value={preset} onChange={(e) => { setPreset(e.target.value); setF({ ...f, name: e.target.value === 'Other' ? '' : e.target.value }); }}><option value="">Select…</option>{CARRIER_PRESETS.map((p) => <option key={p}>{p}</option>)}</select></div>
        <div className="field"><label>Display name</label><input className="input" value={f.name} onChange={set('name')} placeholder="e.g. DTDC Express" /></div>
        <div className="field"><label>Shipment types</label><select className="select" value={f.modes} onChange={set('modes')}><option>B2C</option><option>B2B</option><option>B2C + B2B</option><option>International</option></select></div>
        <div className="field"><label>Services (optional)</label><input className="input" value={f.services} onChange={set('services')} placeholder="Surface, Air, Priority…" /></div>
        <div className="field" style={{ gridColumn: '1/-1' }}><label>API base URL</label><input className="input" value={f.api_base} onChange={set('api_base')} placeholder="https://api.carrier.com/v1" /></div>
        <div className="field"><label>Authentication</label><select className="select" value={f.auth_type} onChange={set('auth_type')}><option value="api_key">API key</option><option value="key_secret">API key + secret</option><option value="user_pass">Username + password</option><option value="token">Access token</option><option value="oauth">OAuth (client ID / secret)</option></select></div>
        <div className="field"><label>Logo (optional)</label><input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; try { const id = await uploadFile(file); setF((x) => ({ ...x, logo_file_id: id })); toast('Logo uploaded'); } catch (er) { toast(er.message, true); } }} /></div>
        {fields.map((k) => <div className="field" key={k}><label>{k}</label><input className="input" type={/secret|password|token|key/i.test(k) ? 'password' : 'text'} autoComplete="new-password" value={cred[k] || ''} onChange={(e) => setCred({ ...cred, [k]: e.target.value })} placeholder={!isNew && c.credentials?.[k] ? 'saved — leave blank to keep' : ''} /></div>)}
        <div className="field"><label>Account manager</label><input className="input" value={f.contact_name} onChange={set('contact_name')} /></div>
        <div className="field"><label>Phone</label><input className="input" value={f.contact_phone} onChange={set('contact_phone')} /></div>
        <div className="field"><label>Email</label><input className="input" value={f.contact_email} onChange={set('contact_email')} /></div>
        <div className="field"><label>Website / API docs</label><input className="input" value={f.website} onChange={set('website')} /></div>
        <div className="field" style={{ gridColumn: '1/-1' }}><label>Notes</label><textarea className="textarea" value={f.notes} onChange={set('notes')} placeholder="Rate agreement, pickup cut-off, COD remittance cycle…" /></div>
      </div>
      <div className="row mt16" style={{ justifyContent: 'space-between' }}>
        {!isNew ? <AsyncBtn className="btn btn-outline" confirmText={'Remove ' + c.name + '?'} onClick={async () => { await api(`/admin/carriers/${c.id}`, { method: 'DELETE' }); toast('Removed'); onDone(); }}>Remove</AsyncBtn> : <span />}
        <AsyncBtn onClick={save}>{isNew ? 'Add carrier' : 'Save'}</AsyncBtn>
      </div>
    </Modal>
  );
}
