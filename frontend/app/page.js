'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import RateCalc from '@/components/RateCalc';
import PublicNav, { PublicFooter } from '@/components/PublicNav';
import { Toaster, toast } from '@/components/ui';
import { useConfig } from '@/lib/config';
import { api, inr } from '@/lib/api';

const FEAT_ICON = { rupee: 'rupee', tag: 'tag', truck: 'truck', chart: 'chart' };

export default function Home() {
  const cfg = useConfig();
  const c = cfg?.content || {};
  const router = useRouter();
  const [tab, setTab] = useState('rate');
  const [awb, setAwb] = useState('');
  const [msg, setMsg] = useState({ name: '', phone: '', email: '', message: '' });

  const sendContact = async (e) => {
    e.preventDefault();
    try { await api('/public/contact', { method: 'POST', body: msg }); toast('Thanks! Our team will contact you shortly.'); setMsg({ name: '', phone: '', email: '', message: '' }); }
    catch (er) { toast(er.message, true); }
  };
  const zones = cfg ? Object.entries(cfg.zones) : [];
  const rate = (svc, z) => cfg?.rates.find((r) => r.service === svc && r.zone === z);

  return (
    <>
      <PublicNav content={c} />
      <section className="hero" id="calculator">
        <div className="hero-ring" />
        <div className="in">
          <div style={{ position: 'relative', zIndex: 2 }}>
            <span className="badge">{c.hero_badge}</span>
            <h1>{c.hero_title_1}<span className="o">{c.hero_title_2}</span></h1>
            <p className="sub">{c.hero_sub}</p>
            <div className="row wrap">
              <Link href="/signup/" className="btn btn-orange btn-lg">Create free account</Link>
              <Link href="/track/" className="btn btn-ghost-light btn-lg">Track a shipment</Link>
            </div>
            <div className="stats3">{(c.stats || []).map((s, i) => <div key={i}><b>{s.v}</b><span>{s.l}</span></div>)}</div>
          </div>
          <div className="calc">
            <div className="seg mb12"><button className={tab === 'rate' ? 'on' : ''} onClick={() => setTab('rate')}>Rate calculator</button><button className={tab === 'track' ? 'on' : ''} onClick={() => setTab('track')}>Track shipment</button></div>
            {tab === 'rate' ? <RateCalc compact /> : (
              <form onSubmit={(e) => { e.preventDefault(); if (awb.trim()) router.push('/track/?awb=' + encodeURIComponent(awb.trim())); }} style={{ padding: '4px 0 8px' }}>
                <div className="field"><label>AWB / tracking number</label><input className="input" placeholder="e.g. 149081108213" value={awb} onChange={(e) => setAwb(e.target.value)} required /></div>
                <button className="btn btn-orange btn-block mt16">Track</button>
                <p className="small muted mt12">Enter the AWB number from your shipping label or the SMS you received.</p>
              </form>
            )}
          </div>
        </div>
      </section>

      <div className="feats">
        {(c.features || []).map((f, i) => (
          <div className="feat" key={i}><span className="ic"><Icon name={FEAT_ICON[f.icon] || 'box'} /></span><div><b>{f.t}</b><span>{f.d}</span></div></div>
        ))}
      </div>
      <div className="steps4">{(c.steps || []).map((s, i) => <div key={i}><i>{i + 1}</i>{s}</div>)}</div>

      <section className="section" id="services">
        <h2>Services</h2>
        <p className="lead">Everything a seller needs to ship across India.</p>
        <div className="grid4">
          {(c.services || []).map((s, i) => <div className="card" key={i}><span className="feat"><span className="ic"><Icon name={['truck', 'arrow', 'rupee', 'undo'][i % 4]} /></span></span><h3 className="mt12" style={{ fontSize: 15 }}>{s.t}</h3><p className="muted small" style={{ marginBottom: 0 }}>{s.d}</p></div>)}
        </div>
      </section>

      <section className="section" id="pricing" style={{ paddingTop: 10 }}>
        <h2>Pricing</h2>
        <p className="lead">Final rates per shipment (before GST). First 500 g, then every additional 500 g.</p>
        <div className="card p0 tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Service</th>{zones.map(([z, l]) => <th key={z}>Zone {z} ({l})</th>)}</tr></thead>
            <tbody>
              {['surface', 'express'].filter((s) => cfg?.service_enabled?.[s]).map((s) => (
                <tr key={s}>
                  <td className="b">{s === 'surface' ? 'Surface' : 'Express (Air)'}<div className="tiny muted">{cfg?.services?.[s]?.days}</div></td>
                  {zones.map(([z]) => { const r = rate(s, z); return <td key={z}>{r ? <><b>{inr(r.final_first)}</b><div className="tiny muted">+{inr(r.final_add)} / 500 g</div></> : '—'}</td>; })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="tiny muted mt8">COD charges, GST and volumetric weight (L×B×H ÷ {cfg?.vol_divisor || 5000}) apply. Exact rate shown before booking.</p>
      </section>

      <section className="section" id="contact" style={{ paddingTop: 10 }}>
        <div className="split">
          <div>
            <h2>Contact us</h2>
            <p className="lead">Questions about rates, COD or bulk shipping? Talk to us.</p>
            <div className="col">
              <span className="row"><Icon name="help" /> {c.contact_phone}</span>
              <span className="row"><Icon name="file" /> {c.contact_email}</span>
              <span className="row"><Icon name="pin" /> {c.contact_address}</span>
              {c.whatsapp && <a className="btn btn-green" style={{ width: 'fit-content' }} href={`https://wa.me/${c.whatsapp}`} target="_blank" rel="noreferrer">Chat on WhatsApp</a>}
            </div>
          </div>
          <form className="card col" onSubmit={sendContact}>
            <div className="grid2"><input className="input" placeholder="Your name" value={msg.name} onChange={(e) => setMsg({ ...msg, name: e.target.value })} required /><input className="input" placeholder="Mobile" value={msg.phone} onChange={(e) => setMsg({ ...msg, phone: e.target.value })} /></div>
            <input className="input" type="email" placeholder="Email" value={msg.email} onChange={(e) => setMsg({ ...msg, email: e.target.value })} />
            <textarea className="textarea" placeholder="How can we help?" value={msg.message} onChange={(e) => setMsg({ ...msg, message: e.target.value })} required />
            <button className="btn btn-orange">Send message</button>
          </form>
        </div>
      </section>
      <PublicFooter content={c} />
      <Toaster />
    </>
  );
}
