'use client';
import { useEffect, useState } from 'react';
import { Stat, Chip, Spinner, ErrorBox, Modal, AsyncBtn, toast, useLoad, Empty } from '@/components/ui';
import { useShell } from '@/components/Shell';
import { api, inr, kg, fileUrl, uploadFile } from '@/lib/api';

export default function WeightDiscrepancy() {
  const { refresh } = useShell();
  const { data: d, err, reload } = useLoad(() => api('/me/disputes'), []);
  const [selId, setSelId] = useState(null);
  const [dispute, setDispute] = useState(false);
  useEffect(() => { if (d && !selId && d.items[0]) setSelId(d.items[0].id); }, [d, selId]);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!d) return <Spinner />;
  const sel = d.items.find((x) => x.id === selId);
  const st = d.stats;
  const proofs = sel ? (sel.proof_ids || '').split(',').filter(Boolean) : [];
  const labels = sel ? (sel.proof_labels || '').split('|') : [];

  return (
    <>
      <div className="ph"><div><h1>Weight Discrepancy</h1><p>When Delhivery's re-weighed weight is higher than what you declared — see details, proof and extra charge</p></div></div>
      <div className="stats">
        <Stat plain icon="weight" title="Open" value={st.open} sub={`action in ${st.days} days`} subCls="orange" />
        <Stat plain icon="rupee" title="Extra charge (open)" value={inr(st.open_amount)} sub="+ GST" />
        <Stat plain icon="alert" title="Disputed" value={st.disputed} sub="under review" subCls="purple" />
        <Stat plain icon="check" title="Resolved (this month)" value={st.resolved_month} sub=" " />
      </div>
      <div className="card p0 tbl-wrap mt16">
        <table className="tbl">
          <thead><tr><th>AWB</th><th>To</th><th>Declared</th><th>Courier weight</th><th className="hide-sm">Charged on</th><th className="hide-sm">Earlier</th><th className="hide-sm">Revised</th><th>Difference</th><th>Status</th><th>Time left</th></tr></thead>
          <tbody>
            {d.items.map((x) => (
              <tr key={x.id} className={'click' + (x.id === selId ? ' sel' : '')} onClick={() => setSelId(x.id)}>
                <td className="mono">{x.awb}</td><td>{x.to_city}</td><td>{kg(x.declared_weight)}</td><td>{kg(x.courier_weight)}</td><td className="hide-sm">{kg(x.charged_weight)}</td>
                <td className="hide-sm">{inr(x.earlier_amount)}</td><td className="hide-sm">{inr(x.revised_amount)}</td><td className="red b">+{inr(x.customer_extra)}</td>
                <td><Chip s={x.status} /></td><td>{x.time_left !== null ? `${x.time_left} day${x.time_left === 1 ? '' : 's'}` : '—'}</td>
              </tr>
            ))}
            {!d.items.length && <tr><td colSpan={10}><Empty>No weight discrepancies 🎉 — keep declaring accurate weight & size.</Empty></td></tr>}
          </tbody>
        </table>
      </div>
      {sel && (
        <div className="split mt16">
          <div className="card">
            <div className="card-h"><h3>AWB {sel.awb} · details</h3></div>
            <div className="kv"><span>Declared</span><b>{kg(sel.declared_weight)} · {sel.declared_dims} cm (vol. {kg(sel.declared_vol)})</b></div>
            <div className="kv"><span>Courier reported</span><b>{kg(sel.courier_weight)}{sel.courier_dims ? ` · ${sel.courier_dims} cm (vol. ${kg(sel.courier_vol)})` : ''}</b></div>
            <div className="kv"><span>Charged on</span><b>{kg(sel.charged_weight)} slab</b></div>
            <div className="kv"><span>Extra amount</span><b>{inr(sel.customer_extra)} + GST</b></div>
            <div className="kv"><span>Status</span><b>{sel.customer_action || sel.status}{sel.delhivery_dispute ? ` · ${sel.delhivery_dispute}` : ''}</b></div>
            {sel.customer_note && <div className="note mt8">Your note: {sel.customer_note}</div>}
          </div>
          <div className="card">
            <div className="card-h"><h3>Courier proof</h3></div>
            {proofs.length ? (
              <div className="grid3">{proofs.map((p, i) => <a key={p} href={fileUrl(p)} target="_blank" style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', height: 110, background: '#c9b292', display: 'block' }}><img src={fileUrl(p)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /><span className="tiny" style={{ position: 'absolute', left: 6, bottom: 6, color: '#fff', fontWeight: 600, textShadow: '0 1px 2px #000' }}>{labels[i]}</span></a>)}</div>
            ) : (
              <div className="grid3">{labels.slice(0, 3).map((l, i) => <div key={i} style={{ height: 100, borderRadius: 8, background: 'linear-gradient(135deg,#cdb796,#8f7656)', color: '#fff', display: 'flex', alignItems: 'flex-end', padding: 8, fontSize: 11, fontWeight: 600 }}>{l}</div>)}</div>
            )}
            {sel.status === 'open' ? (
              <div className="row mt12">
                <AsyncBtn className="btn btn-navy grow" confirmText={`Accept and pay ${inr(sel.customer_extra)} + GST from wallet?`} onClick={async () => { await api(`/me/disputes/${sel.id}/accept`, { method: 'POST' }); toast('Accepted — charged to wallet'); reload(); refresh(); }}>Accept</AsyncBtn>
                <button className="btn btn-outline grow" onClick={() => setDispute(true)}>Raise dispute (upload my photos)</button>
              </div>
            ) : <div className="note mt12">This discrepancy is <b>{sel.status}</b>.</div>}
          </div>
        </div>
      )}
      {dispute && sel && <DisputeModal d={sel} onClose={() => setDispute(false)} onDone={() => { setDispute(false); reload(); }} />}
    </>
  );
}

function DisputeModal({ d, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [ids, setIds] = useState([]);
  const [up, setUp] = useState(false);
  return (
    <Modal title={`Raise dispute · AWB ${d.awb}`} onClose={onClose}>
      <p className="small muted">Upload photos of the packed parcel on a weighing scale and with a measuring tape (length, width, height). We forward them to Delhivery.</p>
      <input type="file" accept="image/*" multiple onChange={async (e) => {
        setUp(true);
        try { const n = []; for (const f of e.target.files) n.push(await uploadFile(f)); setIds([...ids, ...n]); } catch (er) { toast(er.message, true); } finally { setUp(false); }
      }} />
      {up && <div className="small muted mt8">Uploading…</div>}
      {ids.length > 0 && <div className="small green mt8">{ids.length} photo(s) attached</div>}
      <textarea className="textarea mt12" placeholder="Explain why the weight is wrong" value={note} onChange={(e) => setNote(e.target.value)} />
      <AsyncBtn className="btn btn-orange mt12" disabled={up} onClick={async () => { await api(`/me/disputes/${d.id}/dispute`, { method: 'POST', body: { note, proof_ids: ids } }); toast('Dispute submitted'); onDone(); }}>Submit dispute</AsyncBtn>
    </Modal>
  );
}
