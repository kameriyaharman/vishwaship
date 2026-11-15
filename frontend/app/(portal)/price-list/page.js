'use client';
import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { Spinner, ErrorBox, useLoad, PageHead } from '@/components/ui';
import { api, inr } from '@/lib/api';

const TABS = [['b2c', 'B2C (Single Package)'], ['b2b', 'B2B (Multiple Package)'], ['intl', 'International'], ['zone', 'Zone Matrix']];
const ZONE_SUB = { A: 'Within City', B: 'Within State / Region', C: 'Metro to Metro', D: 'Rest of India', E: 'North East, J&K' };
const ZONE_DEF = [['A', 'Within City', 'Pickup and delivery pincodes in the same city (same first 3 digits)'], ['B', 'Within State / Region', 'Same state or postal region (same first 2 digits)'],
  ['C', 'Metro to Metro', 'Between metro cities — Delhi NCR, Mumbai, Kolkata, Chennai, Bengaluru, Hyderabad, Pune, Ahmedabad'], ['D', 'Rest of India', 'All other serviceable routes in India'],
  ['E', 'North East, J&K', 'North-Eastern states, Jammu & Kashmir, Ladakh, Andaman & Nicobar and other special zones']];

export default function PriceList() {
  const [tab, setTab] = useState('b2c');
  const { data: d, err, reload } = useLoad(() => api('/me/price-list'), []);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!d) return <Spinner />;
  const services = ['surface', 'express'].filter((s) => d.items.some((r) => r.service === s && !r.disabled));
  const cell = (svc, z, k) => { const r = d.items.find((x) => x.service === svc && x.zone === z); return r ? inr(r[k]) : '—'; };
  const zones = ['A', 'B', 'C', 'D', 'E'];
  return (
    <>
      <PageHead title="Shipment Price List" sub="Base rates for your account (before GST) — every quote and booking shows the final amount incl. GST"><Link href="/rate-calculator/" className="btn btn-orange">Rate calculator</Link></PageHead>
      <div className="row" style={{ justifyContent: 'center' }}><div className="seg mb16" style={{ overflowX: 'auto', maxWidth: '100%' }}>{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div></div>
      {tab === 'b2c' && (
        <>
          <div className="card p0 tbl-wrap">
            <table className="tbl pl-tbl">
              <thead><tr><th>Couriers</th><th>Mode</th><th>Weight</th>{zones.map((z) => <th key={z} className="center">ZONE {z}<div className="tiny" style={{ fontWeight: 500 }}>{ZONE_SUB[z]}</div></th>)}<th>COD Charges / COD %</th><th>Other Charges</th></tr></thead>
              <tbody>
                {services.map((svc) => [['first_500', 'First 0.5 kg'], ['add_500', 'Additional 0.5 kg']].map(([k, l], i) => (
                  <tr key={svc + k} style={i === 0 ? { borderTop: '2px solid var(--line)' } : undefined}>
                    {i === 0 && <td rowSpan={2} className="b">Delhivery {svc === 'express' ? 'Express' : 'Surface'}<div className="tiny muted">{d.services[svc]?.days}</div></td>}
                    {i === 0 && <td rowSpan={2}><span className={'chip c-' + (svc === 'express' ? 'out_for_delivery' : 'in_transit')}>{svc === 'express' ? 'Air' : 'Surface'}</span></td>}
                    <td className="small">{l}</td>
                    {zones.map((z) => <td key={z} className="center b">{cell(svc, z, k)}</td>)}
                    {i === 0 && <td rowSpan={2} className="small">{inr(d.cod_fixed)} or {d.cod_pct}%<div className="tiny muted">whichever is higher</div></td>}
                    {i === 0 && <td rowSpan={2} className="small">RTO: {d.rto_pct === 100 ? 'same as forward' : d.rto_pct + '% of forward'}<div className="tiny muted">GST {d.gst_pct}% extra</div></td>}
                  </tr>
                )))}
                {d.shipmozo && <tr><td className="b">Partner couriers</td><td><span className="chip c-in_transit">Air / Surface</span></td><td colSpan={9} className="small muted">Live rates for Blue Dart, Xpressbees, Ekart, DTDC and more are shown at booking, including your plan pricing.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="card mt12 small">
            <div className="kv"><span>Chargeable weight</span><b>Higher of actual and volumetric weight (L × B × H cm ÷ {d.vol_divisor}), rounded up to 0.5 kg</b></div>
            <div className="kv"><span>Example</span><b>1.2 kg Surface Zone D = first 0.5 kg {cell('surface', 'D', 'first_500')} + 2 × additional {cell('surface', 'D', 'add_500')}</b></div>
          </div>
        </>
      )}
      {(tab === 'b2b' || tab === 'intl') && (
        <div className="card center" style={{ padding: 40 }}>
          <Icon name={tab === 'b2b' ? 'layers' : 'globe'} size={34} style={{ color: 'var(--orange)' }} />
          <h3 className="mt12">{tab === 'b2b' ? 'B2B / multiple-package rates' : 'International shipping rates'}</h3>
          <p className="muted small" style={{ maxWidth: 460, margin: '8px auto 16px' }}>{tab === 'b2b' ? 'Rates for multi-box and heavy B2B consignments (PTL/LTL) are shared on request based on your lanes and volume.' : 'International rates depend on destination country, weight and courier. Request a quote and our team will share your rate card.'}</p>
          <Link href="/support/?new=1&category=Billing%20%26%20Remittance" className="btn btn-orange">Request rate card</Link>
        </div>
      )}
      {tab === 'zone' && (
        <div className="card p0 tbl-wrap">
          <table className="tbl"><thead><tr><th>Zone</th><th>Name</th><th>Applies when</th></tr></thead>
            <tbody>{ZONE_DEF.map(([z, n, t]) => <tr key={z}><td className="b">Zone {z}</td><td className="b">{n}</td><td className="small">{t}</td></tr>)}</tbody></table>
        </div>
      )}
    </>
  );
}
