import { useId, type ReactElement } from 'react';

/**
 * Catálogo de enfeites da estante. Cada enfeite tem variações de cor (`tones`).
 * Os desenhos são originais; o fundo do SVG encosta na prateleira.
 */

type Art = (p: { tone: number }) => ReactElement;

export interface DecorTone {
  name: string;
  /** cor da bolinha no seletor */
  swatch: string;
}

export interface DecorDef {
  kind: string;
  label: string;
  /** largura reservada na prateleira */
  w: number;
  tones: DecorTone[];
  Art: Art;
  /** quanto o desenho desce abaixo da prateleira (planta pendente) */
  hang?: number;
}

const pick = <T,>(arr: T[], tone: number) => arr[((tone % arr.length) + arr.length) % arr.length];

/* ---------------- plantas ---------------- */

const POTS: [string, string, string][] = [
  ['Terracota', '#C4855E', '#A7643F'],
  ['Creme', '#EFE3CC', '#D2BC97'],
  ['Azul', '#7C9BB0', '#5E7F95'],
  ['Rosa', '#E2B1A6', '#C98D80'],
  ['Preto', '#3F3A36', '#2B2724']
];

const Planta: Art = ({ tone }) => {
  const [, pot, rim] = pick(POTS, tone);
  return (
    <svg width="52" height="78" viewBox="0 0 52 78">
      <path d="M26 44 C 22 30, 14 22, 6 18" stroke="#6E8B5E" strokeWidth="1.5" fill="none" />
      <ellipse cx="10" cy="22" rx="9" ry="4" fill="#8FA876" transform="rotate(30 10 22)" />
      <ellipse cx="40" cy="20" rx="10" ry="4.5" fill="#6E8B5E" transform="rotate(-35 40 20)" />
      <ellipse cx="26" cy="16" rx="5" ry="13" fill="#A3B18A" />
      <ellipse cx="17" cy="34" rx="8" ry="4" fill="#6E8B5E" transform="rotate(25 17 34)" />
      <ellipse cx="36" cy="34" rx="8" ry="4" fill="#8FA876" transform="rotate(-25 36 34)" />
      <path d="M12 48 h28 l-4 30 h-20 z" fill={pot} />
      <rect x="10" y="45" width="32" height="7" rx="3" fill={rim} />
    </svg>
  );
};

const COSTELA_POTS: [string, string, string][] = [
  ['Cesto', '#D9B88F', '#B8956A'],
  ['Branco', '#F3EEE4', '#D8D0C0'],
  ['Terracota', '#C4855E', '#A7643F'],
  ['Preto', '#3F3A36', '#2B2724']
];

function BigLeaf({ x, y, r, rot, c }: { x: number; y: number; r: number; rot: number; c: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path d={`M0 ${r} C ${-r * 1.25} ${r * 0.6}, ${-r * 1.1} ${-r * 0.9}, 0 ${-r * 0.55} C ${r * 1.1} ${-r * 0.9}, ${r * 1.25} ${r * 0.6}, 0 ${r} Z`} fill={c} />
      <path d={`M0 ${r * 0.9} V${-r * 0.45}`} stroke="#DCE5C8" strokeOpacity="0.6" strokeWidth="1" />
      {[-0.1, 0.3].map((k, i) => (
        <g key={i} stroke="#DCE5C8" strokeOpacity="0.55" strokeWidth="0.9">
          <path d={`M0 ${r * k} L ${-r * 0.75} ${r * (k - 0.35)}`} />
          <path d={`M0 ${r * k} L ${r * 0.75} ${r * (k - 0.35)}`} />
        </g>
      ))}
    </g>
  );
}

const Costela: Art = ({ tone }) => {
  const [name, pot, line] = pick(COSTELA_POTS, tone);
  return (
    <svg width="66" height="96" viewBox="0 0 66 96">
      <g stroke="#5E7A4F" strokeWidth="1.6" fill="none" strokeLinecap="round">
        <path d="M33 68 C 30 50, 22 38, 15 30" />
        <path d="M33 68 C 36 48, 44 36, 51 28" />
        <path d="M33 68 C 33 50, 33 30, 33 16" />
        <path d="M33 68 C 28 60, 18 56, 12 52" />
        <path d="M33 68 C 40 60, 48 56, 54 52" />
      </g>
      <BigLeaf x={13} y={50} r={10} rot={-60} c="#6E8B5E" />
      <BigLeaf x={53} y={50} r={10} rot={60} c="#5E7A4F" />
      <BigLeaf x={15} y={28} r={13} rot={-35} c="#7F9C6C" />
      <BigLeaf x={51} y={26} r={13} rot={35} c="#6E8B5E" />
      <BigLeaf x={33} y={14} r={13} rot={0} c="#8FA876" />
      <path d="M16 68 h34 l-4 26 a3 3 0 0 1 -3 2 h-20 a3 3 0 0 1 -3 -2 z" fill={pot} stroke={name === 'Branco' ? line : 'none'} strokeWidth="1" />
      {name === 'Cesto' ? (
        <g stroke={line} strokeWidth="1.1">
          <path d="M17 74 h32 M18 80 h30 M19 86 h28 M20 92 h26" />
          {[22, 28, 34, 40, 46].map((x) => (
            <path key={x} d={`M${x} 69 v26`} strokeOpacity="0.5" />
          ))}
        </g>
      ) : (
        <rect x="15" y="67" width="36" height="5" rx="2.5" fill={line} />
      )}
    </svg>
  );
};

const CACTO_TONES: [string, string, string, string][] = [
  ['Creme e rosa', '#E0C49C', '#C9A57E', '#E7A7A0'],
  ['Terracota e amarela', '#C4855E', '#A7643F', '#F0C75E'],
  ['Azul e branca', '#9DB6C6', '#7C9BB0', '#FBF8EF'],
  ['Rosa e vermelha', '#E8C3B9', '#D4A194', '#D9574A']
];

