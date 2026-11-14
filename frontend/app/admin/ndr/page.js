'use client';
import Link from 'next/link';
import { Stat, Chip, Spinner, ErrorBox, useLoad, PageHead } from '@/components/ui';
import { api, dShort } from '@/lib/api';

export default function AdminNdr() {
  const { data: d, err, reload } = useLoad(() => api('/admin/ndr'), []);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!d) return <Spinner />;
  const st = d.stats;
  return (
    <>
      <PageHead title="NDR / RTO" sub="All failed deliveries and returns across customers — open a shipment to update its status" />
      <div className="stats">
        <Stat plain icon="alert" title="NDR open" value={st.ndr} sub={`${st.ndr_no_action} without seller action`} subCls="orange" />
        <Stat plain icon="undo" title="RTO in transit" value={st.rto_transit} sub=" " />
        <Stat plain icon="box" title="RTO delivered (this month)" value={st.rto_delivered} sub=" " />
        <Stat plain icon="chart" title="RTO rate (30 days)" value={st.rto_rate + '%'} sub=" " />
      </div>
      <div className="card p0 tbl-wrap mt16">
        <table className="tbl">
          <thead><tr><th>AWB</th><th>Customer</th><th>Receiver</th><th>Attempts</th><th>Reason</th><th>Seller action</th><th>Status</th><th>Updated</th></tr></thead>
          <tbody>
            {d.items.map((s) => (
              <tr key={s.id} className="click" onClick={() => (location.href = '/admin/shipment/?id=' + s.id)}>
                <td className="mono">{s.awb}</td><td>{s.customer}</td><td>{s.to_name}, {s.to_city}</td><td>{s.ndr_attempts || '—'}</td><td>{s.ndr_reason || '—'}</td>
                <td>{s.ndr_action || (s.status === 'ndr' ? <span className="orange small b">Awaiting seller</span> : '—')}</td>
                <td><Chip s={s.status === 'ndr' ? 'ndr' : 'rto'} label={s.status === 'ndr' ? 'NDR' : s.status === 'rto_delivered' ? 'RTO delivered' : 'RTO'} /></td><td>{dShort(s.updated_at)}</td>
              </tr>
            ))}
            {!d.items.length && <tr><td colSpan={8} className="empty">No NDR / RTO shipments.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
