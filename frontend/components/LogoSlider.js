'use client';
import { DEFAULT_LOGOS, logoSrc } from '@/lib/couriers';

export default function LogoSlider({ logos, speed = 45 }) {
  const list = (logos && logos.length ? logos : DEFAULT_LOGOS).filter((l) => l && l.src);
  if (!list.length) return null;
  const row = [...list, ...list];
  return (
    <div className="lslide" aria-label="Courier partners">
      <div className="lslide-track" style={{ animationDuration: `${Math.max(20, list.length * (90 / speed) * 2.2)}s` }}>
        {row.map((l, i) => (
          <div className="lslide-item" key={i} aria-hidden={i >= list.length}>
            <img src={logoSrc(l.src)} alt={l.name || 'Courier partner'} />
          </div>
        ))}
      </div>
    </div>
  );
}
