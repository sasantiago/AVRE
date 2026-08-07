import { useMemo, useState } from 'react';
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';
import { TenantInstrumentWithQuote } from '@/lib/types';

interface LeafDatum {
  name: string;
  value: 1;
  ti: TenantInstrumentWithQuote;
}
interface SectorDatum {
  name: string;
  children: LeafDatum[];
}
interface RootDatum {
  name: 'root';
  children: SectorDatum[];
}

const WIDTH = 960;
const HEIGHT = 560;
const SECTOR_HEADER = 26;

// Escala de color dentro de la paleta AVRE — nada de rojo/verde genérico.
// Subas: índigo de marca (avre.accent), más saturado cuanto mayor la suba.
// Bajas: ámbar (mismo tono que Badge tone="warning" en el resto de la app),
// más saturado cuanto mayor la baja. Sin datos: gris neutro (avre.muted).
function tileColor(changePct: number | null): string {
  if (changePct === null) return 'rgba(100, 116, 139, 0.35)'; // avre.muted
  const magnitude = Math.min(Math.abs(changePct) / 4, 1); // satura a partir de ±4%
  const alpha = 0.28 + magnitude * 0.6;
  return changePct >= 0
    ? `rgba(99, 102, 241, ${alpha.toFixed(2)})` // avre.accent (índigo)
    : `rgba(245, 158, 11, ${alpha.toFixed(2)})`; // ámbar (mismo que warning)
}

export function MarketTreemap({
  instruments,
  onSelect,
}: {
  instruments: TenantInstrumentWithQuote[];
  onSelect: (ti: TenantInstrumentWithQuote) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const layout = useMemo(() => {
    const bySector = new Map<string, TenantInstrumentWithQuote[]>();
    for (const ti of instruments) {
      const sector = ti.instrument.sector || 'Otros';
      const list = bySector.get(sector) ?? [];
      list.push(ti);
      bySector.set(sector, list);
    }

    const data: RootDatum = {
      name: 'root',
      children: Array.from(bySector.entries()).map(([name, list]) => ({
        name,
        children: list.map((ti) => ({ name: ti.instrument.symbol, value: 1 as const, ti })),
      })),
    };

    const root = hierarchy<RootDatum | SectorDatum | LeafDatum>(data, (d) =>
      'children' in d ? d.children : undefined,
    ).sum((d) => ('value' in d ? d.value : 0));

    treemap<RootDatum | SectorDatum | LeafDatum>()
      .tile(treemapSquarify)
      .size([WIDTH, HEIGHT])
      .paddingOuter(6)
      .paddingTop((node) => (node.depth === 1 ? SECTOR_HEADER : 0))
      .paddingInner(3)
      .round(true)(root);

    return root;
  }, [instruments]);

  if (instruments.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-2xl border border-slate-50/10 bg-slate-800/30 text-sm text-slate-500">
        Todavía no hay instrumentos habilitados para mostrar en el mapa.
      </div>
    );
  }

  const sectors = layout.children ?? [];

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-50/10 bg-slate-900/40 p-3">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        style={{ minWidth: 640, height: 'auto', display: 'block' }}
        role="img"
        aria-label="Mapa de mercado por sector, coloreado por variación del día"
      >
        {sectors.map((sector) => {
          const s = sector as unknown as { x0: number; y0: number; x1: number; y1: number; data: SectorDatum };
          return (
            <g key={s.data.name}>
              <rect
                x={s.x0}
                y={s.y0}
                width={s.x1 - s.x0}
                height={s.y1 - s.y0}
                fill="rgba(30, 41, 59, 0.55)"
                stroke="rgba(248,250,252,0.08)"
              />
              <text x={s.x0 + 8} y={s.y0 + 17} fontSize="11" fontWeight={600} fill="#94a3b8">
                {s.data.name}
              </text>
            </g>
          );
        })}

        {sectors.flatMap((sector) =>
          ((sector.children ?? []) as unknown as Array<{
            x0: number;
            y0: number;
            x1: number;
            y1: number;
            data: LeafDatum;
          }>).map((leaf) => {
            const w = leaf.x1 - leaf.x0;
            const h = leaf.y1 - leaf.y0;
            const ti = leaf.data.ti;
            const changePct = ti.quote?.changePct ?? null;
            const isHovered = hovered === ti.id;
            return (
              <g
                key={ti.id}
                transform={`translate(${leaf.x0}, ${leaf.y0})`}
                onMouseEnter={() => setHovered(ti.id)}
                onMouseLeave={() => setHovered((h2) => (h2 === ti.id ? null : h2))}
                onClick={() => onSelect(ti)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  width={w}
                  height={h}
                  fill={tileColor(changePct)}
                  stroke={isHovered ? '#f8fafc' : 'rgba(248,250,252,0.12)'}
                  strokeWidth={isHovered ? 1.5 : 1}
                  rx={4}
                />
                {w > 46 && h > 28 && (
                  <>
                    <text x={8} y={18} fontSize="12" fontWeight={700} fill="#f8fafc">
                      {ti.instrument.symbol}
                    </text>
                    {h > 42 && (
                      <text x={8} y={34} fontSize="10" fill="rgba(248,250,252,0.75)">
                        {changePct === null ? 'Sin cotización' : `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`}
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          }),
        )}
      </svg>
    </div>
  );
}
