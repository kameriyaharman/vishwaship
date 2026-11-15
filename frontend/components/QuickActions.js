'use client';
import { useState } from 'react';
import Link from 'next/link';
import Icon from './Icon';

export const HOME_ACTIONS = [
  ['wallet', 'Recharge', 'Recharge your wallet', '/wallet/'],
  ['bolt', 'Quick Add Order', 'Add a new quick order', '/book/?quick=1'],
  ['box', 'Add Order', 'Add a new order', '/book/'],
  ['undo', 'Add Return Order', 'Request a reverse pickup', '/support/?new=1&category=Pickup%20%26%20Delivery&return=1'],
  ['rupee', 'Rate Calculator', 'Calculate your shipping rate', '/rate-calculator/'],
  ['search', 'Track Order', 'Track current status of your order', '/track/'],
  ['help', 'Tickets', 'Raise a ticket', '/support/?new=1'],
  ['bell', 'Shipping Notification', 'Configure your shipping notification', '/settings/?tab=notifications'],
];

/** floating ⚡ button with a bottom sheet of actions (mobile, Shipmozo-style) */
export default function QuickActions({ title = 'Quick Actions', items = HOME_ACTIONS }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="qa-fab show-sm-flex" aria-label={title} onClick={() => setOpen(true)}><Icon name="bolt" size={26} /></button>
      {open && (
        <div className="mo-sheet-bg" onClick={() => setOpen(false)}>
          <div className="mo-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="qa-grab" />
            <h3 className="center" style={{ margin: '4px 0 14px', fontSize: 17 }}>{title}</h3>
            <div className="qa-list">
              {items.map(([ic, t, s, href, onClick]) => {
                const inner = <><span className="qa-ic"><Icon name={ic} size={20} /></span><span><b>{t}</b>{s && <span>{s}</span>}</span></>;
                return onClick ? <button key={t} onClick={() => { setOpen(false); onClick(); }}>{inner}</button> : <Link key={t} href={href} onClick={() => setOpen(false)}>{inner}</Link>;
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
