'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Icon from './Icon';
import { Logo, Spinner, Toaster } from './ui';
import { api, getToken, setToken, setUser, inr, initials } from '@/lib/api';
import { applyTheme, getTheme } from '@/lib/theme';

const Ctx = createContext(null);
export const useShell = () => useContext(Ctx);

const CUSTOMER_NAV = [
  ['MAIN', [['Dashboard', '/dashboard', 'grid'], ['Book Shipment', '/book', 'plus'], ['Orders / Shipments', '/shipments', 'box'], ['Track Order', '/shipment', 'search']]],
  ['ISSUES', [['Weight Discrepancy', '/weight-discrepancy', 'weight'], ['NDR / RTO', '/ndr', 'undo']]],
  ['BILLING', [['Wallet & Recharge', '/wallet', 'wallet'], ['Passbook & Billing', '/billing', 'receipt']]],
  ['TOOLS & REPORTS', [['Rate Calculator', '/rate-calculator', 'rupee'], ['Shipment Price List', '/price-list', 'tag'], ['Reports', '/reports', 'chart'], ['Activity Logs', '/activity', 'clock']]],
  ['SETTINGS', [['Settings', '/settings', 'gear'], ['Warehouse', '/pickup-addresses', 'building'], ['Manage Courier', '/couriers', 'truck'], ['Integrations', '/integrations', 'plug']]],
  ['HELP', [['Contact Us', '/support', 'phone'], ['More', '/more', 'more']]],
];
const BOTTOM = [['Home', '/dashboard', 'home'], ['Orders', '/shipments', 'box'], ['NDR', '/ndr', 'undo'], ['More', '/more', 'more']];
const ADMIN_NAV = [
  ['OVERVIEW', [['Admin Dashboard', '/admin', 'grid', 'dashboard']]],
  ['MANAGE', [['Customers', '/admin/customers', 'users', 'customers'], ['All Shipments', '/admin/shipments', 'box', 'shipments'], ['Weight Disputes', '/admin/disputes', 'weight', 'disputes'], ['NDR / RTO', '/admin/ndr', 'undo', 'ndr']]],
  ['PRICING', [['Rates & Commission', '/admin/rates', 'percent', 'rates']]],
  ['MONEY', [['Wallet & COD', '/admin/wallet', 'wallet', 'wallet'], ['Reports', '/admin/reports', 'chart', 'reports']]],
  ['SYSTEM', [['Courier APIs', '/admin/delhivery', 'code', 'delhivery'], ['Integrations & Keys', '/admin/integrations', 'link', 'content'], ['Staff & Roles', '/admin/staff', 'lock', 'staff'], ['Website Content', '/admin/content', 'globe', 'content'], ['Support Tickets', '/admin/tickets', 'receipt', 'support'], ['Complaints & Enquiries', '/admin/support', 'help', 'support']]],
];

