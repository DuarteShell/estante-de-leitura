import type { CSSProperties } from 'react';
/** Ilustrações originais: plantinhas, vasos e poeirinha de luz. */

export function HangingPlant({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg width="120" height="170" viewBox="0 0 120 170" aria-hidden="true" className={className} style={style}>
      <line x1="60" y1="0" x2="60" y2="38" stroke="#7A5235" strokeWidth="1.5" />
      <g className="sway">
        <ellipse cx="48" cy="34" rx="12" ry="6" fill="#8FA876" transform="rotate(-35 48 34)" />
        <ellipse cx="72" cy="32" rx="12" ry="6" fill="#6E8B5E" transform="rotate(30 72 32)" />
        <ellipse cx="60" cy="28" rx="6" ry="11" fill="#A3B18A" />
        <path d="M34 42 h52 l-7 30 h-38 z" fill="#B88A5E" />
        <rect x="31" y="38" width="58" height="9" rx="4" fill="#7A5235" />
        <path d="M44 70 C 36 92, 46 112, 34 140" stroke="#6E8B5E" strokeWidth="2" fill="none" />
        <ellipse cx="40" cy="88" rx="8" ry="4" fill="#8FA876" transform="rotate(-30 40 88)" />
        <ellipse cx="46" cy="106" rx="8" ry="4" fill="#6E8B5E" transform="rotate(25 46 106)" />
        <ellipse cx="37" cy="126" rx="8" ry="4" fill="#A3B18A" transform="rotate(-25 37 126)" />
        <path d="M76 70 C 84 88, 76 102, 84 120" stroke="#6E8B5E" strokeWidth="2" fill="none" />
        <ellipse cx="82" cy="86" rx="7" ry="4" fill="#A3B18A" transform="rotate(30 82 86)" />
        <ellipse cx="78" cy="104" rx="7" ry="4" fill="#8FA876" transform="rotate(-30 78 104)" />
      </g>
      <circle cx="18" cy="60" r="2" fill="#D9B88F" />
      <circle cx="100" cy="150" r="2.5" fill="#D9B88F" />
      <circle cx="12" cy="130" r="1.5" fill="#D9B88F" />
    </svg>
  );
}

export function PottedPlant({ size = 54, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 54 64" aria-hidden="true" className={className}>
      {/* folhas pontudas saindo da terra, cada uma com caule e nervura */}
      {(
        [
          [-62, 17, '#6E8B5E'],
          [62, 16, '#6E8B5E'],
          [-30, 24, '#8FA876'],
          [32, 23, '#8FA876'],
          [-4, 30, '#A3B18A']
        ] as [number, number, string][]
      ).map(([angle, len, color], i) => (
        <g key={i} transform={`translate(27 34) rotate(${angle})`}>
          <path d={`M0 0 V${-len * 0.25}`} stroke="#5E7A4F" strokeWidth="1.4" strokeLinecap="round" />
          <path
            d={`M0 ${-len * 0.22} C ${len * 0.3} ${-len * 0.4}, ${len * 0.28} ${-len * 0.8}, 0 ${-len} C ${-len * 0.28} ${-len * 0.8}, ${-len * 0.3} ${-len * 0.4}, 0 ${-len * 0.22} Z`}
            fill={color}
          />
          <path d={`M0 ${-len * 0.26} V${-len * 0.88}`} stroke="#FBF8EF" strokeOpacity="0.45" strokeWidth="0.9" strokeLinecap="round" />
        </g>
      ))}
      <path d="M12 36 h30 l-4 24 a3 3 0 0 1 -3 2.5 h-16 a3 3 0 0 1 -3 -2.5 z" fill="#B88A5E" />
      <path d="M13.5 43 h27" stroke="#A47650" strokeWidth="1" />
      <rect x="10" y="32" width="34" height="6" rx="3" fill="#7A5235" />
      <ellipse cx="27" cy="32.5" rx="14" ry="1.6" fill="#4A3221" />
    </svg>
  );
}

export function ShelfPlant() {
  return (
    <svg width="52" height="78" viewBox="0 0 52 78" aria-hidden="true" className="shelf-deco">
      <path d="M26 44 C 22 30, 14 22, 6 18" stroke="#6E8B5E" strokeWidth="1.5" fill="none" />
      <ellipse cx="10" cy="22" rx="9" ry="4" fill="#8FA876" transform="rotate(30 10 22)" />
      <ellipse cx="40" cy="20" rx="10" ry="4.5" fill="#6E8B5E" transform="rotate(-35 40 20)" />
      <ellipse cx="26" cy="16" rx="5" ry="13" fill="#A3B18A" />
      <ellipse cx="17" cy="34" rx="8" ry="4" fill="#6E8B5E" transform="rotate(25 17 34)" />
      <ellipse cx="36" cy="34" rx="8" ry="4" fill="#8FA876" transform="rotate(-25 36 34)" />
      <path d="M12 48 h28 l-4 30 h-20 z" fill="#C4855E" />
      <rect x="10" y="45" width="32" height="7" rx="3" fill="#A7643F" />
    </svg>
  );
}