const Cacto: Art = ({ tone }) => {
  const [, pot, rim, flower] = pick(CACTO_TONES, tone);
  return (
    <svg width="44" height="80" viewBox="0 0 44 80">
      <path d="M22 50 V20 a7 7 0 0 1 14 0 V50 z" fill="#6E8B5E" transform="translate(-7 0)" />
      <path d="M10 40 V30 a4 4 0 0 1 8 0 V44" fill="#7F9C6C" />
      <path d="M26 36 V26 a4 4 0 0 1 8 0 V40" fill="#7F9C6C" />
      <path d="M22 18 V48 M18 22 V46 M26 22 V46" stroke="#5E7A4F" strokeWidth="0.8" />
      <circle cx="22" cy="12.5" r="3.2" fill={flower} stroke="#C9A57E" strokeWidth="0.5" />
      <circle cx="22" cy="12.5" r="1" fill="#E2B04A" />
      <path d="M8 52 h28 l-3 26 h-22 z" fill={pot} />
      <rect x="6" y="49" width="32" height="6" rx="3" fill={rim} />
    </svg>
  );
};

const SUC_TONES: [string, string, string][] = [
  ['Concreto', '#BDB6AA', '#A39B8E'],
  ['Terracota', '#C4855E', '#A7643F'],
  ['Branco', '#F3EEE4', '#D8D0C0'],
  ['Sálvia', '#A3B18A', '#8A9A72']
];

function Rosette({ x, y, r, c, tip }: { x: number; y: number; r: number; c: string; tip: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[-70, -35, 0, 35, 70].map((a) => (
        <ellipse key={a} cx="0" cy={-r * 0.55} rx={r * 0.32} ry={r * 0.6} fill={c} transform={`rotate(${a})`} stroke={tip} strokeWidth="0.7" />
      ))}
      {[-30, 0, 30].map((a) => (
        <ellipse key={a} cx="0" cy={-r * 0.35} rx={r * 0.22} ry={r * 0.4} fill={c} transform={`rotate(${a})`} opacity="0.85" stroke="#FBF8EF" strokeOpacity="0.35" strokeWidth="0.6" />
      ))}
    </g>
  );
}

const Suculentas: Art = ({ tone }) => {
  const [, pot, shade] = pick(SUC_TONES, tone);
  return (
    <svg width="60" height="44" viewBox="0 0 60 44">
      <Rosette x={16} y={24} r={13} c="#8FB5A0" tip="#C99A9A" />
      <Rosette x={44} y={24} r={12} c="#A3B18A" tip="#7F9C6C" />
      <Rosette x={30} y={22} r={15} c="#9CC2AE" tip="#D4A194" />
      <path d="M4 24 h52 l-3 18 a2 2 0 0 1 -2 2 h-42 a2 2 0 0 1 -2 -2 z" fill={pot} />
      <path d="M4 24 h52 v4 h-52 z" fill={shade} />
    </svg>
  );
};

const PEND_POTS: [string, string, string][] = [
  ['Branco', '#F3EEE4', '#D8D0C0'],
  ['Terracota', '#C4855E', '#A7643F'],
  ['Sálvia', '#A3B18A', '#8A9A72'],
  ['Mostarda', '#D9A441', '#B98A30']
];

/** jiboia: o vaso fica na prateleira e os galhos descem pela frente */
const Pendente: Art = ({ tone }) => {
  const [, pot, rim] = pick(PEND_POTS, tone);
  const leaf = (x: number, y: number, rot: number, c: string, k: number) => (
    <path key={k} d="M0 0 C 5 -2, 8 3, 0 9 C -8 3, -5 -2, 0 0 Z" fill={c} transform={`translate(${x} ${y}) rotate(${rot})`} />
  );
  const greens = ['#6E8B5E', '#8FA876', '#A3B18A', '#7F9C6C'];
  return (
    <svg width="60" height="112" viewBox="0 0 60 112" className="sway-soft">
      {/* folhas no alto */}
      {leaf(30, 8, 0, '#8FA876', 1)}
      {leaf(20, 12, -40, '#6E8B5E', 2)}
      {leaf(40, 12, 40, '#7F9C6C', 3)}
      {leaf(25, 4, -15, '#A3B18A', 4)}
      {/* galhos que descem */}
      <path d="M14 26 C 6 40, 12 60, 6 82 C 4 92, 8 100, 6 108" stroke="#5E7A4F" strokeWidth="1.4" fill="none" />
      <path d="M46 26 C 54 44, 48 62, 54 78 C 56 86, 52 92, 54 98" stroke="#5E7A4F" strokeWidth="1.4" fill="none" />
      {[
        [9, 36, 30],
        [11, 50, -30],
        [8, 64, 35],
        [6, 78, -25],
        [6, 92, 30],
        [6, 104, -20],
        [51, 38, -30],
        [50, 52, 30],
        [52, 66, -35],
        [53, 80, 25],
        [53, 94, -20]
      ].map(([x, y, r], i) => leaf(x, y, r, greens[i % greens.length], 10 + i))}
      {/* vaso */}
      <path d="M14 22 h32 l-3 18 h-26 z" fill={pot} />
      <rect x="12" y="19" width="36" height="6" rx="3" fill={rim} />
    </svg>
  );
};

const FLORES_TONES: [string, string, string][] = [
  ['Tulipas vermelhas', '#D96A5A', 'tulipa'],
  ['Tulipas amarelas', '#E8C26A', 'tulipa'],
  ['Tulipas rosa', '#E8A0B0', 'tulipa'],
  ['Margaridas', '#FBF8EF', 'margarida'],
  ['Lavanda', '#A99BC4', 'lavanda']
];