export default function Shell({ admin = false, children }) {
  const path = usePathname();
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [imp, setImp] = useState(false);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState([]);
  const [showNotes, setShowNotes] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [q, setQ] = useState('');

  const refresh = useCallback(async () => {
    const r = await api('/auth/me');
    setMe(r.user); setUser(r.user); setImp(r.impersonating);
    return r.user;
  }, []);

  useEffect(() => {
    if (!getToken()) { router.replace('/login/' + (admin ? '?admin=1' : '')); return; }
    refresh().then((u) => {
      const isAdmin = u.role === 'admin' || u.role === 'staff';
      if (admin && !isAdmin) router.replace('/dashboard/');
      if (!admin && isAdmin) router.replace('/admin/');
      api(admin ? '/admin/notifications' : '/me/notifications').then((n) => setNotes(n.items)).catch(() => {});
    }).catch(() => {});
  }, [admin, refresh, router]);

  useEffect(() => { setOpen(false); setShowNotes(false); setShowMenu(false); }, [path]);
  useEffect(() => { applyTheme(admin ? 'light' : getTheme()); return () => document.documentElement.classList.remove('dark'); }, [admin]);

  if (!me || (admin && me.role === 'customer') || (!admin && me.role !== 'customer')) return <div style={{ paddingTop: 120 }}><Spinner /></div>;

  const can = (perm) => me.role === 'admin' || !perm || (me.permissions || []).includes(perm);
  const nav = admin ? ADMIN_NAV : CUSTOMER_NAV;
  const isOn = (href) => {
    const p = path.replace(/\/$/, '') || '/';
    if (href === '/admin') return p === '/admin';
    if (href === '/shipment') return p === '/shipment';
    return p === href || p.startsWith(href + '/');
  };
  const logout = () => {
    if (imp) { const back = localStorage.getItem('vs_admin_token'); if (back) { setToken(back); localStorage.removeItem('vs_admin_token'); location.href = '/admin/customers/'; return; } }
    setToken(null); setUser(null); location.href = admin ? '/login/?admin=1' : '/login/';
  };
  const search = (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    router.push((admin ? '/admin/shipments/' : '/shipments/') + '?q=' + encodeURIComponent(q.trim()));
  };

  return (
    <Ctx.Provider value={{ me, refresh, admin, can }}>
      <div className="shell">
        <div className={'backdrop' + (open ? ' on' : '')} onClick={() => setOpen(false)} />
        <aside className={'side' + (open ? ' open' : '')}>
          <div className="brand">
            <Link href={admin ? '/admin/' : '/dashboard/'}><Logo /></Link>
            <div className="portal">{admin ? 'ADMIN PORTAL' : 'CUSTOMER PORTAL'}</div>
          </div>
          <nav>
            {nav.map(([grp, items]) => {
              const vis = items.filter((i) => can(i[3]));
              if (!vis.length) return null;
              return (
                <div key={grp}>
                  <div className="grp">{grp}</div>
                  {vis.map(([label, href, icon]) => (
                    <Link key={href} href={href + '/'} className={'item' + (isOn(href) ? ' on' : '')}><Icon name={icon} />{label}</Link>
                  ))}
                </div>
              );
            })}
            <div className="grp"> </div>
            <a className="item" onClick={logout} style={{ cursor: 'pointer' }}><Icon name="logout" />{imp ? 'Back to admin' : 'Logout'}</a>
          </nav>
        </aside>
        <div className="main">
          {imp && <div className="imp-bar">You are viewing as {me.business_name || me.name}. <button className="btn btn-sm btn-navy" onClick={logout}>Back to admin</button></div>}
          <header className="top">
            <button className={'burger' + (!admin ? ' hide-sm' : '')} onClick={() => setOpen(true)} aria-label="Menu"><Icon name="menu" size={22} /></button>
            {!admin && <Link href="/dashboard/" className="show-sm" style={{ flexShrink: 0 }}><img src="/logo-full.png" alt="Vishwaship.com" className="m-logo" /></Link>}
            <form className="search" onSubmit={search}><Icon name="search" size={15} style={{ color: '#9aa0ad' }} /><input placeholder="Search AWB / order ID / phone / customer…" value={q} onChange={(e) => setQ(e.target.value)} /></form>
            {!admin && (
              <Link href="/wallet/" className="walletbtn hide-sm"><Icon name="wallet" size={14} style={{ color: 'var(--orange)' }} />{inr(me.wallet_balance)} <span className="r lbl2">+ Recharge</span></Link>
            )}
            {!admin ? (
              <Link href="/book/" className="btn btn-orange bookbtn hide-sm" style={{ padding: '8px 14px' }}><Icon name="plus" size={15} /><span>Book Shipment</span></Link>
            ) : (
              <Link href="/admin/customers/" className="btn btn-orange bookbtn hide-sm" style={{ padding: '8px 14px' }} title="Login as a customer to book on their behalf"><Icon name="plus" size={15} /><span>Book Shipment</span></Link>
            )}
            <div className="grow" />
            {!admin && (
              <Link href="/support/" className="hdr-ico" title="Support tickets" aria-label="Support tickets"><Icon name="help" size={20} />{notes.filter((n) => (n.href || '').includes('support')).length > 0 && <i>{notes.filter((n) => (n.href || '').includes('support')).length}</i>}</Link>
            )}
            <div style={{ position: 'relative' }}>
              <button className="bell" onClick={() => { setShowNotes(!showNotes); setShowMenu(false); }}><Icon name="bell" size={19} />{notes.length > 0 && notes.length}</button>
              {showNotes && (
                <div className="dropdown">
                  {notes.length === 0 && <div className="muted small" style={{ padding: 12 }}>You're all caught up.</div>}
                  {notes.map((n, i) => <Link key={i} href={n.href.includes('?') ? n.href.replace('?', '/?') : n.href + '/'}>{n.text}</Link>)}
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <button className="row" style={{ background: 'none', border: 0, cursor: 'pointer', gap: 8, textAlign: 'left' }} onClick={() => { setShowMenu(!showMenu); setShowNotes(false); }}>
                <span className="avatar">{initials(admin ? me.name : (me.name))}</span>
                <span className="who"><b>{me.name}</b><span>{admin ? (me.staff_role || (me.role === 'admin' ? 'Super admin' : 'Staff')) : `${me.business_name || 'Customer'} · Customer`}</span></span>
              </button>
              {showMenu && (
                <div className="dropdown" style={{ width: 200 }}>
                  {!admin && <Link href="/settings/">Profile & KYC</Link>}
                  {admin && <Link href="/admin/staff/">My account</Link>}
                  <button className="dd" onClick={logout}>{imp ? 'Back to admin' : 'Logout'}</button>
                </div>
              )}
            </div>
          </header>
          <div className={'content' + (!admin ? ' has-bnav' : '')}>{children}</div>
        </div>
        {!admin && (
          <nav className="bnav">
            {BOTTOM.map(([l, h, ic]) => <Link key={h} href={h + '/'} className={isOn(h) ? 'on' : ''}><span className="bi"><Icon name={ic} size={21} /></span>{l}</Link>)}
          </nav>
        )}
      </div>
      <Toaster />
    </Ctx.Provider>
  );
}
