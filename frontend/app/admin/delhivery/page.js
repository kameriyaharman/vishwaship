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
      <PageHead title="Delhivery API Integration" sub="Your own Delhivery account connected directly — booking, AWB, label, pickup and tracking happen automatically">
        <AsyncBtn className="btn btn-outline" onClick={async () => { await save(); const r = await api('/admin/delhivery/test', { method: 'POST' }); toast(r.message, !r.ok); reload(); }}>Test connection</AsyncBtn>
        <AsyncBtn onClick={save}>Save</AsyncBtn>
      </PageHead>
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
