'use client';
import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { Spinner, ErrorBox, Modal, AsyncBtn, toast, useLoad, PageHead } from '@/components/ui';
import { api, inr } from '@/lib/api';

const ceilR = (v, mode) => mode === 'none' ? Math.round(v * 100) / 100 : mode === 'nearest1' ? Math.round(v) : Math.ceil(Math.round(v * 100) / 100);

export default function Rates() {
  const { data: d, err, reload } = useLoad(() => api('/admin/rates'), []);
  const [g, setG] = useState(20);
  const [rc, setRc] = useState([]);
  const [st, setSt] = useState({});
  const [svc, setSvc] = useState('surface');
  const [editCard, setEditCard] = useState(false);
  const [ov, setOv] = useState(null);
  useEffect(() => { if (d) { setG(d.global_markup); setRc(d.rate_card); setSt(d.settings); } }, [d]);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!d) return <Spinner />;
  const zones = Object.entries(d.zones);
  const row = (z) => rc.find((r) => r.service === svc && r.zone === z) || {};
  const base = (z, w) => { const r = row(z); const n = Math.max(0, (w - 0.5) / 0.5); return +r.first_500 + n * +r.add_500; };
  const fin = (b) => ceilR(b * (1 + g / 100), st.rounding);
  const save = async () => { await api('/admin/rates', { method: 'PUT', body: { global_markup: g, rate_card: rc, settings: st } }); toast('Rates & markup saved'); reload(); };
  const setS = (k) => (e) => setSt({ ...st, [k]: e.target.type === 'checkbox' ? (e.target.checked ? '1' : '0') : e.target.value });

  return (
    <>
      <PageHead title="Rates & Commission" sub="Courier API price (Delhivery / Shipmozo) + your commission % = final rate the customer sees before booking">
        <AsyncBtn onClick={save}>Save changes</AsyncBtn>
      </PageHead>
      <div className="split-1-2" style={{ gridTemplateColumns: '1fr 1.55fr' }}>
        <div className="col" style={{ gap: 14 }}>
          <div className="card" style={{ border: '2px solid var(--orange)' }}>
            <div className="card-h"><h3><Icon name="percent" style={{ color: 'var(--orange)' }} />Global commission</h3></div>
            <div className="row">
              <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <input type="number" value={g} min={0} max={200} onChange={(e) => setG(+e.target.value)} style={{ width: 54, border: 0, fontSize: 24, fontWeight: 700, outline: 'none', textAlign: 'right' }} /><b style={{ fontSize: 22 }}>%</b>
              </div>
              <span className="small muted">Applies to all customers unless a custom markup is set</span>
            </div>
            <input type="range" min={0} max={50} step={0.5} value={Math.min(g, 50)} onChange={(e) => setG(+e.target.value)} style={{ width: '100%', accentColor: 'var(--orange)', marginTop: 14 }} />
            <div className="row between tiny muted"><span>0%</span><span>50%</span></div>
            <div style={{ background: 'var(--navy)', color: '#fff', borderRadius: 10, padding: 14, marginTop: 12 }}>
              <div className="kv" style={{ borderColor: 'rgba(255,255,255,.12)' }}><span style={{ color: '#c4cbe0' }}>Courier API price</span><b>₹100</b></div>
              <div className="kv" style={{ borderColor: 'rgba(255,255,255,.12)' }}><span style={{ color: '#c4cbe0' }}>+ Commission {g}%</span><b>₹{(g).toFixed(g % 1 ? 1 : 0)}</b></div>
              <div className="row between mt8"><b style={{ fontSize: 18 }}>Customer sees</b><b style={{ fontSize: 22, color: 'var(--orange)' }}>{inr(fin(100))}</b></div>
              <div className="tiny" style={{ color: '#aeb7cc' }}>+ GST as applicable</div>
            </div>
          </div>
          <div className="card">
            <div className="card-h"><h3>Other charges</h3></div>
            <div className="grid2">
              <div className="field"><label>COD fixed (₹, base)</label><input className="input" type="number" value={st.cod_fixed || ''} onChange={setS('cod_fixed')} /></div>
              <div className="field"><label>COD % of amount (base)</label><input className="input" type="number" step="0.1" value={st.cod_pct || ''} onChange={setS('cod_pct')} /></div>
              <div className="field"><label>RTO charge (% of forward)</label><input className="input" type="number" value={st.rto_pct || ''} onChange={setS('rto_pct')} /></div>
              <div className="field"><label>Rounding</label><select className="select" value={st.rounding} onChange={setS('rounding')}><option value="ceil1">Up to next ₹1</option><option value="nearest1">Nearest ₹1</option><option value="none">No rounding</option></select></div>
              <div className="field"><label>GST %</label><input className="input" type="number" value={st.gst_pct || ''} onChange={setS('gst_pct')} /></div>
              <div className="field"><label>Volumetric divisor</label><input className="input" type="number" value={st.vol_divisor || ''} onChange={setS('vol_divisor')} /></div>
            </div>
            <div className="mt12">
              <div className="kv"><span>COD charge</span><b>max(₹{st.cod_fixed}, {st.cod_pct}%) + {g}%</b></div>
              <div className="kv"><span>RTO charge</span><b>{+st.rto_pct === 100 ? 'Same as forward' : st.rto_pct + '% of forward'} (incl. markup)</b></div>
              <div className="kv"><span>Weight discrepancy</span><b>Pass on difference + markup</b></div>
            </div>
          </div>
          <div className="card">
            <div className="card-h"><h3>Services</h3></div>
            {['surface', 'express'].map((s) => (
              <div key={s} className="mb12">
                <label className="check mb8"><input type="checkbox" checked={st[`service_${s}_enabled`] === '1'} onChange={setS(`service_${s}_enabled`)} /> <b>{s === 'surface' ? 'Surface' : 'Express'}</b> enabled</label>
                <div className="grid2 keep"><div className="field"><label>Delivery text</label><input className="input" value={st[`${s}_days`] || ''} onChange={setS(`${s}_days`)} /></div>
                <div className="field"><label>ETA (days)</label><input className="input" type="number" value={st[`${s}_eta`] || ''} onChange={setS(`${s}_eta`)} /></div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="col" style={{ gap: 14 }}>
          <div className="card p0">
            <div className="card-h" style={{ padding: '16px 18px 0' }}>
              <h3>Rate preview — <select className="select" style={{ width: 'auto', display: 'inline-block', minHeight: 30, padding: '4px 28px 4px 8px' }} value={svc} onChange={(e) => setSvc(e.target.value)}><option value="surface">Surface</option><option value="express">Express</option></select> (base → final)</h3>
              <button className="link small" onClick={() => setEditCard(true)}>Edit base rate card</button>
            </div>
            <div className="tbl-wrap"><table className="tbl">
              <thead><tr><th>Weight slab</th>{zones.map(([z, l]) => <th key={z}>Zone {z} ({l})</th>)}</tr></thead>
              <tbody>
                {[['0.5 kg', 0.5], ['+0.5 kg', null], ['1 kg', 1], ['2 kg', 2], ['5 kg', 5]].map(([l, w]) => (
                  <tr key={l}><td>{l}</td>{zones.map(([z]) => { const b = w === null ? +row(z).add_500 : base(z, w); return <td key={z}>₹{+b.toFixed(2)} → <b>{inr(fin(b))}</b></td>; })}</tr>
                ))}
              </tbody>
            </table></div>
            <p className="tiny muted" style={{ padding: '0 18px 14px' }}>When Delhivery is live, base rates come from the Delhivery cost API per shipment; this rate card is used as fallback and in simulation mode.</p>
          </div>
          <div className="card p0">
            <div className="card-h" style={{ padding: '16px 18px 0' }}><h3>Customer-wise commission</h3><button className="link-navy small" onClick={() => setOv({ id: '', markup_pct: '', markup_reason: '' })}>+ Add override</button></div>
            <table className="tbl">
              <thead><tr><th>Customer</th><th>Markup</th><th>Reason</th><th></th></tr></thead>
              <tbody>
                {d.custom.map((c) => <tr key={c.id}><td>{c.label}</td><td>{+c.markup_pct}%</td><td>{c.markup_reason || '—'}</td><td className="right"><button className="link-navy small" onClick={() => setOv({ ...c })}>Edit</button></td></tr>)}
                {!d.custom.length && <tr><td colSpan={4} className="empty small">All customers use the global commission. Set a customer's commission when approving KYC.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {editCard && (
        <Modal title={`Base rate card — ${svc}`} onClose={() => setEditCard(false)} wide>
          <table className="tbl"><thead><tr><th>Zone</th><th>First 500 g (₹)</th><th>Each additional 500 g (₹)</th></tr></thead>
            <tbody>{zones.map(([z, l]) => { const r = row(z); return (
              <tr key={z}><td>Zone {z} · {l}</td>
                <td><input className="input" type="number" value={r.first_500} onChange={(e) => setRc(rc.map((x) => x === r ? { ...x, first_500: e.target.value } : x))} /></td>
                <td><input className="input" type="number" value={r.add_500} onChange={(e) => setRc(rc.map((x) => x === r ? { ...x, add_500: e.target.value } : x))} /></td></tr>); })}</tbody></table>
          <p className="tiny muted">Zones: A same city (first 3 pincode digits), B same region, C metro↔metro, D rest of India, E North-East / J&K.</p>
          <AsyncBtn className="btn btn-orange mt12" onClick={async () => { await save(); setEditCard(false); }}>Save rate card</AsyncBtn>
        </Modal>
      )}
      {ov && (
        <Modal title="Customer commission" onClose={() => setOv(null)}>
          <div className="col">
            {!ov.label && <div className="field"><label>Customer</label><select className="select" value={ov.id} onChange={(e) => setOv({ ...ov, id: e.target.value })}><option value="">Select…</option>{d.customers.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>}
            {ov.label && <b>{ov.label}</b>}
            <div className="grid2"><div className="field"><label>Commission %</label><input className="input" type="number" step="0.5" value={ov.markup_pct} onChange={(e) => setOv({ ...ov, markup_pct: e.target.value })} /></div>
              <div className="field"><label>Reason</label><input className="input" value={ov.markup_reason || ''} onChange={(e) => setOv({ ...ov, markup_reason: e.target.value })} /></div></div>
            <div className="row">
              <AsyncBtn disabled={!ov.id} onClick={async () => { await api('/admin/customers/' + ov.id, { method: 'PUT', body: { markup_pct: ov.markup_pct, markup_reason: ov.markup_reason } }); toast('Saved'); setOv(null); reload(); }}>Save</AsyncBtn>
              {ov.label && <AsyncBtn className="btn btn-outline" onClick={async () => { await api('/admin/customers/' + ov.id, { method: 'PUT', body: { markup_pct: null, markup_reason: '' } }); toast('Reverted to global'); setOv(null); reload(); }}>Remove override</AsyncBtn>}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
