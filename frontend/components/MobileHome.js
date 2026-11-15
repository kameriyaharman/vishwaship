'use client';
import { useState } from 'react';
import Link from 'next/link';
import Icon from './Icon';
import QuickActions from './QuickActions';
import { Chip } from './ui';
import { inr, dShort } from '@/lib/api';
import { logoSrc } from './RateOption';

const TILES = [
  ['new', 'New Orders', '📦', '/integrations/?tab=oms', 't-blue'],
  ['assigned', 'Pickup Pending', '🗂️', '/shipments/?tab=pickup_pending', 't-amber'],
  ['transit', 'In Transit', '🚚', '/shipments/?tab=in_transit_all', 't-green'],
  ['all', 'All Orders', '🧾', '/shipments/', 't-orange'],
  ['ndr', 'NDR', '↩️', '/ndr/', 't-rose'],
  ['rto', 'RTO', '🔁', '/shipments/?tab=rto', 't-plum'],
];

/** Shipmozo-style mobile home: search, wallet + credits, analytics tiles, recent orders, wallet txns, quick actions */
export default function MobileHome({ d, me }) {
  const [q, setQ] = useState('');
  const L = d.live || {};
  const n = { new: d.drafts, assigned: L.pickup_pending || 0, transit: (L.in_transit || 0) + (L.picked_up || 0) + (L.out_for_delivery || 0), all: d.all_time, ndr: d.ndr_open, rto: d.range_counts?.rto || 0 };
  return (
    <div className="mh">
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) location.href = '/shipments/?q=' + encodeURIComponent(q.trim()); }} className="mh-search">
        <Icon name="search" size={18} /><input placeholder="Search orders, AWB, phone" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      <div className="mh-2">
        <Link href="/wallet/" className="mh-card"><span className="mh-big">👛</span><b>{inr(d.wallet, 2)}</b><span>Wallet Balance</span></Link>
        <Link href="/billing/?view=notif" className="mh-card"><span className="mh-big">🪙</span><b>{d.notif_credits}</b><span>Notification Credits</span></Link>
      </div>
      {me.kyc_status !== 'verified' && <Link href="/settings/?tab=kyc" className="mh-kyc"><Icon name="alert" size={16} />{me.kyc_status === 'submitted' ? 'KYC pending approval — tap to view' : 'Complete your KYC to start shipping'}</Link>}
      <h3 className="mh-h">Analytics</h3>
      <div className="mh-grid">
        {TILES.map(([k, l, e, href, cls]) => <Link key={k} href={href} className={'mh-tile ' + cls}><span className="e">{e}</span><span><b>{n[k] ?? 0}</b><span>{l}</span></span></Link>)}
      </div>
      <div className="mh-box">
        <div className="row between"><h3 className="mh-h" style={{ margin: 0 }}>Recent Orders</h3><Link href="/shipments/" className="link small">View all</Link></div>
        {!d.recent?.length ? <div className="center small muted" style={{ padding: '22px 0' }}>No recent orders found.</div> : d.recent.slice(0, 5).map((s) => (
          <Link key={s.id} href={'/shipment/?id=' + s.id} className="mh-ord">
            <span className="mh-logo">{s.logo ? <img src={logoSrc(s.logo)} alt="" /> : <Icon name="box" size={18} />}</span>
            <span style={{ flex: 1, minWidth: 0 }}><b>{s.to_name}</b><span className="tiny muted" style={{ display: 'block' }}>{s.awb} · {dShort(s.created_at)}</span></span>
            <span style={{ textAlign: 'right' }}><Chip s={s.status_key} label={s.status_label} /><span className="tiny" style={{ display: 'block', marginTop: 3 }}>{inr(s.total)}</span></span>
          </Link>
        ))}
      </div>
      <div className="mh-box">
        <div className="row between"><h3 className="mh-h" style={{ margin: 0 }}>Wallet Transactions</h3><Link href="/billing/?view=passbook" className="link small">View all</Link></div>
        {!d.txns?.length ? <div className="center small muted" style={{ padding: '18px 0' }}>No transactions yet.</div> : d.txns.map((t, i) => (
          <div key={i} className="mh-txn"><span style={{ minWidth: 0 }}><b className="small">{t.description}</b><span className="tiny muted" style={{ display: 'block' }}>{dShort(t.created_at)}</span></span><b className={t.type === 'credit' ? 'green' : 'red'}>{t.type === 'credit' ? '+' : '−'}{inr(t.amount, 2)}</b></div>
        ))}
      </div>
      <QuickActions />
    </div>
  );
}