const Flores: Art = ({ tone }) => {
  const [, color, shape] = pick(FLORES_TONES, tone);
  const heads: [number, number][] = [
    [14, 22],
    [26, 12],
    [36, 26]
  ];
  return (
    <svg width="48" height="92" viewBox="0 0 48 92">
      <g stroke="#6E8B5E" strokeWidth="1.6" fill="none" strokeLinecap="round">
        <path d="M22 62 C 20 46, 16 34, 14 24" />
        <path d="M24 62 C 25 44, 26 28, 26 14" />
        <path d="M26 62 C 30 48, 34 36, 36 28" />
      </g>
      <ellipse cx="18" cy="44" rx="7" ry="2.6" fill="#8FA876" transform="rotate(-50 18 44)" />
      <ellipse cx="31" cy="46" rx="7" ry="2.6" fill="#7F9C6C" transform="rotate(50 31 46)" />
      {shape === 'tulipa' &&
        heads.map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <path d="M-5 -2 C -6 6, 6 6, 5 -2 L 3 -7 L 0 -3 L -3 -7 Z" fill={color} />
            <path d="M0 -3 L 0 4" stroke="#000" strokeOpacity="0.12" />
          </g>
        ))}
      {shape === 'margarida' &&
        heads.map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <ellipse key={a} cx="0" cy="-4" rx="1.8" ry="3.6" fill={color} stroke="#E5DCC8" strokeWidth="0.5" transform={`rotate(${a})`} />
            ))}
            <circle r="2.4" fill="#E2B04A" />
          </g>
        ))}
      {shape === 'lavanda' &&
        heads.map(([x, y], i) => (
          <g key={i}>
            {[0, 1, 2, 3, 4].map((k) => (
              <ellipse key={k} cx={x + (k % 2 ? 1.6 : -1.6)} cy={y - 6 + k * 3.4} rx="1.8" ry="2.4" fill={color} />
            ))}
          </g>
        ))}
      {/* vaso de vidro */}
      <path d="M16 60 h16 c0 6, 6 10, 6 18 a12 12 0 0 1 -12 13 h-4 a12 12 0 0 1 -12 -13 c0 -8, 6 -12, 6 -18 z" fill="#CFE0DC" fillOpacity="0.55" stroke="#8FA9A3" strokeWidth="1.2" />
      <path d="M12 76 c0 -4, 2 -6, 4 -8" stroke="#FBF8EF" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
      <path d="M13 80 h22" stroke="#8FB0C8" strokeOpacity="0.5" strokeWidth="1" />
    </svg>
  );
};

/* ---------------- objetos ---------------- */

const QUADROS = ['Paisagem', 'Mar', 'Noite', 'Flores', 'Formas'];

const Quadro: Art = ({ tone }) => {
  const t = pick([0, 1, 2, 3, 4], tone);
  const frame = ['#9C6B43', '#F3EEE4', '#2F2A27', '#C9A14A', '#D9B88F'][t];
  return (
    <svg width="58" height="72" viewBox="0 0 58 72">
      <rect x="4" y="6" width="50" height="62" rx="3" fill={frame} stroke={t === 1 ? '#D8D0C0' : 'none'} />
      {t === 0 && (
        <g>
          <rect x="9" y="11" width="40" height="52" rx="1.5" fill="#F6E9C9" />
          <circle cx="38" cy="24" r="5" fill="#E2B04A" opacity="0.8" />
          <path d="M9 50 Q 22 36, 34 46 T 49 42 V63 H9 Z" fill="#A3B18A" />
          <path d="M9 56 Q 26 48, 49 54 V63 H9 Z" fill="#6E8B5E" />
        </g>
      )}
      {t === 1 && (
        <g>
          <rect x="9" y="11" width="40" height="52" rx="1.5" fill="#E3ECEE" />
          <circle cx="20" cy="30" r="6" fill="#F2C48C" />
          <rect x="9" y="38" width="40" height="25" fill="#7C9BB0" />
          <path d="M12 44 q3 -2 6 0 t6 0 M28 50 q3 -2 6 0 t6 0 M14 56 q3 -2 6 0 t6 0" stroke="#E3ECEE" strokeWidth="1" fill="none" />
          <path d="M34 38 l6 -10 l6 10 z" fill="#FBF8EF" />
        </g>
      )}
      {t === 2 && (
        <g>
          <rect x="9" y="11" width="40" height="52" rx="1.5" fill="#2E3A4A" />
          <path d="M38 18 a7 7 0 1 0 6 10 a6 6 0 1 1 -6 -10 z" fill="#F6E9C9" />
          {[
            [16, 20],
            [24, 30],
            [14, 36],
            [30, 18],
            [42, 40]
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="0.9" fill="#F6E9C9" />
          ))}
          <path d="M9 54 Q 22 44, 32 52 T 49 48 V63 H9 Z" fill="#3E5148" />
        </g>
      )}
      {t === 3 && (
        <g>
          <rect x="9" y="11" width="40" height="52" rx="1.5" fill="#FBF3E2" />
          {[
            [18, 28, '#D96A5A'],
            [29, 22, '#E8C26A'],
            [40, 30, '#E8A0B0']
          ].map(([x, y, c], i) => (
            <g key={i}>
              <path d={`M${x} ${y} Q ${Number(x) + 2} ${Number(y) + 14}, 29 56`} stroke="#6E8B5E" strokeWidth="1.2" fill="none" />
              <circle cx={x} cy={y} r="4.5" fill={c as string} />
              <circle cx={x} cy={y} r="1.6" fill="#FBF3E2" opacity="0.7" />
            </g>
          ))}
        </g>
      )}
      {t === 4 && (
        <g>
          <rect x="9" y="11" width="40" height="52" rx="1.5" fill="#F3E7D3" />
          <path d="M14 63 v-14 a10 10 0 0 1 20 0 v14 z" fill="#C46A4A" />
          <path d="M19 63 v-12 a5 5 0 0 1 10 0 v12 z" fill="#F3E7D3" />
          <circle cx="38" cy="24" r="6" fill="#D9A441" />
          <rect x="30" y="38" width="15" height="25" rx="7.5" fill="#A3B18A" />
        </g>
      )}
      <path d="M20 72 L26 64 M38 72 L32 64" stroke="#5C3D26" strokeWidth="2" />
    </svg>
  );
};

