'use client';
import { useState } from 'react';
import { Chip, Spinner, ErrorBox, Modal, AsyncBtn, toast, useLoad, PageHead } from '@/components/ui';
import { api, dTime, fileUrl } from '@/lib/api';

export default function Support() {
  const { data: d, err, reload } = useLoad(() => api('/admin/support'), []);
  const cp = useLoad(() => api('/admin/complaints'), []);
  const [tab, setTab] = useState('c');
  const [cm, setCm] = useState(null);
  const [t, setT] = useState(null);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!d) return <Spinner />;
  return (
    <>
      <PageHead title="Support & Enquiries" sub="Customer tickets and website contact-form enquiries" />
      <div className="seg mb12" style={{ overflowX: 'auto', maxWidth: '100%' }}><button className={tab === 'c' ? 'on' : ''} onClick={() => setTab('c')}>Complaints ({cp.data?.counts?.open || 0} new)</button><button className={tab === 'd' ? 'on' : ''} onClick={() => setTab('d')}>Deletion requests ({d.deletions.length})</button><button className={tab === 't' ? 'on' : ''} onClick={() => setTab('t')}>Tickets ({d.tickets.filter((x) => x.status === 'open').length} open)</button><button className={tab === 'e' ? 'on' : ''} onClick={() => setTab('e')}>Enquiries ({d.enquiries.length})</button></div>
      <div className="card p0 tbl-wrap">
        {tab === 'c' && (
          <table className="tbl"><thead><tr><th>Ticket</th><th>Date</th><th>Name / contact</th><th>Category</th><th>AWB</th><th>Subject</th><th>Status</th></tr></thead>
            <tbody>{(cp.data?.items || []).map((x) => <tr key={x.id} className="click" onClick={() => setCm({ ...x, reply: x.reply || '' })}><td className="mono">{x.ticket_no}</td><td>{dTime(x.created_at)}</td><td>{x.name}<div className="tiny muted">{x.mobile} · {x.email}</div></td><td>{x.category}</td><td className="mono">{x.awb || '—'}</td><td>{x.subject}</td><td><Chip s={x.status === 'open' ? 'open' : x.status === 'in_progress' ? 'in_transit' : 'delivered'} label={x.status.replace('_', ' ')} /></td></tr>)}
              {!cp.data?.items.length && <tr><td colSpan={7} className="empty">No complaints.</td></tr>}</tbody></table>
        )}
        {tab === 'd' && (
          <table className="tbl"><thead><tr><th>Requested</th><th>Customer</th><th>Contact</th><th className="num">Wallet</th><th>Reason</th><th /></tr></thead>
            <tbody>{d.deletions.map((x) => <tr key={x.id}><td>{dTime(x.deletion_requested_at)}</td><td className="b">{x.business_name || x.name}</td><td className="small">{x.mobile}<br />{x.email}</td><td className="num">₹{(+x.wallet_balance).toLocaleString('en-IN')}</td><td className="small">{x.deletion_reason || '—'}</td>
              <td className="right"><AsyncBtn className="btn btn-red btn-sm" confirmText="Permanently delete this customer and all their data? Settle wallet & COD first." onClick={async () => { await api(`/admin/customers/${x.id}?force=1`, { method: 'DELETE' }); toast('Customer deleted'); reload(); }}>Delete account</AsyncBtn></td></tr>)}
              {!d.deletions.length && <tr><td colSpan={6} className="empty">No deletion requests.</td></tr>}</tbody></table>
        )}
        {tab === 't' && (
          <table className="tbl"><thead><tr><th>Date</th><th>Customer</th><th>AWB</th><th>Subject</th><th>Status</th><th></th></tr></thead>
            <tbody>{d.tickets.map((x) => <tr key={x.id} className="click" onClick={() => setT({ ...x, reply: x.reply || '' })}><td>{dTime(x.created_at)}</td><td>{x.customer}</td><td className="mono">{x.awb || '—'}</td><td>{x.subject}</td><td><Chip s={x.status} /></td><td className="link small">Open</td></tr>)}
              {!d.tickets.length && <tr><td colSpan={6} className="empty">No tickets.</td></tr>}</tbody></table>
        )}
        {tab === 'e' && (
          <table className="tbl"><thead><tr><th>Date</th><th>Name</th><th>Phone / email</th><th>Message</th><th></th></tr></thead>
            <tbody>{d.enquiries.map((x) => <tr key={x.id}><td>{dTime(x.created_at)}</td><td>{x.name}</td><td>{x.phone} {x.email}</td><td style={{ maxWidth: 420 }}>{x.message}</td><td><AsyncBtn className="link-navy small" onClick={async () => { await api('/admin/enquiries/' + x.id, { method: 'DELETE' }); reload(); }}>Delete</AsyncBtn></td></tr>)}
              {!d.enquiries.length && <tr><td colSpan={5} className="empty">No enquiries.</td></tr>}</tbody></table>
        )}
      </div>
      {cm && (
        <Modal title={`${cm.ticket_no} · ${cm.subject}`} onClose={() => setCm(null)}>
          <div className="small muted">{cm.name} · {cm.mobile} · {cm.email} · {cm.category}{cm.awb ? ` · AWB ${cm.awb}` : ''}{cm.courier ? ` · ${cm.courier}` : ''}</div>
          <div className="note mt8" style={{ whiteSpace: 'pre-wrap' }}>{cm.message}</div>
          {cm.file_id && <a className="link small" href={fileUrl(cm.file_id)} target="_blank">View attachment</a>}
          <div className="field mt12"><label>Status</label><select className="select" value={cm.status} onChange={(e) => setCm({ ...cm, status: e.target.value })}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></div>
          <textarea className="textarea mt12" placeholder="Reply (customer sees this on the status check)" value={cm.reply} onChange={(e) => setCm({ ...cm, reply: e.target.value })} />
          <AsyncBtn className="btn btn-orange mt12" onClick={async () => { await api('/admin/complaints/' + cm.id, { method: 'POST', body: { reply: cm.reply, status: cm.status } }); toast('Saved'); setCm(null); cp.reload(); }}>Save</AsyncBtn>
        </Modal>
      )}
      {t && (
        <Modal title={t.subject} onClose={() => setT(null)}>
          <div className="small muted">{t.customer} · {dTime(t.created_at)}{t.awb && ` · AWB ${t.awb}`}</div>
          <div className="note mt8">{t.message}</div>
          <textarea className="textarea mt12" placeholder="Reply to customer" value={t.reply} onChange={(e) => setT({ ...t, reply: e.target.value })} />
          <div className="row mt12">
            <AsyncBtn onClick={async () => { await api('/admin/tickets/' + t.id, { method: 'POST', body: { reply: t.reply } }); toast('Reply saved'); setT(null); reload(); }}>Send reply</AsyncBtn>
            <AsyncBtn className="btn btn-outline" onClick={async () => { await api('/admin/tickets/' + t.id, { method: 'POST', body: { reply: t.reply, status: t.status === 'open' ? 'closed' : 'open' } }); setT(null); reload(); }}>{t.status === 'open' ? 'Reply & close' : 'Reopen'}</AsyncBtn>
          </div>
        </Modal>
      )}
    </>
  );
}
