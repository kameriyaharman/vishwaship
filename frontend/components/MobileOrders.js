'use client';
import { useState } from 'react';
import Link from 'next/link';
import Icon from './Icon';
import { LABEL_FORMATS } from './LabelButton';
import { RaiseTicket } from './Tickets';
import { Spinner, toast } from './ui';
import { api, inr, dTime, STATUS } from '@/lib/api';
import QuickActions from './QuickActions';

const TABS = [['all', 'All'], ['pickup_pending', 'Pickup'], ['in_transit', 'In Transit'], ['out_for_delivery', 'Out for Delivery'], ['delivered', 'Delivered'], ['ndr', 'NDR'], ['rto', 'RTO'], ['lost', 'Lost'], ['weight_discrepancy', 'Weight Issue'], ['cancelled', 'Cancelled']];
const ST_COLOR = { pickup_pending: '#b7791f', picked_up: '#2453d6', in_transit: '#2453d6', out_for_delivery: '#6b3fd4', delivered: '#1e7b3a', ndr: '#c2560f', rto_in_transit: '#c62828', rto_delivered: '#c62828', lost: '#2b2f3a', cancelled: '#6b7183', weight_discrepancy: '#c2560f' };

const copy = (t) => { navigator.clipboard?.writeText(String(t)); toast('Copied ' + t); };

