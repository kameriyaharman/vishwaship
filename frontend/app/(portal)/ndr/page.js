'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Stat, Chip, Spinner, ErrorBox, Modal, AsyncBtn, toast, useLoad, Empty } from '@/components/ui';
import { api, today, dShort } from '@/lib/api';

export default function Ndr() {
  const { data: d, err, reload } = useLoad(() => api('/me/ndr'), []);
  const [act, setAct] = useState(null);
  const [mt, setMt] = useState(typeof window !== 'undefined' && location.search.includes('tab=rto') ? 'rto' : 'ndr');
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!d) return <Spinner />;
  const st = d.stats;
  return (
    <>
      <div className="ph"><div><h1>NDR & RTO (Return to Origin)</h1><p>Failed delivery attempts — take action before shipment goes back to you</p></div></div>
      <div className="stats hide-sm">
        <Stat plain icon="alert" title="NDR pending action" value={st.ndr_pending} sub="respond within 24 h" subCls="orange" />
        <Stat plain icon="undo" title="RTO in transit" value={st.rto_transit} sub=" " />
        <Stat plain icon="box" title="RTO delivered (this month)" value={st.rto_delivered_month} sub=" " />
        <Stat plain icon="chart" title="RTO rate (30 days)" value={st.rto_rate + '%'} sub=" " />
      </div>
      <div className="card p0 tbl-wrap mt16 hide-sm">
        <table className="tbl">
          <thead><tr><th>AWB</th><th>Receiver</th><th>Attempts</th><th>Reason (Delhivery)</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {d.items.map((s) => (
              <tr key={s.id}>
                <td className="mono"><Link href={'/shipment/?id=' + s.id}>{s.awb}</Link></td><td>{s.to_name}, {s.to_city}</td><td>{s.ndr_attempts || '—'}</td><td>{s.ndr_reason || '—'}</td>
                <td><Chip s={s.status === 'ndr' ? 'ndr' : 'rto'} label={s.status === 'ndr' ? 'NDR' : s.status === 'rto_delivered' ? 'RTO delivered' : 'RTO'} /></td>
                <td>
                  {s.status === 'ndr' && !s.ndr_action && (
                    <span className="row wrap" style={{ gap: 6 }}>
                      <button className="link-green" onClick={() => setAct({ s, type: 'reattempt' })}>Re-attempt</button>·
                      <button className="link-navy" onClick={() => setAct({ s, type: 'change_address' })}>Change address</button>·
                      <AsyncBtn className="link-navy" confirmText="Return this shipment to origin? RTO charges apply." onClick={async () => { await api('/me/ndr/' + s.id, { method: 'POST', body: { action: 'rto' } }); toast('RTO requested'); reload(); }}>RTO</AsyncBtn>
                    </span>
                  )}
                  {s.status === 'ndr' && s.ndr_action && <span className="small green b">{s.ndr_action}</span>}
                  {s.status === 'rto_in_transit' && <span className="small">Returning to {s.from_city} · ETA {dShort(s.eta)}</span>}
                  {s.status === 'rto_delivered' && <span className="small muted">Returned to you</span>}
                </td>
              </tr>
            ))}
            {!d.items.length && <tr><td colSpan={6}><Empty>No failed deliveries. 👍</Empty></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="show-sm">
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '4px 0 12px' }}>
          {[['ndr', 'NDR', (x) => x.status === 'ndr'], ['rto', 'RTO', (x) => x.status === 'rto_in_transit'], ['rtod', 'RTO Delivered', (x) => x.status === 'rto_delivered']].map(([k, l, f]) => (
            <button key={k} className={'pill2' + (mt === k ? ' on' : '')} onClick={() => setMt(k)}>{l} <b>{d.items.filter(f).length}</b></button>
          ))}
        </div>
        {d.items.filter((x) => (mt === 'ndr' ? x.status === 'ndr' : mt === 'rto' ? x.status === 'rto_in_transit' : x.status === 'rto_delivered')).map((s) => (
          <div key={s.id} className="mo-card" style={{ marginBottom: 10 }}>
            <div className="row between"><Link href={'/shipment/?id=' + s.id} className="mono b">{s.awb}</Link><Chip s={s.status === 'ndr' ? 'ndr' : 'rto'} label={s.status === 'ndr' ? 'NDR' : s.status === 'rto_delivered' ? 'RTO delivered' : 'RTO'} /></div>
            <div className="small mt8"><b>{s.to_name}</b> · {s.to_city}</div>
            <div className="tiny muted mt4">NDR date: {dShort(s.updated_at || s.created_at)} · Attempts: {s.ndr_attempts || 0}</div>
            {s.ndr_reason && <div className="tiny mt4">Reason: {s.ndr_reason}</div>}
            {s.status === 'ndr' && !s.ndr_action && (
              <div className="row mt12" style={{ gap: 8 }}>
                <button className="btn btn-sm btn-orange" onClick={() => setAct({ s, type: 'reattempt' })}>Re-attempt</button>
                <button className="btn btn-sm btn-outline" onClick={() => setAct({ s, type: 'change_address' })}>Change address</button>
                <AsyncBtn className="btn btn-sm btn-outline" confirmText="Return this shipment to origin? RTO charges apply." onClick={async () => { await api('/me/ndr/' + s.id, { method: 'POST', body: { action: 'rto' } }); toast('RTO requested'); reload(); }}>RTO</AsyncBtn>
              </div>
            )}
            {s.status === 'ndr' && s.ndr_action && <div className="small green b mt8">{s.ndr_action}</div>}
          </div>
        ))}
        {!d.items.filter((x) => (mt === 'ndr' ? x.status === 'ndr' : mt === 'rto' ? x.status === 'rto_in_transit' : x.status === 'rto_delivered')).length && <Empty>No records found.</Empty>}
      </div>
      {act && <ActModal {...act} onClose={() => setAct(null)} onDone={() => { setAct(null); reload(); }} />}
    </>
  );
}

function ActModal({ s, type, onClose, onDone }) {
  const [f, setF] = useState({ date: today(), address: s.to_address, phone: s.to_phone, remark: '' });
  return (
    <Modal title={(type === 'reattempt' ? 'Re-attempt delivery' : 'Update address') + ' · ' + s.awb} onClose={onClose}>
      <div className="col">
        {type === 'reattempt' ? (
          <>
            <div className="field"><label>Preferred date</label><input className="input" type="date" min={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
            <div className="field"><label>Instructions for courier</label><input className="input" value={f.remark} onChange={(e) => setF({ ...f, remark: e.target.value })} placeholder="Call before delivery" /></div>
          </>
        ) : (
          <>
            <div className="field"><label>Full address</label><textarea className="textarea" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
            <div className="field"><label>Receiver mobile</label><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          </>
        )}
        <AsyncBtn onClick={async () => { await api('/me/ndr/' + s.id, { method: 'POST', body: { action: type, ...f } }); toast('Request sent to Delhivery'); onDone(); }}>Submit</AsyncBtn>
      </div>
    </Modal>
  );
}
