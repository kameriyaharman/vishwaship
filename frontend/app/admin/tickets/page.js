'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { Spinner, ErrorBox, useLoad, PageHead, toast, Chip } from '@/components/ui';
import { Thread, StatusChip, Attachments, TICKET_CATEGORIES, TSTATUS } from '@/components/Tickets';
import { api, dTime, qp } from '@/lib/api';

export default function AdminTickets() {
  const [f, setF] = useState({ status: '', category: '', assignee: '', priority: '', q: '' });
  const [dq, setDq] = useState('');
  const [open, setOpen] = useState(null);
  useEffect(() => { const t = setTimeout(() => setDq(f.q), 350); return () => clearTimeout(t); }, [f.q]);
  useEffect(() => { const t = qp('ticket'); if (t) setOpen(+t); }, []);
  const qs = new URLSearchParams(Object.fromEntries(Object.entries({ ...f, q: dq }).filter(([, v]) => v))).toString();
  const { data: d, err, reload } = useLoad(() => api('/admin/tickets?' + qs), [qs]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (open) return <AdminTicket id={open} onBack={() => { setOpen(null); history.replaceState(null, '', '/admin/tickets/'); reload(); }} />;
  return (
    <>
      <PageHead title="Support Tickets" sub="Queue of customer tickets — assign, set priority, reply and resolve" />
      <div className="pills mb12">
        <button className={'pill' + (!f.status ? ' on' : '')} onClick={() => setF({ ...f, status: '' })}>All</button>
        {Object.entries(TSTATUS).map(([k, l]) => <button key={k} className={'pill' + (f.status === k ? ' on' : '')} onClick={() => setF({ ...f, status: k })}>{l} {d?.counts?.[k] || 0}</button>)}
      </div>
      <div className="card mb12 row wrap" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: '1 1 180px' }}><label>Search</label><input className="input" placeholder="Ticket ID / AWB / customer" value={f.q} onChange={set('q')} /></div>
        <div className="field"><label>Category</label><select className="select" value={f.category} onChange={set('category')}><option value="">All</option>{TICKET_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="field"><label>Assignee</label><select className="select" value={f.assignee} onChange={set('assignee')}><option value="">Anyone</option><option value="none">Unassigned</option>{(d?.staff || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div className="field"><label>Priority</label><select className="select" value={f.priority} onChange={set('priority')}><option value="">All</option>{['urgent', 'high', 'normal', 'low'].map((p) => <option key={p}>{p}</option>)}</select></div>
      </div>
      <ErrorBox err={err} onRetry={reload} />
      <div className="card p0 tbl-wrap">
        {!d ? <Spinner /> : (
          <table className="tbl">
            <thead><tr><th>Ticket</th><th>Customer</th><th>Category</th><th>AWB</th><th>Priority</th><th>Assignee</th><th>Status</th><th>Last update</th></tr></thead>
            <tbody>
              {d.items.map((t) => (
                <tr key={t.id} className="click" onClick={() => { setOpen(t.id); history.replaceState(null, '', '/admin/tickets/?ticket=' + t.id); }}>
                  <td className="mono">{t.ticket_no}{t.last_reply_by === 'customer' && ['open', 'in_progress'].includes(t.status) && <span className="chip c-open" style={{ marginLeft: 6 }}>Needs reply</span>}</td>
                  <td>{t.customer}</td><td className="small">{t.category}</td><td className="mono small">{t.awb || '—'}</td><td><Chip s={t.priority} label={t.priority} /></td>
                  <td className="small">{t.assignee || <span className="muted">Unassigned</span>}</td><td><StatusChip s={t.status} label={t.status_label} /></td><td className="small">{dTime(t.updated_at || t.created_at)}</td>
                </tr>
              ))}
              {!d.items.length && <tr><td colSpan={8} className="empty">No tickets match.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function AdminTicket({ id, onBack }) {
  const { data: t, err, reload, setData } = useLoad(() => api('/admin/tickets/' + id), [id]);
  const [reply, setReply] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!t) return <Spinner />;
  const post = async (body, msg) => {
    setBusy(true);
    try { setData(await api('/admin/tickets/' + id, { method: 'POST', body })); if (msg) toast(msg); }
    catch (e) { toast(e.message, true); } finally { setBusy(false); }
  };
  const resolution = res ?? (t.resolution || '');
  return (
    <>
      <button className="link-navy small mb12" onClick={onBack}>← Ticket queue</button>
      <div className="split-2-1" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="row between wrap mb12"><div><div className="mono" style={{ fontSize: 18 }}>{t.ticket_no}</div><div className="small muted">{t.category} · {t.customer} · raised {dTime(t.created_at)}</div></div><StatusChip s={t.status} /></div>
          <Thread t={t} staffView />
          <div className="mt16 col">
            <textarea className="textarea" placeholder="Reply to customer…" value={reply} onChange={(e) => setReply(e.target.value)} />
            <Attachments files={files} setFiles={setFiles} />
            <div className="row wrap" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" disabled={busy || (!reply.trim() && !files.length)} onClick={async () => { await post({ reply, file_ids: files.map((x) => x.id).join(','), status: 'awaiting_customer' }, 'Reply sent'); setReply(''); setFiles([]); }}>Reply & await customer</button>
              <button className="btn btn-orange" disabled={busy || (!reply.trim() && !files.length)} onClick={async () => { await post({ reply, file_ids: files.map((x) => x.id).join(','), status: t.status === 'open' ? 'in_progress' : t.status }, 'Reply sent'); setReply(''); setFiles([]); }}>Send reply</button>
            </div>
          </div>
        </div>
        <div className="col" style={{ gap: 14 }}>
          <div className="card col">
            <div className="field"><label>Status</label><select className="select" value={t.status} onChange={(e) => post({ status: e.target.value }, 'Status updated')}>{Object.entries(t.statuses).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div className="field"><label>Priority</label><select className="select" value={t.priority} onChange={(e) => post({ priority: e.target.value }, 'Priority updated')}>{['low', 'normal', 'high', 'urgent'].map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
            <div className="field"><label>Assignee</label><select className="select" value={t.assignee_id || ''} onChange={(e) => post({ assignee_id: e.target.value }, 'Assignee updated')}><option value="">Unassigned</option>{t.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div className="field"><label>Resolution (shown to customer)</label><textarea className="textarea" style={{ minHeight: 70 }} value={resolution} onChange={(e) => setRes(e.target.value)} /></div>
            <button className="btn btn-green" disabled={busy} onClick={async () => { await post({ resolution, status: 'resolved' }, 'Marked resolved'); setRes(null); }}><Icon name="check" />Mark resolved</button>
          </div>
          <div className="card">
            <h3 style={{ fontSize: 15 }} className="mb12">Customer & shipment</h3>
            <div className="kv"><span>Customer</span><b>{t.customer}</b></div>
            <div className="kv"><span>Contact</span><b className="small">{t.customer_mobile}<br />{t.customer_email}</b></div>
            {t.shipment ? <>
              <div className="kv"><span>AWB</span><b><Link className="link" href={'/admin/shipment/?id=' + t.shipment.id}>{t.shipment.awb}</Link></b></div>
              <div className="kv"><span>Order</span><b>#{t.shipment.order_no}</b></div>
              <div className="kv"><span>Status</span><b>{t.shipment.status.replace(/_/g, ' ')}</b></div>
              <div className="kv"><span>To</span><b>{t.shipment.to_name}, {t.shipment.to_city} {t.shipment.to_pincode}</b></div>
            </> : <div className="kv"><span>Shipment</span><b>—</b></div>}
          </div>
        </div>
      </div>
    </>
  );
}
