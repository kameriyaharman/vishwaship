'use client';
import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import PublicNav, { PublicFooter } from '@/components/PublicNav';
import { Toaster, toast } from '@/components/ui';
import { useConfig } from '@/lib/config';
import { api, readFileB64, dTime } from '@/lib/api';

const REGIONS = ['Pan India', 'North', 'South', 'East', 'West'];
// simple India-shaped region map: positions of region dots (percent)
const DOTS = { 'Pan India': [50, 50], North: [42, 20], South: [48, 82], East: [74, 44], West: [24, 50] };

export default function CustomerCare() {
  const c = useConfig()?.content || {};
  const [f, setF] = useState({ name: '', mobile: '', email: '', category: '', awb: '', courier: '', subject: '', message: '' });
  const [file, setFile] = useState(null);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const [lk, setLk] = useState({ ticket_no: '', email: '' });
  const [st, setSt] = useState(null);
  const [region, setRegion] = useState('Pan India');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const team = c.team || [];
  const cur = team.find((t) => t.region === region) || team[0];

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const body = { ...f };
      if (file) { if (file.size > 5 * 1024 * 1024) throw new Error('Attachment must be under 5 MB'); body.file_data = await readFileB64(file); body.file_mime = file.type; body.file_name = file.name; }
      const r = await api('/public/complaints', { method: 'POST', body });
      setDone(r.ticket_no); setF({ name: '', mobile: '', email: '', category: '', awb: '', courier: '', subject: '', message: '' }); setFile(null);
    } catch (er) { toast(er.message, true); } finally { setBusy(false); }
  };
  const lookup = async (e) => { e.preventDefault(); setSt(null); try { setSt(await api('/public/complaints/lookup', { method: 'POST', body: lk })); } catch (er) { toast(er.message, true); } };
  const scroll = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  const Lbl = ({ children }) => <label style={{ fontWeight: 700, fontSize: 13 }}>{children}</label>;

  return (
    <div className="vs">
      <PublicNav content={c} />
      <section className="vs-hero" style={{ textAlign: 'center' }}>
        <div className="vs-wrap" style={{ display: 'block', padding: '70px 28px' }}>
          <span className="vs-eyebrow"><i />{c.care_eyebrow}</span>
          <h1 className="vs-h1" style={{ fontSize: 54, margin: '20px 0' }}>{c.care_title}</h1>
          <p className="lead2" style={{ margin: '0 auto 30px' }}>{c.care_text}</p>
          <div className="row wrap" style={{ justifyContent: 'center', gap: 14 }}>
            <button className="vs-btn" onClick={() => scroll('complaint')}><Icon name="help" />Raise a Complaint</button>
            <button className="vs-btn" style={{ background: '#fff', color: 'var(--navy)', border: '2px solid var(--navy)' }} onClick={() => scroll('status')}><Icon name="search" />Check Complaint Status</button>
          </div>
        </div>
      </section>

      <section className="vs-sec" style={{ paddingBottom: 40 }}>
        <div className="vs-wrap">
          <span className="vs-eyebrow"><i />Official Support Channels</span>
          <h2 className="vs-h2">Reach the right Vishwaship team</h2>
          <p className="muted" style={{ fontSize: 16 }}>Choose the channel that matches your enquiry so we can help you faster.</p>
          <div className="grid2 mt24">
            {(c.care_channels || []).map((x, i) => (
              <div key={i} className="vs-card" style={{ padding: 28 }}>
                <span className="tile" style={{ width: 54, height: 54 }}><Icon name={i ? 'file' : 'help'} size={24} /></span>
                <h3 style={{ fontSize: 21, margin: '18px 0 8px' }}>{x.t}</h3><p style={{ margin: '0 0 14px' }}>{x.d}</p>
                <a href={`mailto:${x.email}`} style={{ color: 'var(--orange)' }}>{x.email} <Icon name="arrow" size={16} style={{ transform: 'rotate(-45deg)' }} /></a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="vs-sec" id="complaint" style={{ paddingTop: 40 }}>
        <div className="vs-wrap split" style={{ gap: 40, alignItems: 'start' }}>
          <div>
            <span className="vs-eyebrow"><i />Complaint Form</span>
            <h2 className="vs-h2">Raise a Complaint</h2>
            <p className="muted" style={{ fontSize: 16, lineHeight: 1.75 }}>Tell us what happened. If your complaint is about a shipment, keep your AWB or LR number handy.</p>
            {done && <div className="okmsg mt16" style={{ fontSize: 15 }}>Complaint registered. Your ticket ID is <b className="mono">{done}</b> — save it to check status.</div>}
            <a className="vs-link mt16" style={{ marginTop: 18 }} href={`mailto:${c.care_channels?.[0]?.email || c.contact_email}?subject=Complaint`}>Email Your Complaint <Icon name="arrow" size={18} /></a>
          </div>
          <form className="card col" onSubmit={submit} style={{ borderRadius: 22, padding: 26, gap: 12 }}>
            <div className="grid2">
              <div className="field"><Lbl>Full name *</Lbl><input className="input" value={f.name} onChange={set('name')} required /></div>
              <div className="field"><Lbl>Mobile number *</Lbl><input className="input" inputMode="tel" value={f.mobile} onChange={set('mobile')} required /></div>
              <div className="field"><Lbl>Email address *</Lbl><input className="input" type="email" value={f.email} onChange={set('email')} required /></div>
              <div className="field"><Lbl>Complaint category *</Lbl><select className="select" value={f.category} onChange={set('category')} required><option value="">Select a category</option>{(c.complaint_categories || []).map((x) => <option key={x}>{x}</option>)}</select></div>
              <div className="field"><Lbl>AWB or LR number (optional)</Lbl><input className="input" value={f.awb} onChange={set('awb')} /></div>
              <div className="field"><Lbl>Courier company (optional)</Lbl><input className="input" value={f.courier} onChange={set('courier')} /></div>
            </div>
            <div className="field"><Lbl>Subject *</Lbl><input className="input" value={f.subject} onChange={set('subject')} required /></div>
            <div className="field"><Lbl>Describe the issue *</Lbl><textarea className="textarea" value={f.message} onChange={set('message')} required /></div>
            <div className="field"><Lbl>Photo or document (optional, up to 5 MB)</Lbl><input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files[0] || null)} /></div>
            <button className="vs-btn" style={{ justifyContent: 'center' }} disabled={busy}>{busy ? 'Submitting…' : 'Submit Complaint'}</button>
          </form>
        </div>
      </section>

      <section className="vs-sec" id="status" style={{ paddingTop: 0 }}>
        <div className="vs-wrap">
          <div className="vs-trackcard">
            <div><span className="vs-eyebrow"><i />Ticket Lookup</span><h3 className="mt8">Check Complaint Status</h3><p className="muted" style={{ margin: '8px 0 0' }}>Enter your ticket ID and registered email to view your complaint status and our replies.</p></div>
            <form className="col" onSubmit={lookup}>
              <div className="grid2"><input className="input" placeholder="Ticket ID (VSC-…)" value={lk.ticket_no} onChange={(e) => setLk({ ...lk, ticket_no: e.target.value })} required /><input className="input" type="email" placeholder="Registered email" value={lk.email} onChange={(e) => setLk({ ...lk, email: e.target.value })} required /></div>
              <button className="vs-btn" style={{ justifyContent: 'center' }}>Check Status</button>
              {st && (
                <div className="note" style={{ fontSize: 13.5 }}>
                  <div className="row between"><b>{st.ticket_no} · {st.subject}</b><span className={'chip c-' + (st.status === 'resolved' || st.status === 'closed' ? 'delivered' : st.status === 'in_progress' ? 'in_transit' : 'open')}>{st.status.replace('_', ' ')}</span></div>
                  <div className="tiny muted mt8">{st.category} · raised {dTime(st.created_at)}{st.awb ? ` · AWB ${st.awb}` : ''}</div>
                  <div className="mt8"><b>Our reply:</b> {st.reply || 'Our team is looking into it. You will see the reply here.'}</div>
                </div>
              )}
            </form>
          </div>
        </div>
      </section>

      {team.length > 0 && (
        <section className="vs-sec" style={{ paddingTop: 0 }}>
          <div className="vs-wrap">
            <span className="vs-eyebrow"><i />Pan India Operations Network</span>
            <h2 className="vs-h2">Vishwaship Pan India Operations Network</h2>
            <p className="muted" style={{ fontSize: 16 }}>Select a region to see the Vishwaship contact for your area.</p>
            <div className="split mt24" style={{ alignItems: 'stretch' }}>
              <div className="card" style={{ borderRadius: 22, background: 'var(--navy)', position: 'relative', minHeight: 340, overflow: 'hidden' }}>
                <div className="pills" style={{ position: 'relative', zIndex: 2 }}>{REGIONS.filter((r) => team.some((t) => t.region === r)).map((r) => <button key={r} className={'pill' + (region === r ? ' on' : '')} style={region === r ? { background: 'var(--orange)', borderColor: 'var(--orange)' } : { background: 'transparent', color: '#cfd6e4', borderColor: 'rgba(255,255,255,.2)' }} onClick={() => setRegion(r)}>{r}</button>)}</div>
                <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: '60px 20px 20px', width: 'calc(100% - 40px)', height: 'calc(100% - 80px)' }} preserveAspectRatio="xMidYMid meet">
                  {REGIONS.filter((r) => r !== 'Pan India').map((r) => <line key={r} x1="50" y1="50" x2={DOTS[r][0]} y2={DOTS[r][1]} stroke={region === r || region === 'Pan India' ? '#f0712c' : 'rgba(255,255,255,.18)'} strokeWidth="0.8" strokeDasharray="2 1.5" />)}
                  {REGIONS.map((r) => <g key={r} onClick={() => setRegion(r)} style={{ cursor: 'pointer' }}><circle cx={DOTS[r][0]} cy={DOTS[r][1]} r={region === r ? 4 : 2.6} fill={region === r ? '#f0712c' : '#fff'} /><text x={DOTS[r][0]} y={DOTS[r][1] - 6} textAnchor="middle" fontSize="4" fill="#cfd6e4" fontWeight="700">{r.toUpperCase()}</text></g>)}
                </svg>
              </div>
              {cur && (
                <div className="vs-card" style={{ padding: 30 }}>
                  <span className="vs-eyebrow" style={{ letterSpacing: '.12em' }}>{cur.region}</span>
                  <h3 style={{ margin: '14px 0 4px' }}>{cur.name}</h3><div className="b" style={{ color: 'var(--orange)' }}>{cur.role}</div>
                  <p style={{ margin: '14px 0' }}>{cur.bio}</p>
                  <div className="col" style={{ gap: 8, fontWeight: 700 }}><span>{cur.phone}</span><span>{cur.email}</span></div>
                  <div className="row mt16"><a className="vs-btn sm" href={`tel:${(cur.phone || '').replace(/\s/g, '')}`}><Icon name="phone" size={16} />Call</a><a className="vs-btn sm" style={{ background: '#fff', color: 'var(--navy)', border: '2px solid var(--navy)' }} href={`mailto:${cur.email}`}>Email</a></div>
                </div>
              )}
            </div>
            <h3 className="mt24" style={{ fontSize: 24, fontWeight: 800, marginTop: 50 }}>Meet the people behind Vishwaship care</h3>
            <p className="muted">Our leadership team is directly reachable for escalations and regional support.</p>
            <div className="vs-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', marginTop: 20 }}>
              {team.map((t, i) => (
                <div key={i} className="vs-card" style={{ padding: 24 }}>
                  <span className="avatar" style={{ width: 48, height: 48, fontSize: 15, background: 'var(--orange)' }}>{t.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                  <h3 style={{ fontSize: 19, margin: '14px 0 4px' }}>{t.name}</h3><div className="small b" style={{ color: 'var(--orange)' }}>{t.role}</div>
                  <div className="tiny muted mt8">{t.region}</div>
                  <p style={{ fontSize: 14, margin: '10px 0 14px' }}>{t.bio}</p>
                  <div className="small b">{t.phone}<br />{t.email}</div>
                  <div className="row mt12"><a className="btn btn-orange btn-sm" href={`tel:${(t.phone || '').replace(/\s/g, '')}`}>Call</a><a className="btn btn-outline btn-sm" href={`mailto:${t.email}`}>Email</a></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="vs-sec" style={{ paddingTop: 0 }}>
        <div className="vs-wrap split" style={{ gap: 30 }}>
          <div className="vs-card" style={{ padding: 30 }}>
            <span className="vs-eyebrow"><i />Head Office</span>
            <h3>{c.head_office_title}</h3><div className="b">{c.head_office_city}</div><p style={{ marginTop: 12 }}>{c.head_office_address}</p>
            {c.head_office_map ? <a href={c.head_office_map} target="_blank" rel="noreferrer">Open in Google Maps <Icon name="arrow" size={16} style={{ transform: 'rotate(-45deg)' }} /></a> : <span className="small muted">Google Maps link will appear here once the listing is verified.</span>}
          </div>
          <div className="vs-card hl" style={{ padding: 30 }}>
            <span className="vs-eyebrow"><i />Shipment Tracking</span>
            <h3>Where’s your shipment?</h3><p>Track with your AWB number, or log in to see all your shipments.</p>
            <div className="row wrap"><Link href="/track/" className="vs-btn sm">Track Shipment</Link><Link href="/login/" className="vs-link" style={{ fontSize: 14 }}>Log In <Icon name="arrow" size={16} /></Link></div>
          </div>
        </div>
      </section>
      <PublicFooter content={c} />
      <Toaster />
    </div>
  );
}
