'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Logo } from './ui';
import { getUser } from '@/lib/api';

export default function PublicNav({ content }) {
  const [u, setU] = useState(null);
  useEffect(() => setU(getUser()), []);
  const dash = u ? (u.role === 'customer' ? '/dashboard/' : '/admin/') : null;
  return (
    <div className="pub-nav">
      <div className="in">
        <Link href="/"><Logo brand={content} /></Link>
        <div className="links">
          <a href="/#services">Services</a><a href="/#calculator">Rate calculator</a><Link href="/track/">Track</Link><a href="/#pricing">Pricing</a><a href="/#contact">Contact</a>
        </div>
        <div className="grow" />
        {dash ? (
          <Link href={dash} className="btn btn-orange">Go to dashboard</Link>
        ) : (
          <>
            <Link href="/login/" className="btn btn-ghost-light btn-sm" style={{ padding: '8px 14px' }}>Login</Link>
            <Link href="/signup/" className="btn btn-orange btn-sm" style={{ padding: '8px 14px' }}>Sign up free</Link>
          </>
        )}
      </div>
    </div>
  );
}

export function PublicFooter({ content }) {
  return (
    <footer className="pub-foot" id="contact-foot">
      <div className="in">
        <div><Logo brand={content} /><div className="mt12" style={{ maxWidth: 320 }}>Courier booking for sellers & businesses — powered by the Delhivery network.</div></div>
        <div className="col" style={{ gap: 6 }}>
          <b style={{ color: '#fff' }}>Contact</b>
          <span>{content?.contact_phone}</span><span>{content?.contact_email}</span><span>{content?.contact_address}</span>
        </div>
        <div className="col" style={{ gap: 6 }}>
          <b style={{ color: '#fff' }}>Links</b>
          <Link href="/track/">Track shipment</Link><Link href="/signup/">Create account</Link><Link href="/terms/">Terms & shipping policy</Link>
        </div>
      </div>
      <div className="in mt24 small" style={{ borderTop: '1px solid rgba(255,255,255,.1)', paddingTop: 16 }}>{content?.footer_text}</div>
    </footer>
  );
}