export default function MobileOrders({ d, tab, setTab, f, setF, apply, page, setPage, loading, reload, drafts, onDrafts, onBulk, onExport }) {
  const [market, setMarket] = useState('domestic');
  const [filters, setFilters] = useState(false);
  const [menu, setMenu] = useState(null);
  const [ticket, setTicket] = useState(null);
  const c = d?.counts || {};
  const count = (t) => t === 'all' ? c.all : t === 'in_transit' ? (c.in_transit || 0) + (c.picked_up || 0) : c[t];
  const activeFilters = [f.q, f.from, f.to, f.payment, f.state].filter(Boolean).length;

  return (
    <div className="mo">
      <div className="mo-top">
        <div className="mo-seg">
          <button className={market === 'domestic' ? 'on' : ''} onClick={() => setMarket('domestic')}>Domestic</button>
          <button className={market === 'intl' ? 'on' : ''} onClick={() => setMarket('intl')}>International</button>
        </div>
        <button className="mo-icon" aria-label="Filters" onClick={() => setFilters(true)}><Icon name="sliders" size={22} />{activeFilters > 0 && <i>{activeFilters}</i>}</button>
      </div>

      {market === 'intl' ? (
        <div className="card center" style={{ padding: 34, marginTop: 14 }}>
          <Icon name="globe" size={32} style={{ color: 'var(--orange)' }} />
          <h3 className="mt12" style={{ fontSize: 17 }}>International shipping</h3>
          <p className="small muted">Ship to 190+ countries — request your international rate card to get started.</p>
          <Link href="/support/?new=1&category=Billing%20%26%20Remittance" className="btn btn-orange btn-sm">Request rate card</Link>
        </div>
      ) : (
        <>
          <div className="mo-tabs">
            {tab === 'in_transit_all' && <button className="on">In Transit (all)</button>}
            {tab === 'undelivered' && <button className="on">Undelivered</button>}
            {TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{count(k) !== undefined && <span>{count(k)}</span>}</button>)}
          </div>
          <div className="row between" style={{ margin: '10px 2px' }}>
            <span className="small muted">{d ? `${d.total} order${d.total === 1 ? '' : 's'}` : ''}</span>
            <span className="row" style={{ gap: 12 }}>
              {drafts.length > 0 && <button className="link small" onClick={onDrafts}>Drafts ({drafts.length})</button>}
              <button className="link small" onClick={onExport}>Export</button>
            </span>
          </div>
          {!d ? <Spinner /> : (
            <div className="col" style={{ gap: 12, opacity: loading ? .5 : 1 }}>
              {d.items.map((s) => (
                <div key={s.id} className="mo-card">
                  <div className="row between" style={{ gap: 8 }}>
                    <span className="row" style={{ gap: 8, minWidth: 0 }}>
                      <Icon name="box" size={22} />
                      <Link href={'/shipment/?id=' + s.id} className="mo-id">#{s.order_no}</Link>
                      <button className="mo-copy" onClick={() => copy(s.order_no)} aria-label="Copy order ID"><Icon name="copy" size={14} /></button>
                    </span>
                    <span className="row" style={{ gap: 6 }}>
                      <span className="mo-type">(B2C)</span>
                      <button className="mo-more" aria-label="More actions" onClick={() => setMenu(s)}>•••</button>
                    </span>
                  </div>
                  <div className="center mt8">
                    <div className="small">{s.courier_name || `Delhivery ${s.service === 'express' ? 'Express' : 'Surface'}`}</div>
                    <div className="small" style={{ marginTop: 4 }}>AWB: <Link className="mo-awb" href={'/track/?awb=' + encodeURIComponent(s.awb)}>{s.awb}</Link> <button className="mo-copy" style={{ width: 24, height: 24, display: 'inline-grid', verticalAlign: 'middle' }} onClick={() => copy(s.awb)} aria-label="Copy AWB"><Icon name="copy" size={12} /></button></div>
                    <div className="small" style={{ marginTop: 4 }}>Status: <b style={{ color: ST_COLOR[s.status_key] || 'var(--navy)' }}>{s.status_label}</b></div>
                  </div>
                  <div className="mo-sep" />
                  <div className="row between">
                    <span className="row" style={{ gap: 10, minWidth: 0 }}>
                      <Icon name="user" size={26} />
                      <span style={{ minWidth: 0 }}><b style={{ fontSize: 15 }}>{s.to_name}</b><div className="small muted">{s.to_phone}</div></span>
                    </span>
                    <span className="row" style={{ gap: 8 }}>
                      <span className={'mo-pay ' + s.payment_mode}>{s.payment_mode === 'cod' ? 'COD' : s.payment_mode === 'topay' ? 'To Pay' : 'Prepaid'}</span>
                      <b style={{ fontSize: 17 }}>{inr(s.payment_mode === 'cod' ? s.cod_amount : s.invoice_value)}</b>
                    </span>
                  </div>
                  <div className="mo-sep" />
                  <div className="row between" style={{ alignItems: 'flex-end' }}>
                    <div className="small" style={{ lineHeight: 1.6 }}>
                      Order Date: {dTime(s.created_at)}<br />
                      {s.to_city} {s.to_pincode} · {inr(s.total)} incl. GST
                    </div>
                    {s.status !== 'cancelled'
                      ? <a className="mo-label" href={`/label/?id=${s.id}`} target="_blank" onClick={(e) => e.stopPropagation()}>Label</a>
                      : <Link className="mo-label ghost" href={'/shipment/?id=' + s.id}>View</Link>}
                  </div>
                  {s.payment_mode === 'cod' && s.status === 'pickup_pending' && <div className="tiny mt8">WhatsApp COD order confirmation: <Link href="/settings/?tab=cod-confirmation" className="link">Setup</Link></div>}
                </div>
              ))}
              {!d.items.length && <div className="card center small muted" style={{ padding: 30 }}>No orders here. <Link className="link" href="/book/">Book a shipment →</Link></div>}
              {d.total > 50 && (
                <div className="row between small"><button className="btn btn-outline btn-sm" disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>← Prev</button><span>Page {page} / {Math.ceil(d.total / 50)}</span><button className="btn btn-outline btn-sm" disabled={page * 50 >= d.total || loading} onClick={() => setPage(page + 1)}>Next →</button></div>
              )}
            </div>
          )}
        </>
      )}

      <Link href="/ndr/?tab=rto" className="mo-returns"><Icon name="undo" size={15} /> Returns</Link>
      <QuickActions title="Actions" items={[
        ['plus', 'Add Order', 'Create a new shipment', '/book/'],
        ['bolt', 'Quick Add Order', 'Book with fewer fields', '/book/?quick=1'],
        ['file', 'Export Orders', 'Download orders as Excel', null, onExport],
        ['refresh', 'Sync Orders', 'Import new orders from your stores', null, async () => { try { const r = await api('/me/channels'); let n = 0; for (const c of r.items.filter((x) => x.type !== 'custom')) { const s = await api('/me/channels/' + c.id + '/sync', { method: 'POST' }); n += s.imported; } toast(r.items.length ? `${n} new order(s) imported to Drafts` : 'No store connected — Integrations → Order Channels'); reload(); } catch (e) { toast(e.message, true); } }],
        ['layers', 'Bulk Upload', 'Upload orders from CSV', null, onBulk],
        ['receipt', 'Drafts / New Orders', `${drafts.length} saved order(s)`, null, onDrafts],
      ]} />

      {filters && (
        <div className="mo-sheet-bg" onClick={() => setFilters(false)}>
          <div className="mo-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="row between mb12"><b style={{ fontSize: 17 }}>Filters</b><button className="link-navy" onClick={() => setFilters(false)}><Icon name="x" /></button></div>
            <div className="col">
              <div className="field"><label>Search</label><input className="input" placeholder="AWB / order / receiver / phone" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></div>
              <div className="grid2 keep"><div className="field"><label>From date</label><input className="input" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
                <div className="field"><label>To date</label><input className="input" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div></div>
              <div className="field"><label>Payment</label><div className="mo-chips">{[['', 'All'], ['prepaid', 'Prepaid'], ['cod', 'COD']].map(([k, l]) => <button key={k} className={f.payment === k ? 'on' : ''} onClick={() => setF({ ...f, payment: k })}>{l}</button>)}</div></div>
              <div className="field"><label>Destination state</label><select className="select" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })}><option value="">All states</option>{(d?.states || []).map((s) => <option key={s}>{s}</option>)}</select></div>
              <div className="row mt8">
                <button className="btn btn-outline grow" onClick={() => { const z = { q: '', from: '', to: '', payment: '', state: '' }; setF(z); setTimeout(() => apply(), 0); setFilters(false); }}>Clear</button>
                <button className="btn btn-orange grow" onClick={() => { apply(); setFilters(false); }}>Apply</button>
              </div>
              <div className="row mt8" style={{ gap: 14, justifyContent: 'center' }}><button className="link small" onClick={() => { setFilters(false); onBulk(); }}>Bulk upload (CSV)</button><button className="link small" onClick={onExport}>Export Excel</button></div>
            </div>
          </div>
        </div>
      )}

      {menu && (
        <div className="mo-sheet-bg" onClick={() => setMenu(null)}>
          <div className="mo-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="row between mb8"><b>#{menu.order_no}</b><button className="link-navy" onClick={() => setMenu(null)}><Icon name="x" /></button></div>
            <div className="mo-actions">
              <Link href={'/shipment/?id=' + menu.id}><Icon name="search" />Track / details</Link>
              {menu.status !== 'cancelled' && <a href={`/invoice/?shipment=${menu.id}`} target="_blank"><Icon name="receipt" />Download invoice</a>}
              {menu.status !== 'cancelled' && LABEL_FORMATS.map(([k, l]) => <a key={k} href={`/label/?id=${menu.id}&format=${k}`} target="_blank"><Icon name={k === 'thermal' ? 'print' : 'file'} />Label · {l}</a>)}
              <Link href={'/book/?clone=' + menu.id}><Icon name="refresh" />{menu.status === 'cancelled' ? 'Re-book this order' : 'Clone order'}</Link>
              {menu.provider === 'shipmozo' && menu.status !== 'cancelled' && <Link href={'/shipment/?id=' + menu.id}><Icon name="print" />Courier label</Link>}
              <button onClick={() => { setTicket(menu); setMenu(null); }}><Icon name="help" />Raise ticket</button>
              {menu.status === 'pickup_pending' && <button className="red" onClick={async () => { if (!confirm('Cancel this shipment? Amount will be refunded to wallet.')) return; try { await api(`/me/shipments/${menu.id}/cancel`, { method: 'POST' }); toast('Cancelled & refunded'); setMenu(null); reload(); } catch (e) { toast(e.message, true); } }}><Icon name="x" />Cancel shipment</button>}
            </div>
          </div>
        </div>
      )}
      {ticket && <RaiseTicket presetRef={ticket.awb} onClose={() => setTicket(null)} onDone={(r) => { location.href = '/support/?ticket=' + r.id; }} />}
    </div>
  );
}
