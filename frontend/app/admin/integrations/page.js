'use client';
import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { Chip, Spinner, ErrorBox, AsyncBtn, toast, useLoad, PageHead } from '@/components/ui';
import { api } from '@/lib/api';

function Secret({ label, k, f, d, setF, ph }) {
  return (
    <div className="field"><label>{label} {d[k + '_set'] && <span className="green tiny">saved {d[k + '_hint']}</span>}</label>
      <input className="input" type="password" autoComplete="new-password" value={f[k] || ''} placeholder={d[k + '_set'] ? 'leave blank to keep' : ph || ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );
}

export default function AdminIntegrations() {
  const { data: d, err, reload } = useLoad(() => api('/admin/integrations'), []);
  const [f, setF] = useState(null);
  const [ev, setEv] = useState(null);
  const [to, setTo] = useState({ email: '', sms: '', whatsapp: '' });
  const [open, setOpen] = useState(null);
  useEffect(() => { if (d) { const x = { ...d }; ['razorpay_key_secret', 'razorpay_webhook_secret', 'resend_api_key', 'way2sms_api_key', 'way2sms_secret', 'wati_token'].forEach((k) => (x[k] = '')); setF(x); setEv(d.events); } }, [d]);
  if (err) return <ErrorBox err={err} onRetry={reload} />;
  if (!f) return <Spinner />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target.checked ? '1' : '0') : e.target.value });
  const save = async (msg = 'Saved') => {
    const body = {}; Object.keys(f).forEach((k) => { if (!/(_set|_hint)$/.test(k) && !['events', 'event_labels', 'buyer_events', 'razorpay_webhook_url'].includes(k)) body[k] = f[k]; });
    await api('/admin/integrations', { method: 'PUT', body: { ...body, events: ev } }); toast(msg); reload();
  };
  const test = async (p) => { try { await save('Saved'); const r = await api('/admin/integrations/test/' + p, { method: 'POST', body: { to: to[p] || '' } }); toast(r.message); } catch (e) { toast(e.message, true); } };
  const setE = (k, field, v) => setEv({ ...ev, [k]: { ...ev[k], [field]: v } });
  const on = (k) => f[k] === '1';

  return (
    <>
      <PageHead title="Integrations & API Keys" sub="Payments and customer notifications — every key is entered here. Courier APIs are in Courier APIs; store connections are made by customers.">
        <AsyncBtn onClick={() => save('All settings saved')}>Save all</AsyncBtn>
      </PageHead>

      <div className="card mb16" style={{ border: '2px solid var(--navy)' }}>
        <div className="card-h"><h3><Icon name="wallet" />Razorpay — wallet recharge</h3><Chip s={f.payment_gateway === 'razorpay' ? 'connected' : 'pending'} label={f.payment_gateway === 'razorpay' ? 'Live payments' : 'Test mode'} /></div>
        <div className="grid3">
          <div className="field"><label>Payment gateway</label><select className="select" value={f.payment_gateway} onChange={set('payment_gateway')}><option value="test">Off (admin adds balance)</option><option value="razorpay">Razorpay</option></select></div>
          <div className="field"><label>Key ID</label><input className="input" value={f.razorpay_key_id} onChange={set('razorpay_key_id')} placeholder="rzp_live_…" /></div>
          <Secret label="Key secret" k="razorpay_key_secret" f={f} d={d} setF={setF} />
          <Secret label="Webhook secret" k="razorpay_webhook_secret" f={f} d={d} setF={setF} ph="any strong text, same as in Razorpay" />
          <div className="field" style={{ gridColumn: 'span 2' }}><label>Webhook URL (paste in Razorpay)</label><input className="input mono" readOnly value={d.razorpay_webhook_url} onFocus={(e) => e.target.select()} /></div>
        </div>
        <p className="tiny muted">Razorpay Dashboard → Account &amp; Settings → API Keys (generate Live keys). Then Settings → Webhooks → Add: the URL above, your webhook secret, event <b>payment.captured</b>. The wallet is credited after signature check, and again safely by the webhook if the customer closes the page.</p>
        <AsyncBtn className="btn btn-outline btn-sm" onClick={() => test('razorpay')}>Test Razorpay keys</AsyncBtn>
      </div>

      <div className="split mb16">
        <div className="card">
          <div className="card-h"><h3><Icon name="mail" />Email — Resend</h3><Chip s={on('email_enabled') && d.resend_api_key_set ? 'connected' : 'pending'} label={on('email_enabled') && d.resend_api_key_set ? 'On' : 'Off'} /></div>
          <label className="check mb8"><input type="checkbox" checked={on('email_enabled')} onChange={set('email_enabled')} /> Send emails</label>
          <Secret label="Resend API key" k="resend_api_key" f={f} d={d} setF={setF} ph="re_…" />
          <div className="field mt8"><label>From</label><input className="input" value={f.resend_from} onChange={set('resend_from')} placeholder="Vishwaship <noreply@vishwaship.com>" /></div>
          <div className="field mt8"><label>Reply-to (optional)</label><input className="input" value={f.email_reply_to} onChange={set('email_reply_to')} placeholder="support@vishwaship.com" /></div>
            <div className="field mt8"><label>Admin alert email(s) <span className="muted">— new sign-up, KYC to review, new ticket</span></label><input className="input" value={f.admin_alert_email || ''} onChange={set('admin_alert_email')} placeholder="admin@vishwaship.com, ops@vishwaship.com" /></div>
          <p className="tiny muted">resend.com → Domains → add vishwaship.com and add the DNS records in Hostinger; then API Keys → Create.</p>
          <div className="row"><input className="input" placeholder="test email to" value={to.email} onChange={(e) => setTo({ ...to, email: e.target.value })} /><AsyncBtn className="btn btn-outline btn-sm" onClick={() => test('email')}>Send test</AsyncBtn></div>
        </div>
        <div className="card">
          <div className="card-h"><h3><Icon name="phone" />SMS — Way2SMS</h3><Chip s={on('sms_enabled') && d.way2sms_api_key_set ? 'connected' : 'pending'} label={on('sms_enabled') && d.way2sms_api_key_set ? 'On' : 'Off'} /></div>
          <label className="check mb8"><input type="checkbox" checked={on('sms_enabled')} onChange={set('sms_enabled')} /> Send SMS to buyers</label>
          <div className="grid2">
            <Secret label="API key" k="way2sms_api_key" f={f} d={d} setF={setF} />
            <Secret label="Secret key" k="way2sms_secret" f={f} d={d} setF={setF} />
            <div className="field"><label>Sender ID (6 letters)</label><input className="input" value={f.way2sms_sender_id} onChange={set('way2sms_sender_id')} placeholder="VSHIPS" /></div>
            <div className="field"><label>DLT entity ID</label><input className="input" value={f.way2sms_dlt_entity_id} onChange={set('way2sms_dlt_entity_id')} /></div>
            <div className="field"><label>Mode</label><select className="select" value={f.way2sms_usetype} onChange={set('way2sms_usetype')}><option value="prod">Production</option><option value="stage">Stage (test)</option></select></div>
            <div className="field"><label>API URL</label><input className="input" value={f.way2sms_url} onChange={set('way2sms_url')} /></div>
          </div>
          <p className="tiny muted">SMS text must match the DLT-approved template — set the text and DLT template ID per message below.</p>
          <div className="row"><input className="input" placeholder="test mobile" value={to.sms} onChange={(e) => setTo({ ...to, sms: e.target.value })} /><AsyncBtn className="btn btn-outline btn-sm" onClick={() => test('sms')}>Send test</AsyncBtn></div>
        </div>
      </div>

      <div className="card mb16">
        <div className="card-h"><h3><Icon name="chat" />WhatsApp — WATI</h3><Chip s={on('wa_enabled') && d.wati_token_set ? 'connected' : 'pending'} label={on('wa_enabled') && d.wati_token_set ? 'On' : 'Off'} /></div>
        <label className="check mb8"><input type="checkbox" checked={on('wa_enabled')} onChange={set('wa_enabled')} /> Send WhatsApp to buyers</label>
        <div className="grid3">
          <div className="field" style={{ gridColumn: 'span 2' }}><label>API endpoint</label><input className="input" value={f.wati_endpoint} onChange={set('wati_endpoint')} placeholder="https://live-mt-server.wati.io/123456" /></div>
          <Secret label="Access token" k="wati_token" f={f} d={d} setF={setF} ph="Bearer eyJ…" />
        </div>
        <p className="tiny muted">WATI → API Docs: copy the API endpoint and Access token. Create templates in WATI → Broadcast → Templates with parameters named {'{{name}}, {{awb}}, {{order_no}}, {{courier}}, {{seller}}, {{track_url}}'} and set each template name below.</p>
        <div className="row"><input className="input" placeholder="test WhatsApp number" value={to.whatsapp} onChange={(e) => setTo({ ...to, whatsapp: e.target.value })} /><AsyncBtn className="btn btn-outline btn-sm" onClick={() => test('whatsapp')}>Send test (uses "Shipment booked" template)</AsyncBtn></div>
      </div>

      <div className="card mb16">
        <div className="card-h"><h3><Icon name="bell" />Notification messages</h3><span className="tiny muted">Buyer SMS / WhatsApp use the seller’s notification credits and their Shipping Notification settings</span></div>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Event</th><th>Email (seller)</th><th>SMS (buyer)</th><th>WhatsApp (buyer)</th><th /></tr></thead>
          <tbody>{Object.entries(d.event_labels).map(([k, l]) => {
            const buyer = d.buyer_events.includes(k);
            return (
              <tr key={k}>
                <td><b>{l}</b></td>
                <td>{['password_reset', 'password_changed'].includes(k) ? <span className="tiny muted">Always</span> : <input type="checkbox" checked={!!+ev[k].email} onChange={(e) => setE(k, 'email', e.target.checked ? 1 : 0)} />}{k.startsWith('admin_') && <span className="tiny muted"> (to admin)</span>}</td>
                <td>{buyer ? <input type="checkbox" checked={!!+ev[k].sms} onChange={(e) => setE(k, 'sms', e.target.checked ? 1 : 0)} /> : '—'}</td>
                <td>{buyer ? <input type="checkbox" checked={!!+ev[k].wa} onChange={(e) => setE(k, 'wa', e.target.checked ? 1 : 0)} /> : '—'}</td>
                <td><button className="link small" onClick={() => setOpen(open === k ? null : k)}>{open === k ? 'Close' : 'Edit text'}</button></td>
              </tr>
            );
          })}</tbody>
        </table></div>
        {open && (
          <div className="note mt12">
            <b>{d.event_labels[open]}</b>
            <div className="field mt8"><label>Email subject</label><input className="input" value={ev[open].subject} onChange={(e) => setE(open, 'subject', e.target.value)} /></div>
            <div className="field mt8"><label>Message text (email + SMS)</label><textarea className="textarea" value={ev[open].text} onChange={(e) => setE(open, 'text', e.target.value)} /></div>
            {d.buyer_events.includes(open) && <div className="grid2 mt8">
              <div className="field"><label>DLT template ID (SMS)</label><input className="input" value={ev[open].dlt_id} onChange={(e) => setE(open, 'dlt_id', e.target.value)} /></div>
              <div className="field"><label>WATI template name</label><input className="input" value={ev[open].wa_template} onChange={(e) => setE(open, 'wa_template', e.target.value)} placeholder="shipment_booked" /></div>
            </div>}
            <p className="tiny muted mt8">Placeholders: {'{name} {awb} {order_no} {courier} {seller} {track_url} {status} {reason} {support} {amount} {balance} {ticket_no} {message}'}</p>
          </div>
        )}
        <AsyncBtn className="mt12" onClick={() => save('Notification settings saved')}>Save notifications</AsyncBtn>
      </div>
    </>
  );
}
