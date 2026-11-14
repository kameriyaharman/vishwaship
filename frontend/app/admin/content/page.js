'use client';
import { useEffect, useState } from 'react';
import { Spinner, ErrorBox, AsyncBtn, toast, useLoad, PageHead } from '@/components/ui';
import { api, uploadFile } from '@/lib/api';
import { DEFAULT_LOGOS, logoSrc } from '@/lib/couriers';
import { loadConfig } from '@/lib/config';

const ICONS = ['rupee', 'tag', 'truck', 'chart'];

export default function Content() {
  const c = useLoad(() => api('/admin/content'), []);
  const s = useLoad(() => api('/admin/settings'), []);
  const [f, setF] = useState(null);
  const [g, setG] = useState(null);
  const [tab, setTab] = useState('home');
  useEffect(() => { if (c.data) setF(c.data.content); }, [c.data]);
  useEffect(() => { if (s.data) setG({ ...s.data, pickup_slots: (() => { try { return JSON.parse(s.data.pickup_slots).join('\n'); } catch { return ''; } })(), razorpay_key_secret: '' }); }, [s.data]);
  if (c.err || s.err) return <ErrorBox err={c.err || s.err} />;
  if (!f || !g) return <Spinner />;
  const T = (k, l, area) => <div className="field"><label>{l}</label>{area ? <textarea className="textarea" value={f[k] || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} /> : <input className="input" value={f[k] || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}</div>;
  const arr = (k, i, sub, v) => { const a = [...(f[k] || [])]; a[i] = sub ? { ...a[i], [sub]: v } : v; setF({ ...f, [k]: a }); };
  const G = (k, l, t = 'text') => <div className="field"><label>{l}</label><input className="input" type={t} value={g[k] ?? ''} onChange={(e) => setG({ ...g, [k]: e.target.value })} /></div>;
  const saveSite = async () => { await api('/admin/content', { method: 'PUT', body: { content: f } }); await loadConfig(true); toast('Website content saved — live now'); };
  const saveGen = async () => { const b = { ...g, pickup_slots: JSON.stringify(g.pickup_slots.split('\n').map((x) => x.trim()).filter(Boolean)) }; if (!b.razorpay_key_secret) delete b.razorpay_key_secret; delete b.razorpay_secret_set; await api('/admin/settings', { method: 'PUT', body: b }); toast('Settings saved'); s.reload(); };

  return (
    <>
      <PageHead title="Website Content & Settings" sub="Edit everything on the public website and portal-wide settings — changes go live instantly">
        <AsyncBtn onClick={tab === 'gen' ? saveGen : saveSite}>Save changes</AsyncBtn>
      </PageHead>
      <div className="seg mb16" style={{ overflowX: 'auto', maxWidth: '100%' }}>{[['home', 'Home page'], ['care', 'Customer Care page'], ['site', 'Other website text'], ['legal', 'Policies'], ['gen', 'General settings & payments']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'home' && (
        <div className="split">
          <div className="col" style={{ gap: 14 }}>
            <div className="card col"><h3 style={{ fontSize: 15 }}>Top bar & header</h3>
              {T('topbar_text', 'Top bar text')}<div className="grid2">{T('franchise_label', 'Top-right link text')}{T('franchise_url', 'Top-right link URL (blank = hide)')}</div></div>
            <div className="card col"><h3 style={{ fontSize: 15 }}>Hero</h3>
              {T('hero_eyebrow', 'Eyebrow')}<div className="grid3">{T('hero_h1_a', 'Headline line 1')}{T('hero_h1_b', 'Line 2 (navy)')}{T('hero_h1_c', 'Line 2 (orange)')}</div>
              {T('hero_text', 'Text', true)}
              <div className="grid3">{(f.hero_checks || []).map((x, i) => <input key={i} className="input" value={x} onChange={(e) => arr('hero_checks', i, null, e.target.value)} />)}</div>
              {T('hero_image', 'Hero image URL')}
              <div className="field"><label>…or upload hero image</label><input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files[0]; if (!file) return; if (file.size > 900000) { toast('Use an image under 900 KB', true); return; } const r = new FileReader(); r.onload = () => setF({ ...f, hero_image: r.result }); r.readAsDataURL(file); }} /></div>
              {f.hero_image && <img src={f.hero_image} alt="" style={{ width: 160, borderRadius: 10 }} />}
              <div className="grid2">{T('hero_badge_1', 'Photo badge 1')}{T('hero_badge_2', 'Photo badge 2')}{T('hero_tag_1', 'Tagline 1')}{T('hero_tag_2', 'Tagline 2')}</div>
            </div>
            <div className="card col"><h3 style={{ fontSize: 15 }}>Tracking box & partners</h3>
              {T('track_title', 'Tracking title')}{T('track_text', 'Tracking text')}{T('partners_eyebrow', 'Partners heading')}
              <LogoEditor value={f.partner_logos} onChange={(v) => setF({ ...f, partner_logos: v })} />
              {T('partners_note', 'Partners note')}</div>
          </div>
          <div className="col" style={{ gap: 14 }}>
            <div className="card col"><h3 style={{ fontSize: 15 }}>Services</h3>
              {T('services_eyebrow', 'Eyebrow')}<div className="grid2">{T('services_title_1', 'Title line 1')}{T('services_title_2', 'Title line 2')}</div>
              {(f.service_cards || []).map((x, i) => <div key={i} className="note col" style={{ gap: 6 }}><b className="small">Card {i + 1}</b><div className="grid2"><input className="input" value={x.t} onChange={(e) => arr('service_cards', i, 't', e.target.value)} /><input className="input" value={x.cta} onChange={(e) => arr('service_cards', i, 'cta', e.target.value)} /></div><input className="input" value={x.d} onChange={(e) => arr('service_cards', i, 'd', e.target.value)} /></div>)}
            </div>
            <div className="card col"><h3 style={{ fontSize: 15 }}>How it works</h3>
              {T('how_eyebrow', 'Eyebrow')}<div className="grid2">{T('how_title_1', 'Title line 1')}{T('how_title_2', 'Title line 2')}</div>
              {(f.how_steps || []).map((x, i) => <div key={i} className="note col" style={{ gap: 6 }}><div className="grid2"><input className="input" value={x.k} onChange={(e) => arr('how_steps', i, 'k', e.target.value)} /><input className="input" value={x.t} onChange={(e) => arr('how_steps', i, 't', e.target.value)} /></div><input className="input" value={x.d} onChange={(e) => arr('how_steps', i, 'd', e.target.value)} /></div>)}
            </div>
            <div className="card col"><h3 style={{ fontSize: 15 }}>Closing banner & footer</h3>
              {T('cta_eyebrow', 'Eyebrow')}<div className="grid2">{T('cta_title', 'Title')}{T('cta_button', 'Button')}</div>{T('cta_text', 'Text')}
              <div className="grid2">{T('footer_tag_1', 'Footer tagline 1')}{T('footer_tag_2', 'Footer tagline 2')}</div></div>
          </div>
        </div>
      )}
      {tab === 'care' && (
        <div className="split">
          <div className="col" style={{ gap: 14 }}>
            <div className="card col"><h3 style={{ fontSize: 15 }}>Top</h3>{T('care_eyebrow', 'Eyebrow')}{T('care_title', 'Title')}{T('care_text', 'Text', true)}</div>
            <div className="card col"><h3 style={{ fontSize: 15 }}>Support channels</h3>
              {(f.care_channels || []).map((x, i) => <div key={i} className="note col" style={{ gap: 6 }}><input className="input" value={x.t} onChange={(e) => arr('care_channels', i, 't', e.target.value)} /><input className="input" value={x.d} onChange={(e) => arr('care_channels', i, 'd', e.target.value)} /><input className="input" value={x.email} onChange={(e) => arr('care_channels', i, 'email', e.target.value)} /></div>)}
            </div>
            <div className="card col"><h3 style={{ fontSize: 15 }}>Complaint categories</h3>
              <textarea className="textarea" value={(f.complaint_categories || []).join('\n')} onChange={(e) => setF({ ...f, complaint_categories: e.target.value.split('\n') })} /><span className="tiny muted">One per line</span></div>
            <div className="card col"><h3 style={{ fontSize: 15 }}>Head office</h3>{T('head_office_title', 'Title')}{T('head_office_city', 'City line')}{T('head_office_address', 'Full address', true)}{T('head_office_map', 'Google Maps link')}</div>
          </div>
          <div className="card col" style={{ alignSelf: 'start' }}>
            <div className="row between"><h3 style={{ fontSize: 15 }}>Operations team</h3><button className="link small" onClick={() => setF({ ...f, team: [...(f.team || []), { region: 'North', name: '', role: '', phone: '', email: '', bio: '' }] })}>+ Add person</button></div>
            {(f.team || []).map((x, i) => (
              <div key={i} className="note col" style={{ gap: 6 }}>
                <div className="grid2"><select className="select" value={x.region} onChange={(e) => arr('team', i, 'region', e.target.value)}>{['Pan India', 'North', 'South', 'East', 'West'].map((r) => <option key={r}>{r}</option>)}</select><input className="input" placeholder="Name" value={x.name} onChange={(e) => arr('team', i, 'name', e.target.value)} /></div>
                <input className="input" placeholder="Role" value={x.role} onChange={(e) => arr('team', i, 'role', e.target.value)} />
                <div className="grid2"><input className="input" placeholder="Phone" value={x.phone} onChange={(e) => arr('team', i, 'phone', e.target.value)} /><input className="input" placeholder="Email" value={x.email} onChange={(e) => arr('team', i, 'email', e.target.value)} /></div>
                <input className="input" placeholder="Short bio" value={x.bio} onChange={(e) => arr('team', i, 'bio', e.target.value)} />
                <button className="link-navy tiny" style={{ alignSelf: 'flex-end' }} onClick={() => setF({ ...f, team: f.team.filter((_, j) => j !== i) })}>Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === 'legal' && (
        <div className="col" style={{ gap: 14 }}>
          <div className="card">{T('privacy_text', 'Privacy Policy', true)}</div>
          <div className="card">{T('refund_text', 'Refund & Cancellation', true)}</div>
          <div className="card">{T('terms_text', 'Terms & Conditions', true)}</div>
        </div>
      )}
      {tab === 'site' && (
        <div className="split">
          <div className="col" style={{ gap: 14 }}>
            <div className="card col"><h3 style={{ fontSize: 15 }}>Brand & hero</h3>
              <div className="grid2">{T('brand_name', 'Brand name')}{T('brand_suffix', 'Suffix (e.g. .com)')}</div>
              {T('hero_badge', 'Badge text')}{T('hero_title_1', 'Headline line 1')}{T('hero_title_2', 'Headline line 2 (orange)')}{T('hero_sub', 'Sub text', true)}
              <div className="lbl">Hero stats</div>
              {(f.stats || []).map((x, i) => <div key={i} className="grid2"><input className="input" value={x.v} onChange={(e) => arr('stats', i, 'v', e.target.value)} /><input className="input" value={x.l} onChange={(e) => arr('stats', i, 'l', e.target.value)} /></div>)}
            </div>
            <div className="card col"><h3 style={{ fontSize: 15 }}>Feature strip</h3>
              {(f.features || []).map((x, i) => <div key={i} className="grid3" style={{ gridTemplateColumns: '90px 1fr 1.4fr' }}><select className="select" value={x.icon} onChange={(e) => arr('features', i, 'icon', e.target.value)}>{ICONS.map((o) => <option key={o}>{o}</option>)}</select><input className="input" value={x.t} onChange={(e) => arr('features', i, 't', e.target.value)} /><input className="input" value={x.d} onChange={(e) => arr('features', i, 'd', e.target.value)} /></div>)}
              <div className="lbl">How it works (4 steps)</div>
              <div className="grid2">{(f.steps || []).map((x, i) => <input key={i} className="input" value={x} onChange={(e) => arr('steps', i, null, e.target.value)} />)}</div>
            </div>
          </div>
          <div className="col" style={{ gap: 14 }}>
            <div className="card col"><h3 style={{ fontSize: 15 }}>Services section</h3>
              {(f.services || []).map((x, i) => <div key={i} className="grid2" style={{ gridTemplateColumns: '1fr 2fr' }}><input className="input" value={x.t} onChange={(e) => arr('services', i, 't', e.target.value)} /><input className="input" value={x.d} onChange={(e) => arr('services', i, 'd', e.target.value)} /></div>)}
            </div>
            <div className="card col"><h3 style={{ fontSize: 15 }}>Login / sign-up panel</h3>
              <div className="grid2">{T('signup_title_1', 'Title line 1')}{T('signup_title_2', 'Title line 2 (orange)')}</div>
              <div className="grid2">{(f.signup_points || []).map((x, i) => <input key={i} className="input" value={x} onChange={(e) => arr('signup_points', i, null, e.target.value)} />)}</div>
            </div>
            <div className="card col"><h3 style={{ fontSize: 15 }}>Contact & footer</h3>
              <div className="grid2">{T('contact_phone', 'Phone')}{T('contact_email', 'Email')}{T('contact_address', 'Address')}{T('whatsapp', 'WhatsApp number (with 91)')}</div>
              {T('footer_text', 'Footer text')}{T('terms_text', 'Terms & shipping policy', true)}
            </div>
          </div>
        </div>
      )}
      {tab === 'gen' && (
        <div className="split">
          <div className="card col"><h3 style={{ fontSize: 15 }}>Company (for invoices)</h3>
            {G('company_name', 'Company name')}{G('company_gstin', 'GSTIN')}{G('company_address', 'Address')}<div className="grid2">{G('invoice_prefix', 'Invoice prefix')}{G('gst_pct', 'GST %', 'number')}</div>
            <h3 style={{ fontSize: 15 }} className="mt12">Customer rules</h3>
            <label className="check"><input type="checkbox" checked={g.require_kyc === '1'} onChange={(e) => setG({ ...g, require_kyc: e.target.checked ? '1' : '0' })} /> Require verified KYC before booking</label>
            <div className="grid2">{G('min_recharge', 'Minimum recharge (₹)', 'number')}{G('low_wallet_threshold', 'Low wallet alert below (₹)', 'number')}</div>
            <div className="field"><label>Pickup slots (one per line)</label><textarea className="textarea" value={g.pickup_slots} onChange={(e) => setG({ ...g, pickup_slots: e.target.value })} /></div>
          </div>
          <div className="card col" style={{ alignSelf: 'start' }}><h3 style={{ fontSize: 15 }}>Wallet payments</h3>
            <div className="field"><label>Payment gateway</label><select className="select" value={g.payment_gateway} onChange={(e) => setG({ ...g, payment_gateway: e.target.value })}><option value="test">Test mode (credit instantly — for testing only)</option><option value="razorpay">Razorpay (live)</option></select></div>
            {G('razorpay_key_id', 'Razorpay Key ID')}
            <div className="field"><label>Razorpay Key Secret {g.razorpay_secret_set && <span className="green tiny">(saved)</span>}</label><input className="input" type="password" placeholder={g.razorpay_secret_set ? '•••••••• (leave blank to keep)' : ''} value={g.razorpay_key_secret} onChange={(e) => setG({ ...g, razorpay_key_secret: e.target.value })} /></div>
            <p className="tiny muted">Get keys from Razorpay Dashboard → Settings → API Keys. Customers pay by UPI / card / netbanking and the wallet is credited automatically after payment verification.</p>
            <h3 style={{ fontSize: 15 }} className="mt12">Early COD</h3>
            <div className="grid2">{G('early_cod_fee_pct', 'Fee % of COD', 'number')}{G('early_cod_cycle', 'Early cycle text')}</div>
            <h3 style={{ fontSize: 15 }} className="mt12">Buyer notifications</h3>
            <div className="grid2">{G('notif_credit_price', 'Price per credit (₹)', 'number')}{G('notif_provider_name', 'SMS / WhatsApp provider')}</div>
            <label className="check"><input type="checkbox" checked={g.notif_provider_enabled === '1'} onChange={(e) => setG({ ...g, notif_provider_enabled: e.target.checked ? '1' : '0' })} /> Sending is live (provider connected)</label>
            <label className="check"><input type="checkbox" checked={g.cod_confirm_enabled === '1'} onChange={(e) => setG({ ...g, cod_confirm_enabled: e.target.checked ? '1' : '0' })} /> COD confirmation via WhatsApp is live</label>
          </div>
        </div>
      )}
    </>
  );
}

function LogoEditor({ value, onChange }) {
  const list = value && value.length ? value : DEFAULT_LOGOS;
  const [busy, setBusy] = useState(false);
  const set = (a) => onChange(a);
  const move = (i, d) => { const a = [...list]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set(a); };
  const add = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setBusy(true);
    try { const id = await uploadFile(file); set([...list, { name: file.name.replace(/\.[^.]+$/, ''), src: 'file:' + id }]); toast('Logo added — click Save to publish'); }
    catch (er) { toast(er.message, true); } finally { setBusy(false); }
  };
  return (
    <div className="field"><label>Courier logo slider ({list.length} logos · moves on the home page)</label>
      <div className="col" style={{ gap: 6, maxHeight: 360, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 10, padding: 8 }}>
        {list.map((l, i) => (
          <div key={i} className="row" style={{ gap: 8 }}>
            <img src={logoSrc(l.src)} alt="" style={{ width: 70, height: 30, objectFit: 'contain', background: '#fff', border: '1px solid var(--line)', borderRadius: 6, padding: 3 }} />
            <input className="input grow" value={l.name || ''} onChange={(e) => { const a = [...list]; a[i] = { ...l, name: e.target.value }; set(a); }} />
            <button type="button" className="icon-btn" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
            <button type="button" className="icon-btn" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
            <button type="button" className="icon-btn" onClick={() => set(list.filter((_, k) => k !== i))} aria-label="Remove">✕</button>
          </div>
        ))}
      </div>
      <div className="row mt8" style={{ gap: 12 }}>
        <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>{busy ? 'Uploading…' : '+ Upload logo'}<input type="file" accept="image/*" hidden onChange={add} disabled={busy} /></label>
        <button type="button" className="link small" onClick={() => set(DEFAULT_LOGOS)}>Reset to default 23 logos</button>
      </div>
      <div className="tiny muted mt8">PNG/WebP with transparent background works best (max 2 MB).</div>
    </div>
  );
}