const POLA_TONES: [string, string, string][] = [
  ['Verão', '#F2C48C', '#7C9BB0'],
  ['Campo', '#C5D2B4', '#6E8B5E'],
  ['Pôr do sol', '#E8A0B0', '#C46A4A'],
  ['Inverno', '#DCE5EA', '#8FA9B8']
];

const Polaroids: Art = ({ tone }) => {
  const [, sky, ground] = pick(POLA_TONES, tone);
  return (
    <svg width="58" height="60" viewBox="0 0 58 60">
      <g transform="rotate(-8 18 40)">
        <rect x="4" y="20" width="28" height="34" rx="1" fill="#FBF8EF" stroke="#D8CDB5" strokeWidth="0.8" />
        <rect x="7" y="23" width="22" height="21" fill={sky} />
        <path d="M7 38 q6 -5 11 0 t11 -2 V44 H7 z" fill={ground} />
      </g>
      <g transform="rotate(7 40 40)">
        <rect x="26" y="18" width="28" height="34" rx="1" fill="#FBF8EF" stroke="#D8CDB5" strokeWidth="0.8" />
        <rect x="29" y="21" width="22" height="21" fill={ground} opacity="0.55" />
        <circle cx="40" cy="30" r="5" fill={sky} />
        <path d="M29 42 h22" stroke={ground} />
        <rect x="35" y="15" width="10" height="6" fill="#E2B04A" opacity="0.7" transform="rotate(-6 40 18)" />
      </g>
    </svg>
  );
};

const CANECAS: [string, string, string][] = [
  ['Terracota', '#C4855E', '#F6E9C9'],
  ['Sálvia', '#8FA876', '#F6E9C9'],
  ['Azul', '#7C9BB0', '#F6E9C9'],
  ['Mostarda', '#D9A441', '#FBF8EF'],
  ['Creme', '#EFE3CC', '#C4855E']
];

const Caneca: Art = ({ tone }) => {
  const [name, body, stripe] = pick(CANECAS, tone);
  return (
    <svg width="54" height="62" viewBox="0 0 54 62">
      <path d="M18 10 c-4 5, 4 8, 0 14 M26 6 c-4 6, 4 9, 0 16" stroke="#C9B89A" strokeWidth="1.8" fill="none" strokeLinecap="round" className="steam" />
      <path d="M8 28 h30 v22 a8 8 0 0 1 -8 8 h-14 a8 8 0 0 1 -8 -8 z" fill={body} stroke={name === 'Creme' ? '#D2BC97' : 'none'} />
      <path d="M38 33 h4 a6 6 0 0 1 0 12 h-4" stroke={body} strokeWidth="4" fill="none" />
      {name === 'Creme' ? (
        [14, 22, 30, 18, 26].map((x, i) => <circle key={i} cx={x} cy={i < 3 ? 38 : 46} r="1.6" fill={stripe} />)
      ) : (
        <path d="M8 36 h30" stroke={stripe} strokeWidth="2" opacity="0.6" />
      )}
      <ellipse cx="23" cy="60" rx="18" ry="2" fill="#5C3D26" opacity="0.25" />
    </svg>
  );
};

const VELAS: [string, string, string][] = [
  ['Terracota', '#C46A4A', '#D98A6C'],
  ['Sálvia', '#8FA876', '#A9BF92'],
  ['Lavanda', '#A99BC4', '#BFB3D6'],
  ['Mel', '#D9A441', '#E8BE6A'],
  ['Rosa', '#E2B1A6', '#EDC6BD']
];

const Vela: Art = ({ tone }) => {
  const [, wax, top] = pick(VELAS, tone);
  return (
    <svg width="52" height="80" viewBox="0 0 52 80">
      <path d="M24 19 c-4 -3, 4 -6, 0 -9 c-3 -3, 3 -5, 1 -9" stroke="#D9B8AE" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.75" className="steam" />
      <g className="flame">
        <path d="M24 22 c5 6, 5 12, 0 16 c-5 -4, -5 -10, 0 -16 z" fill="#E2B04A" />
        <path d="M24 29 c2 3, 2 6, 0 8 c-2 -2, -2 -5, 0 -8 z" fill="#F7E3B0" />
      </g>
      <path d="M24 37 v6" stroke="#4A3221" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8 42 h32 v30 a6 6 0 0 1 -6 6 h-20 a6 6 0 0 1 -6 -6 z" fill={wax} />
      <ellipse cx="24" cy="44" rx="16" ry="2.4" fill={top} />
      <path d="M6 38 h36 v34 a8 8 0 0 1 -8 8 h-20 a8 8 0 0 1 -8 -8 z" fill="#FBF8EF" fillOpacity="0.18" stroke="#5C3D26" strokeWidth="1.4" />
      <path d="M11 46 v20" stroke="#FBF8EF" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />
      <rect x="15" y="56" width="18" height="10" rx="2" fill="#F6E9C9" />
      <path d="M18 61 h12" stroke="#9C6B43" strokeWidth="1" />
      <ellipse cx="46" cy="66" rx="4" ry="13" fill="#B88A5E" stroke="#5C3D26" strokeWidth="1.2" transform="rotate(12 46 66)" />
    </svg>
  );
};

