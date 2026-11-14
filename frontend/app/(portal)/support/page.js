'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { Spinner, ErrorBox, useLoad, PageHead, toast, Empty } from '@/components/ui';
import { RaiseTicket, Thread, StatusChip, Attachments, TSTATUS } from '@/components/Tickets';
import { useConfig } from '@/lib/config';
import { api, dTime, qp } from '@/lib/api';

export default function Support() {
  const c = useConfig()?.content || {};
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [raise, setRaise] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => { const t = setTimeout(() => setDq(q), 350); return () => clearTimeout(t); }, [q]);
  useEffect(() => { const t = qp('ticket'); if (t) setOpen(+t); if (qp('new')) setRaise({ ref: qp('ref') || '', category: qp('category') || '' }); }, []);
  const list = useLoad(() => api('/me/tickets?' + new URLSearchParams({ status, q: dq })), [status, dq]);

  if (open) return <TicketView id={open} onBack={() => { setOpen(null); history.replaceState(null, '', '/support/'); list.reload(); }} />;
  return (
    <>
      <PageHead title="Support · My Tickets" sub={`Raise and track tickets · ${c.contact_phone || ''} · ${c.contact_email || ''}`}>
        <button className="btn btn-orange" onClick={() => setRaise({ ref: '', category: '' })}><Icon name="plus" />Raise Ticket</button>
      </PageHead>
      <div className="card mb12 row wrap" style={{ gap: 10 }}>
        <div className="row grow" style={{ minWidth: 200, background: '#f3f3f1', borderRadius: 8, padding: '0 10px' }}><Icon name="search" size={15} style={{ color: '#9aa0ad' }} /><input className="input" style={{ border: 0, background: 'none' }} placeholder="Search by Ticket ID or AWB" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="select" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{Object.entries(TSTATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </div>
      <ErrorBox err={list.err} onRetry={list.reload} />
      <div className="card p0 tbl-wrap">
        {!list.data ? <Spinner /> : (
          <table className="tbl">
            <thead><tr><th>Ticket ID</th><th>Category</th><th>Linked shipment</th><th>Status</th><th>Last update</th><th /></tr></thead>
            <tbody>
              {list.data.items.map((t) => (
                <tr key={t.id} className="click" onClick={() => { setOpen(t.id); history.replaceState(null, '', '/support/?ticket=' + t.id); }}>
                  <td className="mono">{t.ticket_no}{t.unread && <span className="chip c-open" style={{ marginLeft: 6 }}>New reply</span>}</td><td>{t.category}</td>
                  <td className="mono small">{t.awb || '—'}</td><td><StatusChip s={t.status} label={t.status_label} /></td><td className="small">{dTime(t.updated_at || t.created_at)}</td><td className="link small">Open →</td>
                </tr>
              ))}
              {!list.data.items.length && <tr><td colSpan={6}><Empty>No tickets yet. Click “Raise Ticket” if you need help.</Empty></td></tr>}
            </tbody>
          </table>
        )}
      </div>
      <div className="card mt16 row wrap" style={{ gap: 20 }}>
        <a className="row b" href={`tel:${(c.contact_phone || '').replace(/\s/g, '')}`}><Icon name="phone" style={{ color: 'var(--orange)' }} />{c.contact_phone}</a>
        <a className="row b" href={`mailto:${c.contact_email}`}><Icon name="file" style={{ color: 'var(--orange)' }} />{c.contact_email}</a>
        {c.whatsapp && <a className="btn btn-green btn-sm" href={`https://wa.me/${c.whatsapp}`} target="_blank" rel="noreferrer">WhatsApp</a>}
        <span className="small muted">{c.contact_hours}</span>
      </div>
      {raise && <RaiseTicket presetRef={raise.ref} presetCategory={raise.category} onClose={() => setRaise(null)} onDone={(r) => { setRaise(null); list.reload(); setOpen(r.id); history.replaceState(null, '', '/support/?ticket=' + r.id); }} />}
    </>
  );
}

function TicketView({ id, onBack }) {
  const { data: t, err, reload, setData } = useLoad(() => api('/me/tickets/' + id), [id]);
  const [msg, setMsg] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!t) return <Spinner />;
  const send = async () => {
    setBusy(true);
    try { setData(await api(`/me/tickets/${id}/reply`, { method: 'POST', body: { message: msg, file_ids: files.map((x) => x.id).join(',') } })); setMsg(''); setFiles([]); toast('Reply sent'); }
    catch (e) { toast(e.message, true); } finally { setBusy(false); }
  };
  return (
    <>
      <button className="link-navy small mb12" onClick={onBack}>← My tickets</button>
      <div className="split-2-1" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="row between wrap mb12"><div><div className="mono" style={{ fontSize: 18 }}>{t.ticket_no}</div><div className="small muted">{t.category} · raised {dTime(t.created_at)}</div></div><StatusChip s={t.status} label={t.status_label} /></div>
          <Thread t={t} />
          {t.resolution && <div className="okmsg mt12"><b>Resolution:</b> {t.resolution}</div>}
          {t.status === 'resolved' && (
            <div className="note mt12 row between wrap"><span>Issue still not solved?</span>
              <button className="btn btn-outline btn-sm" onClick={async () => { const r = prompt('Tell us what is still wrong (optional)') ?? null; if (r === null) return; try { setData(await api(`/me/tickets/${id}/reopen`, { method: 'POST', body: { reason: r } })); toast('Ticket reopened'); } catch (e) { toast(e.message, true); } }}>Reopen ticket</button></div>
          )}
          {t.status !== 'closed' && (
            <div className="mt16 col">
              <textarea className="textarea" placeholder="Write a reply…" value={msg} maxLength={2000} onChange={(e) => setMsg(e.target.value)} />
              <Attachments files={files} setFiles={setFiles} />
              <button className="btn btn-orange" style={{ alignSelf: 'flex-end' }} disabled={busy || (!msg.trim() && !files.length)} onClick={send}>{busy ? 'Sending…' : 'Send reply'}</button>
            </div>
          )}
        </div>
        <div className="card">
          <h3 style={{ fontSize: 15 }} className="mb12">Details</h3>
          <div className="kv"><span>Status</span><b><StatusChip s={t.status} label={t.status_label} /></b></div>
          <div className="kv"><span>Category</span><b>{t.category}</b></div>
          <div className="kv"><span>Last update</span><b>{dTime(t.updated_at || t.created_at)}</b></div>
          {t.shipment ? <>
            <div className="kv"><span>Shipment</span><b><Link className="link" href={'/shipment/?id=' + t.shipment.id}>{t.shipment.awb}</Link></b></div>
            <div className="kv"><span>Order</span><b>#{t.shipment.order_no}</b></div>
            <div className="kv"><span>To</span><b>{t.shipment.to_name}, {t.shipment.to_city}</b></div>
          </> : <div className="kv"><span>Shipment</span><b>—</b></div>}
        </div>
      </div>
    </>
  );
}
