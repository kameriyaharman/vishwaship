'use client';
import { useState } from 'react';
import Icon from '@/components/Icon';
import { Chip, AsyncBtn, toast, useLoad, PageHead } from '@/components/ui';
import { useConfig } from '@/lib/config';
import { api, dTime } from '@/lib/api';

export default function Support() {
  const c = useConfig()?.content || {};
  const t = useLoad(() => api('/me/tickets'), []);
  const [f, setF] = useState({ subject: '', message: '' });
  return (
    <>
      <PageHead title="Contact Us" sub={`We're here to help · ${c.contact_hours || ''}`} />
      <div className="split">
        <div className="col" style={{ gap: 14 }}>
          <div className="card col" style={{ gap: 12, fontWeight: 700 }}>
            <a className="row" href={`tel:${(c.contact_phone || '').replace(/\s/g, '')}`}><Icon name="phone" style={{ color: 'var(--orange)' }} />{c.contact_phone}</a>
            <a className="row" href={`mailto:${c.contact_email}`}><Icon name="file" style={{ color: 'var(--orange)' }} />{c.contact_email}</a>
            <span className="row"><Icon name="pin" style={{ color: 'var(--orange)' }} />{c.contact_address}</span>
            {c.whatsapp && <a className="btn btn-green" style={{ width: 'fit-content' }} href={`https://wa.me/${c.whatsapp}`} target="_blank" rel="noreferrer">Chat on WhatsApp</a>}
          </div>
          <div className="card col">
            <h3 style={{ fontSize: 15 }}>Raise a ticket</h3>
            <input className="input" placeholder="Subject (add AWB if about a shipment)" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
            <textarea className="textarea" placeholder="Describe the issue" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
            <AsyncBtn disabled={!f.subject || !f.message} onClick={async () => { await api('/me/tickets', { method: 'POST', body: f }); toast('Ticket raised'); setF({ subject: '', message: '' }); t.reload(); }}>Submit ticket</AsyncBtn>
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h3>My tickets</h3></div>
          {(t.data?.items || []).map((x) => <div key={x.id} className="kv" style={{ display: 'block' }}><div className="row between"><b className="small">{x.subject}</b><Chip s={x.status} /></div><div className="tiny muted">{dTime(x.created_at)}</div><div className="small mt8">{x.message}</div>{x.reply && <div className="note mt8"><b>Vishwaship:</b> {x.reply}</div>}</div>)}
          {!t.data?.items.length && <p className="small muted">No tickets yet.</p>}
        </div>
      </div>
    </>
  );
}