const PILHAS: [string, [string, string, string], string][] = [
  ['Floresta', ['#6E8B5E', '#C9A57E', '#5C3D26'], 'vaso'],
  ['Vibrante', ['#C46A4A', '#E2B04A', '#7C9BB0'], 'maca'],
  ['Pastel', ['#A99BC4', '#E2B1A6', '#9CC2AE'], 'oculos'],
  ['Clássica', ['#2F3E2C', '#9C6B43', '#7A2E2A'], 'xicara']
];

const Pilha: Art = ({ tone }) => {
  const [, [a, b, c], top] = pick(PILHAS, tone);
  const book = (x: number, y: number, w: number, h: number, color: string) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="1.5" fill={color} />
      <rect x={x + w - 4} y={y + 1.5} width="3" height={h - 3} fill="#FBF3E2" />
      <path d={`M${x + 6} ${y + 1.5} v${h - 3}`} stroke="#FBF8EF" strokeOpacity="0.4" strokeWidth="1.2" />
    </g>
  );
  return (
    <svg width="78" height="66" viewBox="0 0 78 66">
      {top === 'vaso' && (
        <g>
          <path d="M33 30 c-6 -4, -6 -14, 0 -18 h8 c6 4, 6 14, 0 18 z" fill="#F6E9C9" stroke="#D9B88F" />
          <path d="M37 12 c-2 -4, 0 -8, 3 -10 M37 12 c3 -3, 6 -3, 8 -2" stroke="#6E8B5E" strokeWidth="1.3" fill="none" />
        </g>
      )}
      {top === 'maca' && (
        <g>
          <path d="M39 30 c-10 0, -12 -8, -9 -13 c2 -3, 6 -3, 9 -1 c3 -2, 7 -2, 9 1 c3 5, 1 13, -9 13 z" fill="#C94B3C" />
          <path d="M39 16 c0 -3, 1 -5, 2 -6" stroke="#5C3D26" strokeWidth="1.4" fill="none" />
          <ellipse cx="44" cy="11" rx="4" ry="2" fill="#8FA876" transform="rotate(-20 44 11)" />
        </g>
      )}
      {top === 'oculos' && (
        <g stroke="#3F3A36" strokeWidth="1.6" fill="#DCE5EA" fillOpacity="0.5">
          <circle cx="30" cy="26" r="5" />
          <circle cx="45" cy="26" r="5" />
          <path d="M35 25 q2.5 -2 5 0 M25 25 l-6 -3 M50 25 l6 -3" fill="none" />
        </g>
      )}
      {top === 'xicara' && (
        <g>
          <path d="M28 18 h18 v6 a8 8 0 0 1 -8 7 h-2 a8 8 0 0 1 -8 -7 z" fill="#FBF8EF" stroke="#C9B89A" />
          <path d="M46 20 h2 a3 3 0 0 1 0 6 h-2" stroke="#C9B89A" strokeWidth="1.6" fill="none" />
          <ellipse cx="37" cy="31.5" rx="12" ry="1.6" fill="#E5DCC8" />
          <path d="M33 13 c-2 -3, 2 -4, 0 -7 M39 13 c-2 -3, 2 -4, 0 -7" stroke="#C9B89A" strokeWidth="1.3" fill="none" className="steam" />
        </g>
      )}
      {book(8, 32, 62, 10, a)}
      {book(2, 42, 72, 12, b)}
      {book(6, 54, 66, 12, c)}
    </svg>
  );
};

const GLOBOS: [string, string, string, string][] = [
  ['Clássico', '#7C9BB0', '#A3B18A', '#9C6B43'],
  ['Antigo', '#E3D3B0', '#B88A5E', '#C9A14A'],
  ['Noturno', '#2E3A4A', '#8FA876', '#2F2A27'],
  ['Rosa', '#EBC9C0', '#FBF8EF', '#C9A14A']
];

const Globo: Art = ({ tone }) => {
  const [, sea, land, metal] = pick(GLOBOS, tone);
  return (
    <svg width="52" height="80" viewBox="0 0 52 80">
      <circle cx="26" cy="32" r="20" fill={sea} />
      <path d="M14 22 c4 -6, 10 -6, 12 -2 c2 4, -4 6, -2 10 c2 4, -4 6, -8 3 c-3 -2, -5 -7, -2 -11 z" fill={land} />
      <path d="M32 16 c5 0, 9 3, 10 7 c0 3, -4 3, -6 6 c-2 3, 0 8, -4 9 c-3 0, -4 -4, -3 -8 c1 -4, -3 -5, -2 -9 c0 -3, 3 -5, 5 -5 z" fill={land} />
      <path d="M22 44 c3 -2, 7 0, 8 3 c-2 2, -6 2, -8 -3 z" fill={land} />
      <ellipse cx="26" cy="32" rx="20" ry="6" fill="none" stroke="#FBF8EF" strokeOpacity="0.25" />
      <path d="M26 12 c-8 6, -8 34, 0 40" stroke="#FBF8EF" strokeOpacity="0.25" fill="none" />
      <path d="M6 32 a20 20 0 0 0 35 13" stroke={metal} strokeWidth="2.5" fill="none" transform="rotate(-20 26 32)" />
      <path d="M26 54 v12" stroke={metal} strokeWidth="3" />
      <path d="M14 76 c0 -6, 6 -10, 12 -10 s12 4, 12 10 z" fill={metal} />
      <rect x="12" y="75" width="28" height="5" rx="2" fill={metal} />
    </svg>
  );
};

const AMPULHETAS: [string, string][] = [
  ['Dourada', '#E2B04A'],
  ['Rosa', '#E2A1A6'],
  ['Azul', '#8FB0C8'],
  ['Verde', '#A3B18A']
];

