'use client';
import RateCalc from '@/components/RateCalc';
import { PageHead } from '@/components/ui';
import { useConfig } from '@/lib/config';
import { inr } from '@/lib/api';

export default function RateCalculatorPage() {
  const cfg = useConfig();
  const zones = cfg ? Object.entries(cfg.zones) : [];
  return (
    <>
      <PageHead title="Rate Calculator" sub="Your final rate (incl. your pricing) before booking — Surface & Express" />
      <div className="split">
        <div className="card"><RateCalc loggedIn /></div>
        <div className="card">
          <div className="card-h"><h3>Zones</h3></div>
          {zones.map(([z, l]) => <div key={z} className="kv"><span>Zone {z}</span><b>{l}</b></div>)}
          <p className="tiny muted mt12">Chargeable weight = higher of actual and volumetric (L×B×H ÷ {cfg?.vol_divisor || 5000}), rounded up to 500 g slabs. GST {cfg?.gst_pct || 18}% extra. COD charges apply on COD shipments.</p>
        </div>
      </div>
    </>
  );
}