export function ShelfStack() {
  return (
    <div aria-hidden="true" className="shelf-deco" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ width: 18, height: 22, borderRadius: '50% 50% 4px 4px', background: '#F6E9C9', border: '1px solid #D9B88F' }} />
      <div style={{ width: 64, height: 12, borderRadius: 2, background: '#6E8B5E' }} />
      <div style={{ width: 72, height: 14, borderRadius: 2, background: '#C9A57E' }} />
      <div style={{ width: 68, height: 12, borderRadius: 2, background: '#5C3D26' }} />
    </div>
  );
}

export function Vine({ style }: { style?: CSSProperties }) {
  return (
    <svg width="140" height="120" viewBox="0 0 140 120" aria-hidden="true" style={style}>
      <path d="M140 10 C 110 20, 95 40, 90 70" stroke="#6E8B5E" strokeWidth="2" fill="none" />
      <ellipse cx="118" cy="22" rx="12" ry="5" fill="#8FA876" transform="rotate(-20 118 22)" />
      <ellipse cx="102" cy="40" rx="11" ry="5" fill="#A3B18A" transform="rotate(-50 102 40)" />
      <ellipse cx="94" cy="60" rx="10" ry="5" fill="#6E8B5E" transform="rotate(-75 94 60)" />
      <ellipse cx="112" cy="50" rx="9" ry="4" fill="#8FA876" transform="rotate(20 112 50)" />
      <circle cx="70" cy="30" r="2" fill="#D9B88F" />
      <circle cx="60" cy="80" r="1.5" fill="#D9B88F" />
    </svg>
  );
}

export function HeroLandscape() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 390 230" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
      <circle cx="320" cy="56" r="36" fill="#F6E9C9" opacity="0.85" />
      <path d="M0 180 Q 90 130, 190 170 T 390 150 V230 H0 Z" fill="#C5D2B4" />
      <path d="M0 205 Q 120 175, 230 200 T 390 190 V230 H0 Z" fill="#A3B18A" />
      <path d="M30 0 C 40 40, 30 70, 50 110" stroke="#6E8B5E" strokeWidth="2" fill="none" />
      <ellipse cx="38" cy="30" rx="11" ry="5" fill="#8FA876" transform="rotate(60 38 30)" />
      <ellipse cx="44" cy="62" rx="11" ry="5" fill="#6E8B5E" transform="rotate(-60 44 62)" />
      <ellipse cx="46" cy="96" rx="11" ry="5" fill="#A3B18A" transform="rotate(50 46 96)" />
      <circle cx="110" cy="70" r="2.5" fill="#FBF8EF" />
      <circle cx="270" cy="120" r="2" fill="#FBF8EF" />
      <circle cx="80" cy="140" r="1.5" fill="#FBF8EF" />
      <circle cx="350" cy="110" r="2" fill="#FBF8EF" />
    </svg>
  );
}

export function ShelfCactus() {
  return (
    <svg width="44" height="80" viewBox="0 0 44 80" aria-hidden="true" className="shelf-deco">
      <path d="M22 50 V20 a7 7 0 0 1 14 0 V50 z" fill="#6E8B5E" transform="translate(-7 0)" />
      <path d="M10 40 V30 a4 4 0 0 1 8 0 V44" fill="#7F9C6C" />
      <path d="M26 36 V26 a4 4 0 0 1 8 0 V40" fill="#7F9C6C" />
      <path d="M22 18 V48 M18 22 V46 M26 22 V46" stroke="#5E7A4F" strokeWidth="0.8" />
      <circle cx="22" cy="12.5" r="3" fill="#E7A7A0" />
      <path d="M8 52 h28 l-3 26 h-22 z" fill="#E0C49C" />
      <rect x="6" y="49" width="32" height="6" rx="3" fill="#C9A57E" />
    </svg>
  );
}