const Ampulheta: Art = ({ tone }) => {
  const [, sand] = pick(AMPULHETAS, tone);
  return (
    <svg width="36" height="62" viewBox="0 0 36 62">
      <path d="M9 6 h18 c0 12, -8 16, -8 25 c0 9, 8 13, 8 25 h-18 c0 -12, 8 -16, 8 -25 c0 -9, -8 -13, -8 -25 z" fill="#E3ECEE" fillOpacity="0.55" stroke="#9AAFB5" strokeWidth="1" />
      <path d="M12 12 h12 c-1 6, -5 9, -6 12 c-1 -3, -5 -6, -6 -12 z" fill={sand} />
      <path d="M18 31 v18" stroke={sand} strokeWidth="1" strokeDasharray="1 2" />
      <path d="M9 56 c2 -8, 7 -9, 9 -9 s7 1, 9 9 z" fill={sand} />
      <rect x="3" y="0" width="30" height="6" rx="2" fill="#9C6B43" />
      <rect x="3" y="56" width="30" height="6" rx="2" fill="#9C6B43" />
      <path d="M6 6 v50 M30 6 v50" stroke="#7A5235" strokeWidth="2.4" />
    </svg>
  );
};

const ABAJURES: [string, string, string][] = [
  ['Creme', '#F3E7CF', '#C9A57E'],
  ['Sálvia', '#A3B18A', '#7F9C6C'],
  ['Rosa', '#E8C3B9', '#C98D80'],
  ['Mostarda', '#E2B04A', '#B98A30']
];

const Abajur: Art = ({ tone }) => {
  const [, shade, base] = pick(ABAJURES, tone);
  const id = useId().replace(/:/g, '');
  return (
    <svg width="60" height="98" viewBox="0 0 60 98">
      <defs>
        <radialGradient id={`glow${id}`} cx="50%" cy="0%" r="80%">
          <stop offset="0%" stopColor="#FFE9A8" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#FFE9A8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M14 38 h32 l14 46 h-60 z" fill={`url(#glow${id})`} className="glow" />
      <path d="M17 6 h26 l8 32 h-42 z" fill={shade} />
      <path d="M17 6 h26 l1 4 h-28 z" fill="#000" opacity="0.06" />
      <path d="M9 38 h42" stroke={base} strokeWidth="2" />
      <path d="M30 38 v40" stroke="#5C3D26" strokeWidth="2.4" />
      <path d="M38 40 v8" stroke="#5C3D26" strokeWidth="1" />
      <circle cx="38" cy="49" r="1.4" fill="#C9A14A" />
      <ellipse cx="30" cy="84" rx="9" ry="7" fill={base} />
      <rect x="16" y="88" width="28" height="10" rx="4" fill={base} />
    </svg>
  );
};

const GATOS: [string, string, string][] = [
  ['Laranja', '#D98F4E', '#B8703A'],
  ['Preto', '#3A3430', '#2A2522'],
  ['Cinza', '#A39D96', '#857F78'],
  ['Branco', '#F6F1E7', '#C9A57E'],
  ['Siamês', '#EADCC6', '#6B5240']
];

const Gato: Art = ({ tone }) => {
  const [name, fur, mark] = pick(GATOS, tone);
  const line = name === 'Preto' ? '#6B625A' : '#5C3D26';
  return (
    <svg width="60" height="64" viewBox="0 0 60 64">
      <path d="M40 60 c10 0, 16 -4, 14 -14 c-1 -5, -6 -6, -6 -2" stroke={fur} strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M14 62 C 8 50, 12 34, 27 32 C 42 34, 46 50, 40 62 Z" fill={fur} stroke={name === 'Branco' ? '#D8CDB5' : 'none'} />
      {name === 'Laranja' && <path d="M18 44 q9 3 18 0 M17 51 q10 3 20 0" stroke={mark} strokeWidth="2" fill="none" strokeLinecap="round" />}
      {name === 'Branco' && <ellipse cx="33" cy="46" rx="6" ry="5" fill={mark} opacity="0.8" />}
      <path d="M16 22 L 17 7 L 25 14 Z M38 22 L 37 7 L 29 14 Z" fill={name === 'Siamês' ? mark : fur} />
      <path d="M18 18 L 18.5 11 L 22.5 14.5 Z M36 18 L 35.5 11 L 31.5 14.5 Z" fill="#E8A9A0" />
      <circle cx="27" cy="23" r="12" fill={fur} stroke={name === 'Branco' ? '#D8CDB5' : 'none'} />
      {name === 'Siamês' && <ellipse cx="27" cy="27" rx="6" ry="5" fill={mark} opacity="0.85" />}
      <path d="M20 22 q2.5 2 5 0 M29 22 q2.5 2 5 0" stroke={line} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M25.5 26.5 h3 l-1.5 1.6 z" fill="#D98A8A" />
      <path d="M27 28 v1.2 M27 29.2 q-1.6 1.2 -3 0.4 M27 29.2 q1.6 1.2 3 0.4" stroke={line} strokeWidth="0.9" fill="none" />
      <path d="M14 26 l7 1 M14 29 l7 0 M40 26 l-7 1 M40 29 l-7 0" stroke={line} strokeOpacity="0.5" strokeWidth="0.7" />
      <ellipse cx="22" cy="61" rx="5" ry="3" fill={fur} stroke={line} strokeOpacity="0.25" />
      <ellipse cx="32" cy="61" rx="5" ry="3" fill={fur} stroke={line} strokeOpacity="0.25" />
    </svg>
  );
};

const CRISTAIS: [string, string, string, string][] = [
  ['Ametista', '#A68BC4', '#8A6BAE', '#C9B6DE'],
  ['Quartzo rosa', '#EBB9C0', '#D99AA4', '#F5D7DB'],
  ['Citrino', '#E8C26A', '#D4A23F', '#F3DDA0'],
  ['Esmeralda', '#7FB09A', '#5E9480', '#A9CDBB']
];

