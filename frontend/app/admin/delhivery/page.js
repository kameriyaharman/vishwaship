'use client';
import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { Chip, Spinner, ErrorBox, Modal, AsyncBtn, toast, useLoad, PageHead } from '@/components/ui';
import { api, API, dTime } from '@/lib/api';

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
      <PageHead title="Courier API Integrations" sub="Delhivery and Shipmozo — keys are entered here. Customers see the API price + your commission.">
        <AsyncBtn className="btn btn-outline" onClick={async () => { await save(); const r = await api('/admin/delhivery/test', { method: 'POST' }); toast(r.message, !r.ok); reload(); }}>Test Delhivery</AsyncBtn>
        <AsyncBtn onClick={save}>Save Delhivery</AsyncBtn>
      </PageHead>
 <Shipmozo />
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
  useEffect(() => { if (d) setF({ enabled: d.enabled, public_key: d.public_key, private_key: '', base: d.base, warehouse_id: d.warehouse_id, package_type: d.package_type, rov_type: d.rov_type, max_options: d.max_options, schedule_pickup: d.schedule_pickup, delhivery_enabled: d.delhivery_enabled }); }, [d]);
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
            <div className="field"><label>Warehouse ID (pickup)</label><input className="input" value={f.warehouse_id} onChange={set('warehouse_id')} /></div>
            <div className="field"><label>Courier options to show</label><input className="input" type="number" min="1" max="10" value={f.max_options} onChange={set('max_options')} /></div>
          </div>
          {wh.length > 0 && <div className="note">Warehouses: {wh.map((w) => <button key={w.id} className="link small" style={{ marginRight: 10 }} onClick={() => setF({ ...f, warehouse_id: w.id })}>{w.id} · {w.name} {w.pincode}</button>)}</div>}
        </div>
        <div className="col">
          <div className="field"><label>API base URL</label><input className="input" value={f.base} onChange={set('base')} /></div>
          <div className="grid2">
            <div className="field"><label>Package type</label><input className="input" value={f.package_type} onChange={set('package_type')} /></div>
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
      <p className="tiny muted mt12">Booking flow with Shipmozo: rate-calculator → push-order → assign-courier (AWB) → schedule-pickup. Status sync via track-order. Every call appears in API logs below.</p>
    </div>
  );
}
