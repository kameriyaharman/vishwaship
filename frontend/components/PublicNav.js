'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Icon from './Icon';
import { getUser } from '@/lib/api';

export default function PublicNav({ content: c = {} }) {
  const [u, setU] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => setU(getUser()), []);
  const dash = u ? (u.role === 'customer' ? '/dashboard/' : '/admin/') : null;
  const links = [['Home', '/'], ['Our Services', '/#services'], ['Book a Shipment', '/book/'], ['Rate Calculator', '/shipping-rate-calculator/'], ['Track Shipment', '/track/'], ['Customer Care', '/customer-care/'], ['Account', dash || '/login/']];
  return (
    <>
      <div className="vs-top"><div className="in"><span>{c.topbar_text || 'From your doorstep. To anywhere in India.'}</span>
        {c.franchise_url && <a href={c.franchise_url}>{c.franchise_label || 'Franchise Login'} <Icon name="arrow" size={14} style={{ transform: 'rotate(-45deg)' }} /></a>}</div></div>
      <header className="vs-head">
        <div className="in" style={{ position: 'relative' }}>
          <Link href="/" className="logo"><img src="/logo-full.png" alt={(c.brand_name || 'vishwaship') + (c.brand_suffix ?? '.com')} /></Link>
          <nav className="vs-nav">{links.map(([l, h]) => <Link key={l} href={h}>{l}</Link>)}</nav>
          <div className="grow" />
          {dash ? <Link href={dash} className="vs-btn sm">Dashboard</Link> : <Link href="/login/" className="vs-btn sm">Login</Link>}
          <button className="vs-burger" aria-label="Menu" onClick={() => setOpen(!open)}><Icon name={open ? 'x' : 'menu'} size={26} /></button>
          <div className={'vs-mnav' + (open ? ' open' : '')}>
            {links.map(([l, h]) => <Link key={l} href={h} onClick={() => setOpen(false)}>{l}</Link>)}
            {!dash && <Link href="/signup/" onClick={() => setOpen(false)} style={{ color: 'var(--orange)' }}>Create an account</Link>}
          </div>
        </div>
      </header>
    </>
  );
}

export function PublicFooter({ content: c = {} }) {
  return (
    <footer className="vs-foot">
      <div className="vs-wrap">
        <div className="cols">
          <div>
            <img src="/logo-full.png" alt="vishwaship.com" style={{ height: 34 }} />
            <p style={{ margin: '18px 0 6px' }}>{c.footer_tag_1}<br />{c.footer_tag_2}</p>
            <p style={{ margin: '14px 0 4px' }}>{c.contact_phone}</p>
            <a href={`mailto:${c.contact_email}`} style={{ color: 'var(--navy)', fontWeight: 700 }}>{c.contact_email} ↗</a>
          </div>
          <div><b>Ship with us</b><Link href="/book/">Book a shipment</Link><Link href="/shipping-rate-calculator/">Rate calculator</Link><Link href="/track/">Track your shipment</Link><Link href="/#services">Courier & cargo services</Link><Link href="/#pricing">Pricing</Link><Link href="/customer-care/">Customer Care & Complaints</Link></div>
          <div><b>Your account</b><Link href="/login/">Customer Login</Link><Link href="/signup/">Create an account</Link>{c.franchise_url && <a href={c.franchise_url}>{c.franchise_label || 'Franchise Login'}</a>}</div>
          <div><b>Policies</b><Link href="/privacy/">Privacy Policy</Link><Link href="/refund-policy/">Refund & Cancellation</Link><Link href="/terms/">Terms & Conditions</Link></div>
        </div>
        <div className="bottom"><span>{c.footer_text}</span><span>{c.contact_hours}</span></div>
        <div className="vs-credit">Developed by <a href="https://customesolution.com" target="_blank" rel="noopener">CustomE Solution</a></div>
      </div>
    </footer>
  );
}
