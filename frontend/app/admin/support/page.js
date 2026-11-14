'use client';
import { useState } from 'react';
import { Chip, Spinner, ErrorBox, Modal, AsyncBtn, toast, useLoad, PageHead } from '@/components/ui';
import { api, dTime } from '@/lib/api';

export default function Support() {
  const { data: d, err, reload } = useLoad(() => api('/admin/support'), []);
  const [tab, setTab] = useState('t');
  const [t, setT] = useState(null);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!d) return <Spinner />;
  return (
    <>
      <PageHead title="Support & Enquiries" sub="Customer tickets and website contact-form enquiries" />
      <div className="seg mb12"><button className={tab === 't' ? 'on' : ''} onClick={() => setTab('t')}>Tickets ({d.tickets.filter((x) => x.status === 'open').length} open)</button><button className={tab === 'e' ? 'on' : ''} onClick={() => setTab('e')}>Enquiries ({d.enquiries.length})</button></div>
      <div className="card p0 tbl-wrap">
        {tab === 't' ? (
          <table className="tbl"><thead><tr><th>Date</th><th>Customer</th><th>AWB</th><th>Subject</th><th>Status</th><th></th></tr></thead>
            <tbody>{d.tickets.map((x) => <tr key={x.id} className="click" onClick={() => setT({ ...x, reply: x.reply || '' })}><td>{dTime(x.created_at)}</td><td>{x.customer}</td><td className="mono">{x.awb || '—'}</td><td>{x.subject}</td><td><Chip s={x.status} /></td><td className="link small">Open</td></tr>)}
              {!d.tickets.length && <tr><td colSpan={6} className="empty">No tickets.</td></tr>}</tbody></table>
        ) : (
          <table className="tbl"><thead><tr><th>Date</th><th>Name</th><th>Phone / email</th><th>Message</th><th></th></tr></thead>
            <tbody>{d.enquiries.map((x) => <tr key={x.id}><td>{dTime(x.created_at)}</td><td>{x.name}</td><td>{x.phone} {x.email}</td><td style={{ maxWidth: 420 }}>{x.message}</td><td><AsyncBtn className="link-navy small" onClick={async () => { await api('/admin/enquiries/' + x.id, { method: 'DELETE' }); reload(); }}>Delete</AsyncBtn></td></tr>)}
              {!d.enquiries.length && <tr><td colSpan={5} className="empty">No enquiries.</td></tr>}</tbody></table>
        )}
      </div>
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
