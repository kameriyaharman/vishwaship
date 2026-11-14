'use client';
import PublicNav, { PublicFooter } from '@/components/PublicNav';
import { useConfig } from '@/lib/config';
export default function Terms() {
  const c = useConfig()?.content || {};
  return (<><PublicNav content={c} /><section className="section" style={{ maxWidth: 820 }}><h2>Terms & shipping policy</h2><div className="card mt16" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{c.terms_text}</div></section><PublicFooter content={c} /></>);
}
