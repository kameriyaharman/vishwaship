'use client';
import PublicNav, { PublicFooter } from '@/components/PublicNav';
import { useConfig } from '@/lib/config';
export default function LegalPage({ title, field }) {
  const c = useConfig()?.content || {};
  return (
    <div className="vs"><PublicNav content={c} />
      <div className="vs-legal"><span className="vs-eyebrow">POLICY</span><h1 className="vs-h2" style={{ marginBottom: 24 }}>{title}</h1><div className="card">{c[field] || ''}</div></div>
      <PublicFooter content={c} /></div>
  );
}
