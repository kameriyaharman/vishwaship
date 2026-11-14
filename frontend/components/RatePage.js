'use client';
import { useState } from 'react';
import Link from 'next/link';
import Icon from './Icon';
import RateCalc from './RateCalc';
import PublicNav, { PublicFooter } from './PublicNav';
import { useConfig } from '@/lib/config';
import { getUser } from '@/lib/api';

export default function RatePage() {
  const cfg = useConfig();
  const c = cfg?.content || {};
  const [mode, setMode] = useState('rate');
  const [awb, setAwb] = useState('');
  const loggedIn = typeof window !== 'undefined' && getUser()?.role === 'customer';
  return (
    <>
      <PublicNav content={c} />
      <section className="hero rp-hero">
        <div className="hero-ring" />
        <div className="in">
          <div>
            <span className="badge">COURIER BOOKING FOR SELLERS &amp; BUSINESSES</span>
            <h1>Ship anywhere in India.<span className="o">Book in 60 seconds.</span></h1>
            <p className="sub">Create your account, check the rate, book the shipment and get your AWB instantly. Track every parcel from one dashboard.</p>
            <div className="row" style={{ gap: 14, flexWrap: 'wrap' }}>
              <Link href={loggedIn ? '/book/' : '/signup/'} className="vs-btn">{loggedIn ? 'Book a shipment' : 'Create free account'}</Link>
              <Link href="/track/" className="vs-btn rp-ghost">Track a shipment</Link>
            </div>
            <div className="stats3">
              <div><b>₹{c.starting_rate || 28}*</b><span>starting rate / 500 g</span></div>
              <div><b>COD</b><span>available</span></div>
              <div><b>24×7</b><span>tracking</span></div>
            </div>
          </div>
          <div className="calc rp-calc">
            <div className="seg mb12">
              <button type="button" className={mode === 'rate' ? 'on' : ''} onClick={() => setMode('rate')}>Rate calculator</button>
              <button type="button" className={mode === 'track' ? 'on' : ''} onClick={() => setMode('track')}>Track shipment</button>
            </div>
            {mode === 'rate' ? <RateCalc compact loggedIn={loggedIn} /> : (
              <form onSubmit={(e) => { e.preventDefault(); if (awb.trim()) location.href = '/track/?awb=' + encodeURIComponent(awb.trim()); }}>
                <div className="field"><label>AWB / Order number</label><input className="input" placeholder="e.g. 1490811089" value={awb} onChange={(e) => setAwb(e.target.value)} required /></div>
                <p className="small muted" style={{ margin: '10px 0 14px' }}>Enter the AWB from your label or SMS to see live status and the full timeline.</p>
                <button className="btn btn-orange btn-block">Track shipment</button>
              </form>
            )}
          </div>
        </div>
      </section>
      <div className="rp-wrap">
      <div className="feats">
        {[['rupee', 'See rate before booking', 'Final price shown upfront — no hidden charges'], ['tag', 'Instant AWB & label', 'Print label, schedule pickup in one click'], ['truck', '19,000+ pincodes*', 'Powered by Delhivery network'], ['chart', 'Live dashboard', 'In transit, delivered, RTO, weight issues']].map(([i, t, s]) => (
          <div className="feat" key={t}><div className="ic"><Icon name={i} size={20} /></div><div><b>{t}</b><span>{s}</span></div></div>
        ))}
      </div>
      <div className="steps4">
        {['Sign up & KYC', 'Add wallet balance', 'Book & get AWB', 'Pickup & track'].map((t, i) => <div key={t}><i>{i + 1}</i>{t}</div>)}
      </div>
      <div style={{ height: 30 }} />
      </div>
      <PublicFooter content={c} />
    </>
  );
}