const Cristal: Art = ({ tone }) => {
  const [, mid, dark, light] = pick(CRISTAIS, tone);
  const point = (x: number, h: number, w: number, rot: number, k: number) => (
    <g key={k} transform={`translate(${x} 44) rotate(${rot})`}>
      <path d={`M${-w} 0 V${-h + w} L0 ${-h} L${w} ${-h + w} V0 Z`} fill={mid} />
      <path d={`M0 ${-h} L${w} ${-h + w} V0 H0 Z`} fill={dark} />
      <path d={`M${-w * 0.5} -2 V${-h + w + 2}`} stroke={light} strokeWidth="1.2" />
    </g>
  );
  return (
    <svg width="46" height="50" viewBox="0 0 46 50">
      {point(12, 22, 4.5, -22, 1)}
      {point(34, 20, 4.5, 24, 2)}
      {point(23, 36, 6, 0, 3)}
      {point(17, 16, 3.5, -8, 4)}
      {point(29, 18, 3.5, 10, 5)}
      <path d="M4 50 c0 -6, 6 -9, 19 -9 s19 3, 19 9 z" fill="#8C857C" />
      <path d="M8 50 c1 -3, 6 -5, 15 -5 s14 2, 15 5 z" fill={light} opacity="0.7" />
    </svg>
  );
};

const RELOGIOS: [string, string][] = [
  ['Vermelho', '#C46A4A'],
  ['Menta', '#9CC2AE'],
  ['Amarelo', '#E2B04A'],
  ['Preto', '#3F3A36']
];

const Relogio: Art = ({ tone }) => {
  const [, body] = pick(RELOGIOS, tone);
  return (
    <svg width="48" height="56" viewBox="0 0 48 56">
      <circle cx="11" cy="12" r="7" fill={body} />
      <circle cx="37" cy="12" r="7" fill={body} />
      <path d="M17 7 q7 -6 14 0" stroke="#3F3A36" strokeWidth="2" fill="none" />
      <path d="M14 48 l-5 7 M34 48 l5 7" stroke="#3F3A36" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="24" cy="32" r="19" fill={body} />
      <circle cx="24" cy="32" r="14.5" fill="#FBF8EF" />
      {[0, 90, 180, 270].map((a) => (
        <path key={a} d="M24 19.5 v2.5" stroke="#5C3D26" strokeWidth="1.4" transform={`rotate(${a} 24 32)`} />
      ))}
      <path d="M24 32 V23 M24 32 l6 4" stroke="#2F3E2C" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="24" cy="32" r="1.6" fill={body} />
    </svg>
  );
};

const POTES: [string, string[]][] = [
  ['Quente', ['#F7D88A', '#F7D88A', '#F2C46C']],
  ['Colorida', ['#F7D88A', '#E9A0A0', '#BFD8A8', '#A9C4E0', '#D9B8E8']]
];

const PoteLuz: Art = ({ tone }) => {
  const [, colors] = pick(POTES, tone);
  const dots: [number, number][] = [
    [14, 30],
    [26, 26],
    [20, 40],
    [30, 38],
    [12, 50],
    [24, 52],
    [32, 48],
    [18, 58],
    [29, 59]
  ];
  return (
    <svg width="44" height="66" viewBox="0 0 44 66">
      <rect x="12" y="6" width="20" height="8" rx="2" fill="#B88A5E" />
      <path d="M12 14 h20 c0 3, 6 4, 6 10 v34 a6 6 0 0 1 -6 6 h-20 a6 6 0 0 1 -6 -6 v-34 c0 -6, 6 -7, 6 -10 z" fill="#E3ECEE" fillOpacity="0.45" stroke="#9AAFB5" strokeWidth="1.2" />
      <path d="M14 24 C 34 28, 8 34, 30 40 S 8 50, 30 56" stroke="#8C7A5E" strokeWidth="0.8" fill="none" />
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.2" fill={colors[i % colors.length]} className="twinkle" style={{ animationDelay: `${(i * 0.37) % 2}s` }} />
      ))}
      <path d="M10 28 v26" stroke="#FBF8EF" strokeOpacity="0.7" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
};

const APARADORES: [string, string[]][] = [
  ['Terracota', ['#C46A4A', '#E2B04A', '#E8C3B9', '#A7643F']],
  ['Sálvia', ['#6E8B5E', '#A3B18A', '#E3E8D5', '#8FA876']],
  ['Rosa', ['#D99AA4', '#F3DCD2', '#E8C26A', '#C98D80']]
];

/** arco-íris de madeira pra segurar os livros */
const Aparador: Art = ({ tone }) => {
  const [, c] = pick(APARADORES, tone);
  return (
    <svg width="46" height="44" viewBox="0 0 46 44">
      {[20, 15, 10, 5].map((r, i) => (
        <path key={r} d={`M${23 - r} 44 a${r} ${r} 0 0 1 ${r * 2} 0 z`} fill={c[i]} />
      ))}
      <rect x="0" y="42" width="46" height="2" fill="#000" opacity="0.08" />
    </svg>
  );
};

/* ---------------- catálogo ---------------- */

const tones = (rows: [string, string, ...unknown[]][]): DecorTone[] => rows.map(([name, swatch]) => ({ name, swatch }));

