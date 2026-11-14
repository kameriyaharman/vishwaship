'use client';
import { Spinner, ErrorBox, useLoad, PageHead, Empty } from '@/components/ui';
import { api, dTime } from '@/lib/api';

export default function Activity() {
  const { data: d, err, reload } = useLoad(() => api('/me/activity'), []);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!d) return <Spinner />;
  return (
    <>
      <PageHead title="Activity Logs" sub="Every login, booking, payment and settings change on your account" />
      <div className="card p0 tbl-wrap">
        <table className="tbl"><thead><tr><th>Time</th><th>Activity</th><th>Details</th><th className="hide-sm">By</th><th className="hide-sm">IP</th></tr></thead>
          <tbody>{d.items.map((a) => <tr key={a.id}><td style={{ whiteSpace: 'nowrap' }}>{dTime(a.created_at)}</td><td className="b">{a.action}</td><td className="small">{a.detail || '—'}</td><td className="hide-sm small">{a.actor ? `${a.actor} (Vishwaship team)` : 'You'}</td><td className="hide-sm small muted">{a.ip}</td></tr>)}
            {!d.items.length && <tr><td colSpan={5}><Empty>No activity yet.</Empty></td></tr>}</tbody></table>
      </div>
    </>
  );
}