export function ShelfFrame() {
  return (
    <svg width="58" height="72" viewBox="0 0 58 72" aria-hidden="true" className="shelf-deco">
      <rect x="4" y="6" width="50" height="62" rx="3" fill="#9C6B43" />
      <rect x="9" y="11" width="40" height="52" rx="1.5" fill="#F6E9C9" />
      <circle cx="38" cy="24" r="5" fill="#E2B04A" opacity="0.8" />
      <path d="M9 50 Q 22 36, 34 46 T 49 42 V63 H9 Z" fill="#A3B18A" />
      <path d="M9 56 Q 26 48, 49 54 V63 H9 Z" fill="#6E8B5E" />
      <path d="M20 72 L26 64 M38 72 L32 64" stroke="#5C3D26" strokeWidth="2" />
    </svg>
  );
}

export function ShelfMug() {
  return (
    <svg width="54" height="62" viewBox="0 0 54 62" aria-hidden="true" className="shelf-deco">
      <path d="M18 10 c-4 5, 4 8, 0 14 M26 6 c-4 6, 4 9, 0 16" stroke="#C9B89A" strokeWidth="1.8" fill="none" strokeLinecap="round" className="steam" />
      <path d="M8 28 h30 v22 a8 8 0 0 1 -8 8 h-14 a8 8 0 0 1 -8 -8 z" fill="#C4855E" />
      <path d="M38 33 h4 a6 6 0 0 1 0 12 h-4" stroke="#C4855E" strokeWidth="4" fill="none" />
      <path d="M8 36 h30" stroke="#F6E9C9" strokeWidth="2" opacity="0.6" />
      <ellipse cx="23" cy="60" rx="18" ry="2" fill="#5C3D26" opacity="0.25" />
    </svg>
  );
}

/** vela aromática num pote de vidro, acesa */
export function ShelfCandle() {
  return (
    <svg width="52" height="80" viewBox="0 0 52 80" aria-hidden="true" className="shelf-deco">
      {/* fumacinha perfumada */}
      <path d="M24 19 c-4 -3, 4 -6, 0 -9 c-3 -3, 3 -5, 1 -9" stroke="#D9B8AE" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.75" className="steam" />
      {/* chama */}
      <g className="flame">
        <path d="M24 22 c5 6, 5 12, 0 16 c-5 -4, -5 -10, 0 -16 z" fill="#E2B04A" />
        <path d="M24 29 c2 3, 2 6, 0 8 c-2 -2, -2 -5, 0 -8 z" fill="#F7E3B0" />
      </g>
      <path d="M24 37 v6" stroke="#4A3221" strokeWidth="1.4" strokeLinecap="round" />
      {/* pote de vidro com cera */}
      <path d="M8 42 h32 v30 a6 6 0 0 1 -6 6 h-20 a6 6 0 0 1 -6 -6 z" fill="#C46A4A" />
      <ellipse cx="24" cy="44" rx="16" ry="2.4" fill="#D98A6C" />
      <path d="M6 38 h36 v34 a8 8 0 0 1 -8 8 h-20 a8 8 0 0 1 -8 -8 z" fill="#FBF8EF" fillOpacity="0.18" stroke="#5C3D26" strokeWidth="1.4" />
      <path d="M6 38 h36" stroke="#5C3D26" strokeWidth="1.4" />
      <path d="M11 46 v20" stroke="#FBF8EF" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />
      {/* rótulo e pontinhos de brilho */}
      <rect x="15" y="56" width="18" height="10" rx="2" fill="#F6E9C9" />
      <path d="M18 61 h12" stroke="#9C6B43" strokeWidth="1" />
      <circle cx="35" cy="50" r="0.9" fill="#FBF8EF" />
      <circle cx="31" cy="71" r="0.9" fill="#FBF8EF" />
      <circle cx="16" cy="72" r="0.9" fill="#FBF8EF" />
      {/* tampa de madeira encostada */}
      <ellipse cx="46" cy="66" rx="4" ry="13" fill="#B88A5E" stroke="#5C3D26" strokeWidth="1.2" transform="rotate(12 46 66)" />
      <circle cx="45.5" cy="60" r="0.8" fill="#7A5235" />
      <circle cx="46.5" cy="68" r="0.8" fill="#7A5235" />
    </svg>
  );
}

/** um enfeite por prateleira, alternando; a largura serve para reservar espaço */
export const SHELF_DECOR = [
  { el: ShelfPlant, w: 62 },
  { el: ShelfStack, w: 82 },
  { el: ShelfCactus, w: 54 },
  { el: ShelfFrame, w: 68 },
  { el: ShelfMug, w: 64 },
  { el: ShelfCandle, w: 62 }
];