export const DECOR_CATALOG: DecorDef[] = [
  { kind: 'planta', label: 'Planta', w: 52, tones: tones(POTS), Art: Planta },
  { kind: 'costela', label: 'Costela-de-adão', w: 66, tones: tones(COSTELA_POTS), Art: Costela },
  { kind: 'pendente', label: 'Jiboia pendente', w: 60, tones: tones(PEND_POTS), Art: Pendente, hang: 64 },
  { kind: 'cacto', label: 'Cacto', w: 44, tones: CACTO_TONES.map(([name, , , f]) => ({ name, swatch: f })), Art: Cacto },
  { kind: 'suculentas', label: 'Suculentas', w: 60, tones: tones(SUC_TONES), Art: Suculentas },
  { kind: 'flores', label: 'Vaso de flores', w: 48, tones: tones(FLORES_TONES), Art: Flores },
  { kind: 'quadro', label: 'Quadrinho', w: 58, tones: QUADROS.map((name, i) => ({ name, swatch: ['#A3B18A', '#7C9BB0', '#2E3A4A', '#E8A0B0', '#C46A4A'][i] })), Art: Quadro },
  { kind: 'polaroids', label: 'Fotos', w: 58, tones: POLA_TONES.map(([name, s]) => ({ name, swatch: s })), Art: Polaroids },
  { kind: 'caneca', label: 'Caneca', w: 54, tones: tones(CANECAS), Art: Caneca },
  { kind: 'vela', label: 'Vela', w: 52, tones: tones(VELAS), Art: Vela },
  { kind: 'pilha', label: 'Livros deitados', w: 78, tones: PILHAS.map(([name, c]) => ({ name, swatch: c[0] })), Art: Pilha },
  { kind: 'globo', label: 'Globo', w: 52, tones: tones(GLOBOS), Art: Globo },
  { kind: 'ampulheta', label: 'Ampulheta', w: 36, tones: tones(AMPULHETAS), Art: Ampulheta },
  { kind: 'abajur', label: 'Luminária', w: 60, tones: tones(ABAJURES), Art: Abajur },
  { kind: 'gato', label: 'Gatinho', w: 60, tones: tones(GATOS), Art: Gato },
  { kind: 'cristal', label: 'Cristais', w: 46, tones: tones(CRISTAIS), Art: Cristal },
  { kind: 'relogio', label: 'Despertador', w: 48, tones: tones(RELOGIOS), Art: Relogio },
  { kind: 'pote', label: 'Pote de luzinhas', w: 44, tones: POTES.map(([name, c]) => ({ name, swatch: c[c.length - 1] })), Art: PoteLuz },
  { kind: 'aparador', label: 'Aparador arco-íris', w: 46, tones: APARADORES.map(([name, c]) => ({ name, swatch: c[0] })), Art: Aparador }
];

export const decorDef = (kind: string) => DECOR_CATALOG.find((d) => d.kind === kind);

/** enfeites automáticos (antes de personalizar): um por prateleira, alternando */
export const AUTO_DECOR: { kind: string; tone: number }[] = [
  { kind: 'planta', tone: 0 },
  { kind: 'pilha', tone: 0 },
  { kind: 'cacto', tone: 0 },
  { kind: 'quadro', tone: 0 },
  { kind: 'caneca', tone: 0 },
  { kind: 'vela', tone: 0 }
];

/* ---------------- estilo da estante ---------------- */

export interface WoodStyle {
  id: string;
  label: string;
  /** moldura, prateleira, borda clara da prateleira */
  frame: string;
  plank: string;
  edge: string;
}

export const WOODS: WoodStyle[] = [
  { id: 'mel', label: 'Mel', frame: '#8A5F3C', plank: '#7A5235', edge: '#9C6B43' },
  { id: 'nogueira', label: 'Nogueira', frame: '#5C3D26', plank: '#4A3020', edge: '#6E4A30' },
  { id: 'carvalho', label: 'Carvalho claro', frame: '#C49A6C', plank: '#B3875A', edge: '#D4AD80' },
  { id: 'branca', label: 'Branca', frame: '#EFE9DC', plank: '#E2DACB', edge: '#F8F4EA' },
  { id: 'salvia', label: 'Sálvia', frame: '#7F9670', plank: '#6E8560', edge: '#93A985' },
  { id: 'rosa', label: 'Rosa antigo', frame: '#C48B7F', plank: '#B07A6E', edge: '#D3A093' },
  { id: 'preta', label: 'Preta', frame: '#3B3632', plank: '#2E2A27', edge: '#4A4540' }
];

export interface WallStyle {
  id: string;
  label: string;
  color: string;
  /** cor dos detalhes do padrão */
  ink: string;
}

export const WALLS: WallStyle[] = [
  { id: 'creme', label: 'Creme', color: '#E9DFC9', ink: '#DCCFB3' },
  { id: 'salvia', label: 'Sálvia', color: '#DDE4CE', ink: '#CBD5B8' },
  { id: 'ceu', label: 'Céu', color: '#D9E4E8', ink: '#C3D3D9' },
  { id: 'rosado', label: 'Rosado', color: '#F1DDD5', ink: '#E6C8BC' },
  { id: 'terracota', label: 'Terracota', color: '#E3BFA6', ink: '#D6AC90' },
  { id: 'noite', label: 'Noite', color: '#3D4A52', ink: '#4A5862' }
];

export const PATTERNS: { id: string; label: string }[] = [
  { id: 'liso', label: 'Liso' },
  { id: 'listras', label: 'Listras' },
  { id: 'bolinhas', label: 'Bolinhas' },
  { id: 'xadrez', label: 'Xadrez' },
  { id: 'ripas', label: 'Ripado' }
];

/** fundo CSS da parede da estante */
export function wallBackground(wallId?: string, patternId?: string): string {
  const w = WALLS.find((x) => x.id === wallId) ?? WALLS[0];
  switch (patternId) {
    case 'listras':
      return `repeating-linear-gradient(90deg, ${w.color} 0 18px, ${w.ink} 18px 36px)`;
    case 'bolinhas':
      return `radial-gradient(${w.ink} 2.5px, transparent 3px) 0 0 / 22px 22px, ${w.color}`;
    case 'xadrez':
      return `repeating-linear-gradient(0deg, ${w.ink}88 0 12px, transparent 12px 24px), repeating-linear-gradient(90deg, ${w.ink}88 0 12px, transparent 12px 24px), ${w.color}`;
    case 'ripas':
      return `repeating-linear-gradient(90deg, ${w.color} 0 26px, ${w.ink} 26px 28px)`;
    default:
      return w.color;
  }
}
