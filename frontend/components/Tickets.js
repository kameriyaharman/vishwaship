'use client';
import { useRef, useState } from 'react';
import Icon from './Icon';
import { Modal, Chip, toast } from './ui';
import { api, uploadFile, fileUrl, dTime } from '@/lib/api';

export const TICKET_CATEGORIES = ['Shipment Related Issue', 'Pickup Related Issue', 'Tech Related Issue', 'Billing & Remittance', 'Reattempt Shipment', 'Return Shipment',
  'Edit Order Information', 'Proof of Delivery', 'Recharge Issue', 'Lost / Damage / Wrong', 'Panel / Account Related'];
export const SHIPMENT_CATS = ['Shipment Related Issue', 'Pickup Related Issue', 'Reattempt Shipment', 'Return Shipment', 'Edit Order Information', 'Proof of Delivery', 'Lost / Damage / Wrong'];
export const TSTATUS = { open: 'Open', in_progress: 'In Progress', awaiting_customer: 'Awaiting Customer', resolved: 'Resolved', closed: 'Closed' };
const ACCEPT = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,audio/*,video/*';

/** Drag & drop / click attachments. images ≤ 2 MB; audio, video, documents ≤ 5 MB */
export function Attachments({ files, setFiles }) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(0);
  const inp = useRef(null);
  const add = async (list) => {
    for (const f of Array.from(list)) {
      if (files.length + busy >= 5) { toast('Maximum 5 attachments', true); break; }
      setBusy((b) => b + 1);
      try { const id = await uploadFile(f); setFiles((x) => [...x, { id, name: f.name }]); }
      catch (e) { toast(`${f.name}: ${e.message}`, true); }
      finally { setBusy((b) => b - 1); }
    }
  };
  return (
    <div>
      <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
        onClick={() => inp.current?.click()} style={{ border: '1.5px dashed ' + (over ? 'var(--orange)' : '#cfd3dc'), background: over ? 'var(--orange-soft)' : '#fafaf8', borderRadius: 10, padding: 14, textAlign: 'center', cursor: 'pointer' }}>
        <Icon name="upload" style={{ color: 'var(--orange)' }} />
        <div className="small b">{busy ? `Uploading ${busy}…` : 'Drag & drop files here, or click to choose'}</div>
        <div className="tiny muted">Images up to 2 MB · audio, video & documents up to 5 MB each</div>
        <input ref={inp} type="file" multiple accept={ACCEPT} style={{ display: 'none' }} onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      </div>
      {files.length > 0 && <div className="row wrap mt8" style={{ gap: 6 }}>{files.map((f) => <span key={f.id} className="chip c-in_transit">{f.name} <button className="link-navy" onClick={() => setFiles(files.filter((x) => x.id !== f.id))}>×</button></span>)}</div>}
    </div>
  );
}

export function RaiseTicket({ onClose, onDone, presetRef = '', presetCategory = '' }) {
  const [f, setF] = useState({ category: presetCategory || (presetRef ? 'Shipment Related Issue' : ''), reference: presetRef, comment: '' });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);
  const needRef = SHIPMENT_CATS.includes(f.category);
  const submit = async () => {
    setErr('');
    if (!f.category) return setErr('Select a category');
    if (needRef && !f.reference.trim()) return setErr('Order ID or AWB is required for this category');
    if (!f.comment.trim()) return setErr('Comment is required');
    setBusy(true);
    try { const r = await api('/me/tickets', { method: 'POST', body: { ...f, file_ids: files.map((x) => x.id).join(',') } }); setDone(r); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  if (done) return (
    <Modal title="Ticket raised" onClose={() => onDone?.(done)}>
      <div className="center" style={{ padding: '10px 0' }}>
        <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--green-soft)', color: 'var(--green)', display: 'grid', placeItems: 'center', margin: '0 auto 10px' }}><Icon name="check" size={26} sw={3} /></div>
        <div className="small muted">Your Ticket ID</div>
        <div className="mono orange" style={{ fontSize: 26 }}>{done.ticket_no}</div>
        <p className="small">Our support team will reply here. You’ll get a notification on every update.</p>
        <button className="btn btn-orange" onClick={() => onDone?.(done)}>View ticket</button>
      </div>
    </Modal>
  );
  return (
    <Modal title="Raise Ticket" onClose={onClose}>
      <div className="col">
        <div className="field"><label>Select Category <span className="red">*</span></label>
          <select className="select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="">Select category</option>{TICKET_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="field"><label>Order ID / AWB {needRef ? <span className="red">*</span> : <span className="muted">(optional)</span>}</label>
          <input className="input" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="e.g. VS-10482 or 149081108213" /></div>
        <div className="field"><label>Comment <span className="red">*</span></label>
          <textarea className="textarea" maxLength={500} value={f.comment} onChange={(e) => setF({ ...f, comment: e.target.value })} placeholder="Describe the issue" />
          <span className={'tiny ' + (f.comment.length > 480 ? 'red' : 'muted')} style={{ textAlign: 'right' }}>{f.comment.length}/500</span></div>
        <div className="field"><label>Attachments <span className="muted">(optional)</span></label><Attachments files={files} setFiles={setFiles} /></div>
        {err && <div className="err">{err}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-orange" disabled={busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit'}</button></div>
      </div>
    </Modal>
  );
}

/** Conversation thread (customer and admin) */
export function Thread({ t, staffView }) {
  return (
    <div className="col" style={{ gap: 10 }}>
      {t.messages.map((m) => m.kind === 'event' ? (
        <div key={m.id} className="center tiny muted">— {m.message} · {dTime(m.created_at)} —</div>
      ) : (
        <div key={m.id} style={{ alignSelf: (m.author_type === 'staff') === !!staffView ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
          <div style={{ background: m.author_type === 'staff' ? 'var(--navy)' : '#fff', color: m.author_type === 'staff' ? '#fff' : 'var(--navy)', border: '1px solid ' + (m.author_type === 'staff' ? 'var(--navy)' : 'var(--line)'), borderRadius: 12, padding: '10px 12px', whiteSpace: 'pre-wrap', fontSize: 13.5 }}>
            {m.message}
            {m.files?.length > 0 && <div className="row wrap mt8" style={{ gap: 6 }}>{m.files.map((f) => <a key={f.id} href={fileUrl(f.id)} target="_blank" className="chip" style={{ background: m.author_type === 'staff' ? 'rgba(255,255,255,.15)' : 'var(--blue-soft)', color: m.author_type === 'staff' ? '#fff' : 'var(--blue)' }}><Icon name="file" size={12} />{f.name}</a>)}</div>}
          </div>
          <div className="tiny muted" style={{ marginTop: 3, textAlign: (m.author_type === 'staff') === !!staffView ? 'right' : 'left' }}>{m.author_type === 'staff' ? `${staffView ? m.author_name || 'Support' : 'Vishwaship Support'}` : staffView ? 'Customer' : 'You'} · {dTime(m.created_at)}</div>
        </div>
      ))}
    </div>
  );
}

export function StatusChip({ s, label }) {
  const cls = { open: 'open', in_progress: 'in_progress', awaiting_customer: 'awaiting_customer', resolved: 'delivered', closed: 'closed' }[s] || s;
  return <Chip s={cls} label={label || TSTATUS[s] || s} />;
}
