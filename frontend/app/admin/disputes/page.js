'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Stat, Chip, Spinner, ErrorBox, Modal, AsyncBtn, toast, useLoad, PageHead } from '@/components/ui';
import { api, inr, kg, fileUrl, dShort } from '@/lib/api';

export default function Disputes() {
  const [status, setStatus] = useState('');
  const { data: d, err, reload } = useLoad(() => api('/admin/disputes' + (status ? '?status=' + status : '')), [status]);
  const [sel, setSel] = useState(null);
  const [cfg, setCfg] = useState(false);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!d) return <Spinner />;
  const st = d.stats;
  return (
    <>
      <PageHead title="Weight Discrepancy Management" sub="From Delhivery re-weigh · charge customer the difference + markup · forward disputes with proof">
        <button className="btn btn-outline" onClick={() => setCfg(true)}>Auto-accept after {d.auto_accept_days} days: {d.auto_accept ? 'ON' : 'OFF'}</button>
      </PageHead>
      <div className="stats">
        <Stat plain icon="weight" title="Open" value={st.open} sub={`${inr(st.open_amount)} to recover`} subCls="orange" />
        <Stat plain icon="alert" title="Disputed by customers" value={st.disputed} sub={`${st.sent} sent to Delhivery`} subCls="purple" />
        <Stat plain icon="rupee" title="Recovered (this month)" value={inr(st.recovered)} sub=" " />
        <Stat plain icon="check" title="Won from Delhivery" value={inr(st.won)} sub="refunds" subCls="green" />
      </div>
      <div className="pills mt16 mb12">{[['', 'All'], ['open', 'Open'], ['disputed', 'Disputed'], ['accepted', 'Accepted'], ['resolved', 'Resolved']].map(([k, l]) => <button key={k} className={'pill' + (status === k ? ' on' : '')} onClick={() => setStatus(k)}>{l}</button>)}</div>
      <div className="card p0 tbl-wrap">
        <table className="tbl">
          <thead><tr><th>AWB</th><th>Customer</th><th>Declared</th><th>Delhivery weight</th><th className="num">Extra (base)</th><th className="num">Extra (customer)</th><th>Customer action</th><th>Delhivery dispute</th><th>Status</th></tr></thead>
          <tbody>
            {d.items.map((x) => (
              <tr key={x.id} className="click" onClick={() => setSel(x)}>
                <td className="mono">{x.awb}</td><td>{x.customer}</td><td>{kg(x.declared_weight)}</td><td>{kg(x.courier_weight)}</td>
                <td className="num">{inr(x.base_extra)}</td><td className="num">{inr(x.customer_extra)}</td><td>{x.customer_action || 'Pending'}</td><td>{x.delhivery_dispute || '—'}</td><td><Chip s={x.status} /></td>
              </tr>
            ))}
            {!d.items.length && <tr><td colSpan={9} className="empty">No discrepancies. Add one from a shipment's page (All Shipments → open shipment → Add weight discrepancy).</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="card mt12 row wrap" style={{ gap: 20 }}>
        {['Delhivery reports new weight', 'Customer notified (dashboard)', 'Accept → wallet debit', 'Dispute → proof to Delhivery', 'Refund if won'].map((t, i) => <span key={i} className="row small"><span className="avatar" style={{ width: 22, height: 22, fontSize: 11 }}>{i + 1}</span>{t}</span>)}
      </div>
      {sel && (
        <Modal title={`Discrepancy · AWB ${sel.awb}`} onClose={() => setSel(null)} wide>
          <div className="split">
            <div>
              <div className="kv"><span>Customer</span><b>{sel.customer}</b></div>
              <div className="kv"><span>Declared</span><b>{kg(sel.declared_weight)} · {sel.declared_dims}</b></div>
              <div className="kv"><span>Courier</span><b>{kg(sel.courier_weight)} · {sel.courier_dims || '—'}</b></div>
              <div className="kv"><span>Charged on</span><b>{kg(sel.charged_weight)}</b></div>
              <div className="kv"><span>Extra base / customer</span><b>{inr(sel.base_extra)} / {inr(sel.customer_extra)} + GST</b></div>
              <div className="kv"><span>Deadline</span><b>{dShort(sel.deadline)}</b></div>
              <div className="kv"><span>Status</span><b><Chip s={sel.status} /> {sel.outcome || ''}</b></div>
              {sel.customer_note && <div className="note mt8">Customer: {sel.customer_note}</div>}
              <Link href={`/admin/shipment/?id=${sel.shipment_id}`} className="link small mt8" style={{ display: 'block' }}>Open shipment →</Link>
            </div>
            <div>
              <b className="small">Courier proof</b>
              <div className="row wrap mt8">{(sel.proof_ids || '').split(',').filter(Boolean).map((p) => <a key={p} href={fileUrl(p)} target="_blank"><img src={fileUrl(p)} alt="" style={{ width: 90, height: 70, objectFit: 'cover', borderRadius: 6 }} /></a>)}{!sel.proof_ids && <span className="tiny muted">none</span>}</div>
              <b className="small mt12" style={{ display: 'block' }}>Customer photos</b>
              <div className="row wrap mt8">{(sel.customer_proof_ids || '').split(',').filter(Boolean).map((p) => <a key={p} href={fileUrl(p)} target="_blank"><img src={fileUrl(p)} alt="" style={{ width: 90, height: 70, objectFit: 'cover', borderRadius: 6 }} /></a>)}{!sel.customer_proof_ids && <span className="tiny muted">none</span>}</div>
            </div>
          </div>
          <div className="row wrap mt16">
            {sel.status === 'disputed' && !sel.delhivery_dispute && <AsyncBtn className="btn btn-navy" onClick={async () => { await api('/admin/disputes/' + sel.id, { method: 'POST', body: { action: 'forward' } }); toast('Marked as raised on Delhivery'); setSel(null); reload(); }}>Mark: raised on Delhivery</AsyncBtn>}
            {['open', 'disputed'].includes(sel.status) && <>
              <AsyncBtn className="btn btn-green" onClick={async () => { await api('/admin/disputes/' + sel.id, { method: 'POST', body: { action: 'won' } }); toast('Closed — no charge'); setSel(null); reload(); }}>Won / waive charge</AsyncBtn>
              <AsyncBtn className="btn btn-red" confirmText="Charge the customer for this discrepancy?" onClick={async () => { await api('/admin/disputes/' + sel.id, { method: 'POST', body: { action: sel.status === 'open' ? 'accept' : 'lost' } }); toast('Charged to customer wallet'); setSel(null); reload(); }}>{sel.status === 'open' ? 'Charge customer now' : 'Lost — charge customer'}</AsyncBtn>
            </>}
            {sel.status === 'accepted' && <AsyncBtn className="btn btn-green" onClick={async () => { await api('/admin/disputes/' + sel.id, { method: 'POST', body: { action: 'won' } }); toast('Refunded'); setSel(null); reload(); }}>Refund (won from Delhivery)</AsyncBtn>}
            <AsyncBtn className="btn btn-outline" confirmText="Delete this discrepancy record?" onClick={async () => { await api('/admin/disputes/' + sel.id, { method: 'POST', body: { action: 'delete' } }); setSel(null); reload(); }}>Delete</AsyncBtn>
          </div>
        </Modal>
      )}
      {cfg && <AutoCfg d={d} onClose={() => setCfg(false)} onDone={() => { setCfg(false); reload(); }} />}
    </>
  );
}

function AutoCfg({ d, onClose, onDone }) {
  const [f, setF] = useState({ auto_accept: d.auto_accept, auto_accept_days: d.auto_accept_days });
  return (
    <Modal title="Auto-accept setting" onClose={onClose}>
      <label className="check"><input type="checkbox" checked={f.auto_accept} onChange={(e) => setF({ ...f, auto_accept: e.target.checked })} /> Auto-accept open discrepancies after deadline (wallet debit)</label>
      <div className="field mt12"><label>Days to respond</label><input className="input" type="number" value={f.auto_accept_days} onChange={(e) => setF({ ...f, auto_accept_days: e.target.value })} /></div>
      <AsyncBtn className="btn btn-orange mt12" onClick={async () => { await api('/admin/disputes/settings', { method: 'PUT', body: f }); toast('Saved'); onDone(); }}>Save</AsyncBtn>
    </Modal>
  );
}
