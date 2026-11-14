'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import RateCalc from '@/components/RateCalc';
import PublicNav, { PublicFooter } from '@/components/PublicNav';
import { Toaster } from '@/components/ui';
import { useConfig } from '@/lib/config';
import { inr } from '@/lib/api';

const Arrow = ({ up }) => <Icon name="arrow" size={20} sw={2.4} style={up ? { transform: 'rotate(-45deg)' } : undefined} />;

export default function Home() {
  const cfg = useConfig();
  const c = cfg?.content || {};
  const router = useRouter();
  const [awb, setAwb] = useState('');
  const zones = cfg ? Object.entries(cfg.zones) : [];
  const rate = (svc, z) => cfg?.rates.find((r) => r.service === svc && r.zone === z);
  const cardLinks = ['/book/', '/book/', '/book/'];

  return (
    <div className="vs">
      <PublicNav content={c} />

      <section className="vs-hero">
        <div className="vs-wrap">
          <div>
            <span className="vs-eyebrow"><i />{c.hero_eyebrow}</span>
            <h1 className="vs-h1">{c.hero_h1_a}<br />{c.hero_h1_b} <span className="o">{c.hero_h1_c}
              <svg viewBox="0 0 130 14" preserveAspectRatio="none"><path d="M3 10 C 40 4, 90 3, 127 6" stroke="var(--orange)" strokeWidth="5" fill="none" strokeLinecap="round" /></svg></span></h1>
            <p className="lead2">{c.hero_text}</p>
            <div className="row wrap" style={{ gap: 30 }}>
              <Link href="/login/" className="vs-btn">LOGIN <Arrow /></Link>
              <Link href="/signup/" className="vs-link">CREATE AN ACCOUNT <Arrow /></Link>
            </div>
            <div className="vs-checks">{(c.hero_checks || []).map((x) => <span key={x}><Icon name="check" size={17} sw={2.6} />{x}</span>)}</div>
          </div>
          <div>
            <div className="vs-photo">
              <div className="img">{c.hero_image && <img src={c.hero_image} alt="Courier holding parcels beside a delivery van" />}</div>
              {c.hero_badge_1 && <div className="vs-pill a"><span className="ic"><Icon name="truck" size={18} /></span>{c.hero_badge_1}</div>}
              {c.hero_badge_2 && <div className="vs-pill b"><span className="ic"><Icon name="check" size={18} sw={2.6} /></span>{c.hero_badge_2}</div>}
            </div>
            <div className="vs-tags"><span>{c.hero_tag_1}</span><span>{c.hero_tag_2}</span></div>
          </div>
        </div>
      </section>

      <div className="vs-wrap vs-track" id="track">
        <div className="vs-trackcard">
          <div><h3>{c.track_title}</h3><p className="muted" style={{ margin: '8px 0 0', fontSize: 15 }}>{c.track_text}</p></div>
          <form className="vs-trackform" onSubmit={(e) => { e.preventDefault(); if (awb.trim()) router.push('/track/?awb=' + encodeURIComponent(awb.trim())); }}>
            <input className="input" placeholder="Enter AWB / tracking number" value={awb} onChange={(e) => setAwb(e.target.value)} required />
            <button className="vs-btn" style={{ justifyContent: 'center' }}>Track <Arrow /></button>
          </form>
        </div>
      </div>

      <div className="vs-wrap vs-partners">
        <span className="vs-eyebrow">{c.partners_eyebrow}</span>
        <div className="vs-plist">{(c.partners || []).map((p) => <span key={p}>{p}</span>)}</div>
        <div className="small muted">{c.partners_note}</div>
      </div>

      <section className="vs-sec" id="services">
        <div className="vs-wrap">
          <span className="vs-eyebrow">{c.services_eyebrow}</span>
          <h2 className="vs-h2">{c.services_title_1}<br />{c.services_title_2}</h2>
          <div className="vs-cards">
            {(c.service_cards || []).map((s, i) => (
              <div key={i} className={'vs-card' + (i === 1 ? ' hl' : '')}>
                <span className="n">{String(i + 1).padStart(2, '0')}</span>
                <span className="tile"><Icon name={s.icon || 'box'} size={30} /></span>
                <h3>{s.t}</h3><p>{s.d}</p>
                <Link href={cardLinks[i] || '/book/'}>{s.cta} <Arrow up /></Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="vs-sec" style={{ paddingTop: 0 }} id="calculator">
        <div className="vs-wrap">
          <div className="split" style={{ gap: 40, alignItems: 'start' }}>
            <div>
              <span className="vs-eyebrow">TRANSPARENT PRICING</span>
              <h2 className="vs-h2">Know your rate.<br />Before you book.</h2>
              <p className="muted" style={{ fontSize: 16, lineHeight: 1.75, marginTop: 18 }}>Enter pickup and delivery pincodes with weight and size — see the final price instantly. No hidden charges.</p>
            </div>
            <div className="card" style={{ borderRadius: 22, padding: 26, boxShadow: '0 20px 50px rgba(11,31,58,.08)' }}><RateCalc compact /></div>
          </div>
        </div>
      </section>

      <section className="vs-sec" style={{ paddingTop: 0 }} id="how">
        <div className="vs-wrap">
          <span className="vs-eyebrow">{c.how_eyebrow}</span>
          <h2 className="vs-h2">{c.how_title_1}<br />{c.how_title_2}</h2>
          <div className="vs-steps">
            {(c.how_steps || []).map((s, i) => (
              <div key={i} className="vs-step"><div className="ic"><Icon name={['file', 'box', 'truck'][i] || 'box'} size={24} /></div><small>{s.k}</small><h4>{s.t}</h4><p>{s.d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="vs-sec" style={{ paddingTop: 0 }} id="pricing">
        <div className="vs-wrap">
          <span className="vs-eyebrow">RATE CARD</span>
          <h2 className="vs-h2">Simple, zone-based pricing.</h2>
          <div className="card p0 tbl-wrap vs-pricetbl" style={{ borderRadius: 18 }}>
            <table className="tbl">
              <thead><tr><th>Service</th>{zones.map(([z, l]) => <th key={z}>Zone {z} · {l}</th>)}</tr></thead>
              <tbody>
                {['surface', 'express'].filter((s) => cfg?.service_enabled?.[s]).map((s) => (
                  <tr key={s}><td className="b">{s === 'surface' ? 'Surface' : 'Express'}<div className="tiny muted">{cfg?.services?.[s]?.days}</div></td>
                    {zones.map(([z]) => { const r = rate(s, z); return <td key={z}>{r ? <><b>{inr(r.final_first)}</b><div className="tiny muted">+{inr(r.final_add)} / 500 g</div></> : '—'}</td>; })}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny muted mt8">First 500 g + every additional 500 g, before GST. COD charges and volumetric weight (L×B×H ÷ {cfg?.vol_divisor || 5000}) apply.</p>
        </div>
      </section>

      <div className="vs-wrap">
        <div className="vs-cta">
          <div style={{ position: 'relative', zIndex: 1 }}><span className="vs-eyebrow">{c.cta_eyebrow}</span><h2>{c.cta_title}</h2><p>{c.cta_text}</p></div>
          <Link href="/book/" className="vs-btn" style={{ position: 'relative', zIndex: 1 }}>{c.cta_button} <Arrow /></Link>
        </div>
      </div>

      <PublicFooter content={c} />
      <Toaster />
    </div>
  );
}
