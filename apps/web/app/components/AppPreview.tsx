"use client";

// An interactive, sample-data replica of the PostCompass app for the landing page hero.
// Everything runs in the browser; nothing connects to a database.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import styles from "./AppPreview.module.css";

/* ============================================================
   Icons (lucide-style, inline so the preview has no emoji)
   ============================================================ */
function Svg({ size = 14, children }: { size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
const I = {
  home: (s?: number) => <Svg size={s}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></Svg>,
  db: (s?: number) => <Svg size={s}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" /><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></Svg>,
  search: (s?: number) => <Svg size={s}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>,
  gear: (s?: number) => <Svg size={s}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></Svg>,
  table: (s?: number) => <Svg size={s}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 10v10" /></Svg>,
  view: (s?: number) => <Svg size={s}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></Svg>,
  code: (s?: number) => <Svg size={s}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m8 10 2 2-2 2M12 15h4" /></Svg>,
  diagram: (s?: number) => <Svg size={s}><rect x="9" y="3" width="6" height="5" rx="1" /><rect x="3" y="16" width="6" height="5" rx="1" /><rect x="15" y="16" width="6" height="5" rx="1" /><path d="M12 8v4M6 16v-2h12v2" /></Svg>,
  plus: (s?: number) => <Svg size={s}><path d="M12 5v14M5 12h14" /></Svg>,
  refresh: (s?: number) => <Svg size={s}><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" /><path d="M21 3v5h-5M3 21v-5h5" /></Svg>,
  chevron: (s?: number) => <Svg size={s}><path d="m8 10 4-4 4 4M8 14l4 4 4-4" /></Svg>,
  down: (s?: number) => <Svg size={s}><path d="m6 9 6 6 6-6" /></Svg>,
  arrow: (s?: number) => <Svg size={s}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>,
  out: (s?: number) => <Svg size={s}><path d="M7 17 17 7M8 7h9v9" /></Svg>,
  undo: (s?: number) => <Svg size={s}><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></Svg>,
  redo: (s?: number) => <Svg size={s}><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></Svg>,
  sort: (s?: number) => <Svg size={s}><path d="M4 6h16M7 12h10M10 18h4" /></Svg>,
  play: (s?: number) => <Svg size={s}><path d="m7 4 13 8-13 8V4Z" /></Svg>,
  key: (s?: number) => <Svg size={s}><circle cx="8" cy="15" r="4" /><path d="m10.8 12.2 9.2-9.2M17 6l3 3M14.5 8.5l2 2" /></Svg>,
  link: (s?: number) => <Svg size={s}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></Svg>,
  stats: (s?: number) => <Svg size={s}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>,
  check: (s?: number) => <Svg size={s}><path d="m5 12 5 5L20 7" /></Svg>,
  x: (s?: number) => <Svg size={s}><path d="M18 6 6 18M6 6l12 12" /></Svg>,
  gauge: (s?: number) => <Svg size={s}><path d="M12 14l4-4" /><path d="M3.3 19a10 10 0 1 1 17.4 0" /></Svg>,
  bars: (s?: number) => <Svg size={s}><path d="M3 3v18h18" /><path d="M7 16v-4M12 16V8M17 16v-7" /></Svg>,
  plug: (s?: number) => <Svg size={s}><path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v5" /></Svg>,
};

/* ============================================================
   Deterministic sample data (same on server and client)
   ============================================================ */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, a: readonly T[]) => a[Math.floor(r() * a.length)]!;
const pad = (n: number) => String(n).padStart(2, "0");
function dateFrom(r: () => number, maxDays: number) {
  const base = Date.UTC(2026, 9, 23, 12, 0, 0);
  const d = new Date(base - Math.floor(r() * maxDays * 86400000));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

type Cell = string | number | boolean | null;
type Row = Record<string, Cell>;
interface Column {
  name: string;
  type: string;
  pk?: boolean;
  fk?: string; // referenced table (by id)
  stats?: boolean; // categorical: filterable + stats popover
  nullable?: boolean;
  width: number;
}
interface TableDef {
  name: string;
  columns: Column[];
  rows: Row[];
}

const FIRST = ["Aarav", "Priya", "Liam", "Olivia", "Noah", "Ananya", "Mateo", "Sofia", "Kenji", "Amara", "Lucas", "Isha", "Ethan", "Zara", "Arjun", "Maya"];
const LAST = ["Sharma", "Patel", "Smith", "Garcia", "Kim", "Nguyen", "Rossi", "Okafor", "Silva", "Tanaka", "Khan", "Iyer"];
const CITIES: [string, string][] = [["Delhi", "India"], ["Bengaluru", "India"], ["Mumbai", "India"], ["London", "United Kingdom"], ["New York", "United States"], ["Berlin", "Germany"], ["Tokyo", "Japan"], ["Singapore", "Singapore"], ["Toronto", "Canada"]];
const CATS = ["Laptops", "Phones", "Audio", "Wearables", "Cameras", "Gaming", "Smart Home", "Accessories"];
const MODELS = ["Air", "Pro", "Max", "Mini", "Ultra", "Lite", "Plus", "One"];
const PREFIX = ["Nimbus", "Pixelon", "Sonora", "Pulse", "Lumen", "Vortex", "Hearth", "Flux"];
const STATUSES = ["pending", "paid", "shipped", "delivered", "refunded"] as const;

function buildData(): Record<string, TableDef> {
  const r = rng(42);
  const categories: Row[] = CATS.map((name, i) => ({ id: i + 1, name, slug: name.toLowerCase().replace(" ", "-") }));
  const customers: Row[] = Array.from({ length: 48 }, (_, i) => {
    const f = pick(r, FIRST), l = pick(r, LAST), [city, country] = pick(r, CITIES);
    return { id: i + 1, full_name: `${f} ${l}`, email: `${f}.${l}${i + 1}@acme.io`.toLowerCase(), city, country, is_vip: r() < 0.12, created_at: dateFrom(r, 600) };
  });
  const products: Row[] = Array.from({ length: 32 }, (_, i) => {
    const c = i % 8;
    return { id: i + 1, category_id: c + 1, name: `${PREFIX[c]} ${MODELS[Math.floor(i / 8) * 2 + (i % 2)] ?? "One"}`, price: Number((40 + r() * 1400).toFixed(2)), stock: Math.floor(r() * 400), is_active: r() > 0.1 };
  });
  const weights = [0.14, 0.14, 0.15, 0.43, 0.14];
  const orders: Row[] = Array.from({ length: 120 }, (_, i) => {
    let x = r(), s = 0;
    while (x > weights[s]! && s < 4) x -= weights[s++]!;
    return { id: i + 1, customer_id: 1 + Math.floor(r() * 48), status: STATUSES[s]!, total: Number((60 + r() * 6800).toFixed(2)), placed_at: dateFrom(r, 365) };
  });
  const order_items: Row[] = Array.from({ length: 160 }, (_, i) => {
    const p = products[Math.floor(r() * products.length)]!;
    return { id: i + 1, order_id: 1 + Math.floor(i / 1.35), product_id: p.id ?? null, quantity: 1 + Math.floor(r() * 3), unit_price: p.price ?? null };
  });
  const reviews: Row[] = Array.from({ length: 40 }, (_, i) => ({
    id: i + 1, product_id: 1 + Math.floor(r() * 32), customer_id: 1 + Math.floor(r() * 48), rating: pick(r, [5, 5, 5, 4, 4, 3, 2, 1]),
    body: pick(r, ["Absolutely love it.", "Great value for the price.", "Battery life could be better.", "Works perfectly.", "Would buy again!", "Solid build quality."]),
  }));

  const id: Column = { name: "id", type: "int4", pk: true, width: 64 };
  const bid: Column = { ...id, type: "int8" };
  return {
    categories: { name: "categories", rows: categories, columns: [id, { name: "name", type: "text", width: 150 }, { name: "slug", type: "text", width: 150 }] },
    customers: {
      name: "customers", rows: customers,
      columns: [id, { name: "full_name", type: "text", width: 150 }, { name: "email", type: "text", width: 230 }, { name: "city", type: "text", stats: true, width: 120 }, { name: "country", type: "text", stats: true, width: 140 }, { name: "is_vip", type: "bool", width: 80 }, { name: "created_at", type: "timestamptz", width: 150 }],
    },
    order_items: {
      name: "order_items", rows: order_items,
      columns: [bid, { name: "order_id", type: "int8", fk: "orders", width: 110 }, { name: "product_id", type: "int4", fk: "products", width: 120 }, { name: "quantity", type: "int4", width: 90 }, { name: "unit_price", type: "numeric(10,2)", width: 130 }],
    },
    orders: {
      name: "orders", rows: orders,
      columns: [bid, { name: "customer_id", type: "int4", fk: "customers", width: 130 }, { name: "status", type: "order_status", stats: true, width: 150 }, { name: "total", type: "numeric(12,2)", width: 140 }, { name: "placed_at", type: "timestamptz", width: 160 }],
    },
    products: {
      name: "products", rows: products,
      columns: [id, { name: "category_id", type: "int4", fk: "categories", width: 120 }, { name: "name", type: "text", width: 150 }, { name: "price", type: "numeric(10,2)", width: 130 }, { name: "stock", type: "int4", width: 80 }, { name: "is_active", type: "bool", width: 90 }],
    },
    reviews: {
      name: "reviews", rows: reviews,
      columns: [id, { name: "product_id", type: "int4", fk: "products", width: 110 }, { name: "customer_id", type: "int4", fk: "customers", width: 120 }, { name: "rating", type: "int4", stats: true, width: 80 }, { name: "body", type: "text", nullable: true, width: 240 }],
    },
  };
}

const SIDEBAR_TABLES = ["categories", "category_revenue", "customers", "order_items", "orders", "products", "reviews"];

/* ============================================================
   SQL samples — results are computed from the sample data above,
   so edits in the table editor show up in query results
   ============================================================ */
interface PlanNode { depth: number; op: string; detail?: string; ms: number; rows: number; slowest?: boolean }
interface Result { columns: string[]; rows: (string | number)[][]; ms: number; chart: { x: number; y: number }; plan: { planning: number; execution: number; nodes: PlanNode[] } }
interface Query { id: string; name: string; sql: string; compute: (d: Record<string, TableDef>) => Result }

const money = (n: number) => n.toFixed(2);

const QUERIES: Query[] = [
  {
    id: "revenue",
    name: "Revenue by category",
    sql: `select c.name as category,
       count(distinct o.id) as orders,
       sum(oi.quantity * oi.unit_price) as revenue
from order_items oi
join orders o on o.id = oi.order_id
join products p on p.id = oi.product_id
join categories c on c.id = p.category_id
where o.status <> 'refunded'
group by c.name
order by revenue desc;`,
    compute: (d) => {
      const orders = new Map(d.orders!.rows.map((o) => [o.id, o]));
      const products = new Map(d.products!.rows.map((p) => [p.id, p]));
      const cats = new Map(d.categories!.rows.map((c) => [c.id, String(c.name)]));
      const agg = new Map<string, { orders: Set<Cell>; revenue: number }>();
      let joined = 0;
      for (const it of d.order_items!.rows) {
        const o = orders.get(it.order_id);
        if (!o || o.status === "refunded") continue;
        joined++;
        const cat = cats.get(products.get(it.product_id)?.category_id ?? -1) ?? "?";
        const a = agg.get(cat) ?? { orders: new Set(), revenue: 0 };
        a.orders.add(o.id ?? null);
        a.revenue += Number(it.quantity) * Number(it.unit_price);
        agg.set(cat, a);
      }
      const rows = [...agg.entries()].sort((a, b) => b[1].revenue - a[1].revenue).map(([c, a]) => [c, a.orders.size, money(a.revenue)]);
      const items = d.order_items!.rows.length;
      return {
        columns: ["category", "orders", "revenue"], rows, ms: 3, chart: { x: 0, y: 2 },
        plan: {
          planning: 0.41, execution: 1.12,
          nodes: [
            { depth: 0, op: "Sort", ms: 0.02, rows: rows.length },
            { depth: 1, op: "GroupAggregate", ms: 0.09, rows: rows.length },
            { depth: 2, op: "Sort", ms: 0.38, rows: joined, slowest: true },
            { depth: 3, op: "Hash Join", detail: "(p.category_id = c.id)", ms: 0.21, rows: joined },
            { depth: 4, op: "Hash Join", detail: "(oi.product_id = p.id)", ms: 0.17, rows: joined },
            { depth: 5, op: "Hash Join", detail: "(oi.order_id = o.id)", ms: 0.14, rows: joined },
            { depth: 6, op: "Seq Scan", detail: "on order_items oi", ms: 0.05, rows: items },
          ],
        },
      };
    },
  },
  {
    id: "status",
    name: "Orders by status",
    sql: `select status, count(*) as orders,
       round(avg(total), 2) as avg_total
from orders
group by status
order by orders desc;`,
    compute: (d) => {
      const agg = new Map<string, { n: number; sum: number }>();
      for (const o of d.orders!.rows) {
        const a = agg.get(String(o.status)) ?? { n: 0, sum: 0 };
        a.n++;
        a.sum += Number(o.total);
        agg.set(String(o.status), a);
      }
      const rows = [...agg.entries()].sort((a, b) => b[1].n - a[1].n).map(([s, a]) => [s, a.n, money(a.sum / a.n)]);
      return {
        columns: ["status", "orders", "avg_total"], rows, ms: 1, chart: { x: 0, y: 1 },
        plan: {
          planning: 0.12, execution: 0.31,
          nodes: [
            { depth: 0, op: "Sort", ms: 0.01, rows: rows.length },
            { depth: 1, op: "HashAggregate", ms: 0.19, rows: rows.length, slowest: true },
            { depth: 2, op: "Seq Scan", detail: "on orders", ms: 0.06, rows: d.orders!.rows.length },
          ],
        },
      };
    },
  },
  {
    id: "country",
    name: "Customers by country",
    sql: `select country, count(*) as customers
from customers
group by country
order by customers desc;`,
    compute: (d) => {
      const agg = new Map<string, number>();
      for (const c of d.customers!.rows) agg.set(String(c.country), (agg.get(String(c.country)) ?? 0) + 1);
      const rows = [...agg.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => [c, n]);
      return {
        columns: ["country", "customers"], rows, ms: 1, chart: { x: 0, y: 1 },
        plan: {
          planning: 0.09, execution: 0.18,
          nodes: [
            { depth: 0, op: "Sort", ms: 0.02, rows: rows.length },
            { depth: 1, op: "HashAggregate", ms: 0.08, rows: rows.length, slowest: true },
            { depth: 2, op: "Seq Scan", detail: "on customers", ms: 0.03, rows: d.customers!.rows.length },
          ],
        },
      };
    },
  },
];

const SQL_KEYWORDS = new Set(["select", "from", "join", "on", "where", "group", "by", "order", "desc", "asc", "as", "limit", "and", "or", "distinct", "not", "in"]);
const SQL_FUNCS = new Set(["count", "sum", "avg", "round", "min", "max"]);
function highlight(sql: string) {
  return sql.split(/(\s+|'[^']*'|[(),;*=<>]+)/).map((tok, i) => {
    const low = tok.toLowerCase();
    if (SQL_KEYWORDS.has(low)) return <span key={i} className={styles.kw}>{tok}</span>;
    if (SQL_FUNCS.has(low)) return <span key={i} className={styles.fn}>{tok}</span>;
    if (tok.startsWith("'")) return <span key={i} className={styles.str}>{tok}</span>;
    if (/^\d+$/.test(tok)) return <span key={i} className={styles.num}>{tok}</span>;
    return tok;
  });
}

/* ============================================================
   ER diagram layout
   ============================================================ */
const DIAGRAM_TABLES = ["categories", "products", "customers", "orders", "order_items", "reviews"];
const INITIAL_POS: Record<string, { x: number; y: number }> = {
  categories: { x: 24, y: 24 },
  customers: { x: 24, y: 214 },
  products: { x: 300, y: 24 },
  orders: { x: 300, y: 254 },
  order_items: { x: 576, y: 70 },
  reviews: { x: 576, y: 290 },
};
const NODE_W = 236, HEAD_H = 30, ROW_H = 22;

/* ============================================================
   Component
   ============================================================ */
type Tab = { kind: "table"; table: string } | { kind: "query" } | { kind: "diagram" };
type Popover =
  | { kind: "fk"; table: string; id: number; x: number; y: number }
  | { kind: "stats"; column: string; x: number; y: number }
  | { kind: "filter" }
  | null;

const DESIGN_W = 1120;
const DESIGN_H = 640;

export default function AppPreview() {
  const [data, setData] = useState(buildData);
  const [tabs, setTabs] = useState<Tab[]>([{ kind: "table", table: "orders" }, { kind: "query" }, { kind: "diagram" }]);
  const [active, setActive] = useState(0);
  const [side, setSide] = useState<"tables" | "sql">("tables");
  const [tableSearch, setTableSearch] = useState("");
  const [filter, setFilter] = useState<{ column: string; value: string } | null>(null);
  const [filterStage, setFilterStage] = useState<{ column?: string; text: string }>({ text: "" });
  const [popover, setPopover] = useState<Popover>(null);
  const [editing, setEditing] = useState<{ id: number; col: string; value: string } | null>(null);
  const [undo, setUndo] = useState<{ table: string; id: number; col: string; prev: Cell; next: Cell }[]>([]);
  const [redo, setRedo] = useState<typeof undo>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [view, setView] = useState<"data" | "structure">("data");
  const [selected, setSelected] = useState<number[]>([]);
  const [queryId, setQueryId] = useState(QUERIES[0]!.id);
  const [ran, setRan] = useState<{ id: string; running: boolean; result?: Result } | null>(null);
  const [resultTab, setResultTab] = useState<"results" | "explain" | "chart">("results");
  const [pos, setPos] = useState(INITIAL_POS);
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [palette, setPalette] = useState<{ open: boolean; text: string; index: number }>({ open: false, text: "", index: 0 });
  const [scale, setScale] = useState(1);

  const outerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  // Scale the fixed-size replica down to fit narrow screens
  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e!.contentRect.width / DESIGN_W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const tab = tabs[active]!;
  const tableName = tab.kind === "table" ? tab.table : null;
  const table = tableName && tableName !== "category_revenue" ? data[tableName] : null;

  const visibleRows = useMemo(() => {
    if (!table) return [];
    if (!filter) return table.rows;
    return table.rows.filter((r) => String(r[filter.column]) === filter.value);
  }, [table, filter]);

  const openTable = (name: string) => {
    setPopover(null);
    setEditing(null);
    setFilter(null);
    setFilterStage({ text: "" });
    setSelected([]);
    setView("data");
    const i = tabs.findIndex((t) => t.kind === "table" && t.table === name);
    if (i >= 0) return setActive(i);
    const next = [...tabs];
    const ti = next.findIndex((t) => t.kind === "table");
    if (ti >= 0) {
      next[ti] = { kind: "table", table: name };
      setTabs(next);
      setActive(ti);
    } else {
      setTabs([{ kind: "table", table: name }, ...next]);
      setActive(0);
    }
  };

  const openKind = (kind: "query" | "diagram") => {
    setPopover(null);
    const i = tabs.findIndex((t) => t.kind === kind);
    if (i >= 0) setActive(i);
  };

  /* ---- editing ---- */
  const commitEdit = () => {
    if (!editing || !tableName || !table) return;
    const row = table.rows.find((r) => r.id === editing.id);
    const col = table.columns.find((c) => c.name === editing.col)!;
    if (!row) return setEditing(null);
    const prev = row[editing.col] ?? null;
    let next: Cell = editing.value;
    if (/^(int|numeric)/.test(col.type)) {
      const n = Number(editing.value);
      if (Number.isNaN(n)) {
        flash(`"${editing.value}" isn't a valid ${col.type}`);
        return setEditing(null);
      }
      next = n;
    }
    if (col.type === "order_status" && !STATUSES.includes(editing.value as (typeof STATUSES)[number])) {
      flash(`invalid input value for enum order_status: "${editing.value}"`);
      return setEditing(null);
    }
    setEditing(null);
    if (String(prev) === String(next)) return;
    applyCell(tableName, editing.id, editing.col, next);
    setUndo((u) => [...u, { table: tableName, id: editing.id, col: editing.col, prev, next }]);
    setRedo([]);
    flash(`Saved ${editing.col} on row ${editing.id}`);
  };

  const applyCell = (t: string, id: number, col: string, value: Cell) => {
    setData((d) => ({ ...d, [t]: { ...d[t]!, rows: d[t]!.rows.map((r) => (r.id === id ? { ...r, [col]: value } : r)) } }));
  };

  const doUndo = () => {
    const last = undo.at(-1);
    if (!last) return;
    applyCell(last.table, last.id, last.col, last.prev);
    setUndo((u) => u.slice(0, -1));
    setRedo((r) => [...r, last]);
    flash(`Undid change to ${last.col}`);
  };
  const doRedo = () => {
    const last = redo.at(-1);
    if (!last) return;
    applyCell(last.table, last.id, last.col, last.next);
    setRedo((r) => r.slice(0, -1));
    setUndo((u) => [...u, last]);
    flash(`Redid change to ${last.col}`);
  };

  /* ---- SQL ---- */
  const query = QUERIES.find((q) => q.id === queryId)!;
  const run = () => {
    setRan({ id: query.id, running: true });
    const result = query.compute(data);
    window.setTimeout(() => setRan({ id: query.id, running: false, result }), 380);
  };
  const result = ran && ran.id === query.id && !ran.running ? ran.result ?? null : null;

  /* ---- palette ---- */
  const paletteItems = useMemo(() => {
    const items: { label: string; hint: string; icon: ReactNode; run: () => void }[] = [
      ...SIDEBAR_TABLES.filter((t) => t !== "category_revenue").map((t) => ({ label: t, hint: "Table", icon: I.table(14), run: () => openTable(t) })),
      ...QUERIES.map((q) => ({ label: q.name, hint: "Saved query", icon: I.code(14), run: () => { setQueryId(q.id); setSide("sql"); openKind("query"); } })),
      { label: "ER diagram of public", hint: "Action", icon: I.diagram(14), run: () => openKind("diagram") },
      { label: "New query", hint: "Ctrl T", icon: I.plus(14), run: () => openKind("query") },
    ];
    const q = palette.text.trim().toLowerCase();
    return q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette.text, tabs]);

  const openPalette = () => setPalette({ open: true, text: "", index: 0 });
  const runPalette = (i: number) => {
    const item = paletteItems[i];
    setPalette({ open: false, text: "", index: 0 });
    item?.run();
    rootRef.current?.focus();
  };

  const onRootKey = (e: ReactKeyboardEvent) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (palette.open) setPalette((p) => ({ ...p, open: false }));
      else openPalette();
    } else if (mod && e.key === "Enter" && tab.kind === "query") {
      e.preventDefault();
      run();
    } else if (mod && e.key.toLowerCase() === "z" && tab.kind === "table" && !editing) {
      e.preventDefault();
      if (e.shiftKey) doRedo();
      else doUndo();
    } else if (e.key === "Escape") {
      setPopover(null);
      setPalette((p) => ({ ...p, open: false }));
    }
  };

  /* ---- filter ---- */
  const filterColumns = table?.columns.filter((c) => c.stats) ?? [];
  const filterOptions = filterStage.column
    ? [...new Set(table?.rows.map((r) => String(r[filterStage.column!])) ?? [])].sort()
    : filterColumns.map((c) => c.name);
  const filterMatches = filterOptions.filter((o) => o.toLowerCase().includes(filterStage.text.trim().toLowerCase()));
  const chooseFilter = (option: string) => {
    if (!filterStage.column) {
      setFilterStage({ column: option, text: "" });
    } else {
      setFilter({ column: filterStage.column, value: option });
      setFilterStage({ text: "" });
      setPopover(null);
      setSelected([]);
    }
  };

  /* ---- diagram drag ---- */
  const drag = useRef<{ name: string; dx: number; dy: number } | null>(null);
  const onNodeDown = (e: ReactPointerEvent, name: string) => {
    const p = pos[name]!;
    drag.current = { name, dx: e.clientX / scale - p.x, dy: e.clientY / scale - p.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onNodeMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setPos((p) => ({ ...p, [d.name]: { x: Math.max(0, Math.min(820, e.clientX / scale - d.dx)), y: Math.max(0, Math.min(420, e.clientY / scale - d.dy)) } }));
  };
  const onNodeUp = () => (drag.current = null);

  const edges = useMemo(() => {
    const out: { from: string; fromCol: number; to: string; id: string }[] = [];
    for (const t of DIAGRAM_TABLES) {
      data[t]!.columns.forEach((c, i) => {
        if (c.fk) out.push({ from: t, fromCol: i, to: c.fk, id: `${t}.${c.name}` });
      });
    }
    return out;
  }, [data]);

  // Close popovers on outside click inside the preview
  useEffect(() => {
    if (!popover || popover.kind === "filter") return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(`.${styles.popover}`)) setPopover(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [popover]);

  /* ============================================================
     Render helpers
     ============================================================ */
  const renderCell = (row: Row, col: Column) => {
    const v = row[col.name];
    if (editing && editing.id === row.id && editing.col === col.name) {
      return (
        <input
          className={styles.cellInput}
          autoFocus
          value={editing.value}
          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") {
              e.stopPropagation();
              setEditing(null);
            }
          }}
        />
      );
    }
    if (v === null || v === undefined) return <span className={styles.null}>NULL</span>;
    if (typeof v === "boolean") return <span className={v ? styles.boolTrue : styles.boolFalse}>{v ? "true" : "false"}</span>;
    if (col.fk) {
      return (
        <span className={styles.fkCell}>
          <span>{String(v)}</span>
          <button
            type="button"
            className={styles.fkBtn}
            aria-label="View referencing record"
            onClick={(e) => {
              const box = (e.currentTarget.closest(`.${styles.canvas}`) as HTMLElement).getBoundingClientRect();
              const b = e.currentTarget.getBoundingClientRect();
              setPopover({ kind: "fk", table: col.fk!, id: Number(v), x: (b.left - box.left) / scale - 300, y: (b.bottom - box.top) / scale + 6 });
            }}
          >
            {I.arrow(11)}
          </button>
        </span>
      );
    }
    return String(v);
  };

  const statsFor = (column: string) => {
    const counts = new Map<string, number>();
    for (const r of table?.rows ?? []) counts.set(String(r[column]), (counts.get(String(r[column])) ?? 0) + 1);
    const total = table?.rows.length ?? 0;
    return { total, distinct: counts.size, values: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5) };
  };

  const tabLabel = (t: Tab) => (t.kind === "table" ? t.table : t.kind === "query" ? "Query 1" : "Diagram · public");
  const tabIcon = (t: Tab) => (t.kind === "table" ? I.table(13) : t.kind === "query" ? I.code(13) : I.diagram(13));

  return (
    <div ref={outerRef} className={styles.outer} style={{ height: DESIGN_H * scale }}>
      <div
        ref={rootRef}
        className={styles.app}
        style={{ width: DESIGN_W, height: DESIGN_H, transform: `scale(${scale})` }}
        tabIndex={0}
        onKeyDown={onRootKey}
        aria-label="Interactive PostCompass preview with sample data"
        role="application"
      >
        {/* Top bar */}
        <div className={styles.topbar}>
          <div className={styles.crumbs}>
            <span className={styles.serverDot} />
            <span className={styles.crumbStrong}>Acme Store</span>
            <span className={styles.crumbSep}>›</span>
            {I.db(13)}
            <span className={styles.crumbMono}>acme_store</span>
            <span className={styles.crumbChevron}>{I.chevron(11)}</span>
            <span className={styles.crumbSep}>›</span>
            <span className={styles.crumbMuted}>public</span>
          </div>
          <div className={styles.topActions}>
            <button type="button" className={styles.connectBtn} onClick={() => flash("Connection string copied (sample)")}>
              {I.plug(13)} Connect
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {/* Dock */}
          <div className={styles.dock}>
            <button type="button" className={styles.dockBtn} aria-label="Home" onClick={() => flash("Home is part of the full app")}>{I.home(16)}</button>
            <button type="button" className={styles.dockBtn} aria-label="Databases" onClick={() => flash("Databases is part of the full app")}>{I.db(16)}</button>
            <button type="button" className={styles.dockBtn} aria-label="Search (Ctrl K)" title="Search (Ctrl K)" onClick={openPalette}>{I.search(16)}</button>
            <span className={styles.dockSep} />
            <button type="button" className={`${styles.dockBtn} ${styles.dockActive}`} aria-label="Acme Store"><span className={styles.dockServer}>{I.db(15)}</span></button>
            <span className={styles.dockSpacer} />
            <button type="button" className={styles.dockBtn} aria-label="Settings" onClick={() => flash("Settings is part of the full app")}>{I.gear(15)}</button>
          </div>

          {/* Sidebar */}
          <div className={styles.sidebar}>
            <div className={styles.segment}>
              {(["tables", "sql"] as const).map((s) => (
                <button key={s} type="button" className={`${styles.segBtn} ${side === s ? styles.segActive : ""}`} onClick={() => setSide(s)}>
                  {s === "tables" ? "Tables" : "SQL"}
                </button>
              ))}
              <button type="button" className={styles.segBtn} onClick={() => flash("Functions, enums and policies live here in the full app")}>Database</button>
            </div>

            {side === "tables" ? (
              <>
                <div className={styles.schemaSelect}>
                  <span className={styles.schemaLabel}>schema</span>
                  <span className={styles.schemaName}>public</span>
                  <span className={styles.schemaChevron}>{I.chevron(12)}</span>
                </div>
                <div className={styles.searchRow}>
                  <label className={styles.searchBox}>
                    {I.search(12)}
                    <input placeholder="Search tables" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} />
                  </label>
                  <button type="button" className={styles.newTable} aria-label="New table" onClick={() => flash("The table designer is in the full app")}>{I.plus(14)}</button>
                </div>
                <div className={styles.tableList}>
                  {SIDEBAR_TABLES.filter((t) => t.includes(tableSearch.trim().toLowerCase())).map((t) => {
                    const isView = t === "category_revenue";
                    const count = isView ? "view" : String(data[t]!.rows.length);
                    const on = tableName === t && tab.kind === "table";
                    return (
                      <button key={t} type="button" className={`${styles.tableItem} ${on ? styles.tableItemOn : ""}`} onClick={() => (isView ? flash("Views open read-only in the full app") : openTable(t))}>
                        <span className={styles.tableItemIcon}>{isView ? I.view(13) : I.table(13)}</span>
                        <span className={styles.tableItemName}>{t}</span>
                        <span className={styles.tableItemCount}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className={styles.sqlSide}>
                <button type="button" className={styles.newQuery} onClick={() => openKind("query")}>
                  {I.plus(13)} New query <kbd>Ctrl T</kbd>
                </button>
                <div className={styles.sideLabel}>Saved</div>
                {QUERIES.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    className={`${styles.tableItem} ${queryId === q.id && tab.kind === "query" ? styles.tableItemOn : ""}`}
                    onClick={() => {
                      setQueryId(q.id);
                      setResultTab("results");
                      openKind("query");
                    }}
                  >
                    <span className={styles.tableItemIcon}>{I.code(13)}</span>
                    <span className={styles.tableItemName} style={{ fontFamily: "var(--font-sans)" }}>{q.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Canvas */}
          <div className={styles.canvas}>
            <div className={styles.tabs}>
              {tabs.map((t, i) => (
                <button key={i} type="button" className={`${styles.tab} ${i === active ? styles.tabOn : ""}`} onClick={() => { setActive(i); setPopover(null); }}>
                  <span className={styles.tabIcon}>{tabIcon(t)}</span>
                  {tabLabel(t)}
                </button>
              ))}
              <button type="button" className={styles.tabAdd} aria-label="New query" onClick={() => openKind("query")}>{I.plus(13)}</button>
            </div>

            {/* ---------------- Table editor ---------------- */}
            {tab.kind === "table" && table && (
              <div className={styles.editor}>
                <div className={styles.toolbar}>
                  <div className={styles.filterBar} onClick={() => setPopover({ kind: "filter" })}>
                    {I.search(13)}
                    {filter && (
                      <span className={styles.pill}>
                        <span>{filter.column}</span>
                        <span className={styles.pillOp}>=</span>
                        <strong>{filter.value}</strong>
                        <button type="button" aria-label={`Remove ${filter.column} filter`} onClick={(e) => { e.stopPropagation(); setFilter(null); }}>{I.x(11)}</button>
                      </span>
                    )}
                    {filterStage.column && (
                      <span className={styles.pill}>
                        <span>{filterStage.column}</span>
                        <span className={styles.pillOp}>=</span>
                      </span>
                    )}
                    <input
                      className={styles.filterInput}
                      placeholder={filter || filterStage.column ? "" : filterColumns.length ? `Filter… try "${filterColumns[0]!.name}"` : "Search or filter..."}
                      value={filterStage.text}
                      onFocus={() => setPopover({ kind: "filter" })}
                      onChange={(e) => setFilterStage((s) => ({ ...s, text: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && filterMatches[0]) chooseFilter(filterMatches[0]);
                        if (e.key === "Backspace" && !filterStage.text && filterStage.column) setFilterStage({ text: "" });
                        if (e.key === "Escape") { setPopover(null); (e.target as HTMLInputElement).blur(); }
                      }}
                    />
                    {popover?.kind === "filter" && filterMatches.length > 0 && (
                      <div className={`${styles.popover} ${styles.filterMenu}`} onMouseDown={(e) => e.preventDefault()}>
                        {filterMatches.map((o) => (
                          <button key={o} type="button" className={styles.menuItem} onClick={(e) => { e.stopPropagation(); chooseFilter(o); }}>
                            <span>{o}</span>
                            {!filterStage.column && <span className={styles.menuHint}>{table.columns.find((c) => c.name === o)?.type}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={styles.toolbarRight}>
                    {toast && <span className={styles.toast}>{I.check(12)} {toast}</span>}
                    <button type="button" className={styles.ghostBtn} onClick={() => flash("Multi-column sort is in the full app")}>{I.sort(13)} Sort</button>
                    <button type="button" className={styles.insertBtn} onClick={() => flash("Insert row, paste rows and CSV import are in the full app")}>{I.plus(13)} Insert {I.down(12)}</button>
                    <button type="button" className={styles.iconBtn} aria-label="Undo" disabled={!undo.length} onClick={doUndo}>{I.undo(14)}</button>
                    <button type="button" className={styles.iconBtn} aria-label="Redo" disabled={!redo.length} onClick={doRedo}>{I.redo(14)}</button>
                  </div>
                </div>

                {view === "data" ? (
                  <div className={styles.grid}>
                    <table>
                      <thead>
                        <tr>
                          <th className={styles.checkCol}>
                            <input type="checkbox" aria-label="Select all rows" checked={selected.length > 0 && selected.length === visibleRows.length} onChange={(e) => setSelected(e.target.checked ? visibleRows.map((r) => Number(r.id)) : [])} />
                          </th>
                          {table.columns.map((c) => (
                            <th key={c.name} style={{ width: c.width, minWidth: c.width }}>
                              <span className={styles.th}>
                                {c.pk && <span className={styles.pk}>{I.key(12)}</span>}
                                {c.fk && <span className={styles.fkIcon}>{I.link(12)}</span>}
                                <span className={styles.thName}>{c.name}</span>
                                <span className={styles.thType}>{c.type}</span>
                                {c.stats && (
                                  <button
                                    type="button"
                                    className={styles.statsBtn}
                                    aria-label={`${c.name} stats`}
                                    onClick={(e) => {
                                      const box = (e.currentTarget.closest(`.${styles.canvas}`) as HTMLElement).getBoundingClientRect();
                                      const b = e.currentTarget.getBoundingClientRect();
                                      setPopover({ kind: "stats", column: c.name, x: (b.left - box.left) / scale - 10, y: (b.bottom - box.top) / scale + 6 });
                                    }}
                                  >
                                    {I.stats(12)}
                                  </button>
                                )}
                              </span>
                            </th>
                          ))}
                          <th className={styles.fillCol} />
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows.slice(0, 60).map((row) => {
                          const id = Number(row.id);
                          const sel = selected.includes(id);
                          return (
                            <tr key={id} className={sel ? styles.rowSel : ""}>
                              <td className={styles.checkCol}>
                                <input type="checkbox" aria-label={`Select row ${id}`} checked={sel} onChange={() => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))} />
                              </td>
                              {table.columns.map((c) => (
                                <td
                                  key={c.name}
                                  className={`${c.pk ? styles.pkCell : ""} ${editing?.id === id && editing.col === c.name ? styles.cellEditing : ""}`}
                                  onDoubleClick={() => !c.pk && !c.fk && setEditing({ id, col: c.name, value: String(row[c.name] ?? "") })}
                                  title={c.pk || c.fk ? undefined : "Double-click to edit"}
                                >
                                  {renderCell(row, c)}
                                </td>
                              ))}
                              <td className={styles.fillCol} />
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={styles.structure}>
                    <div className={styles.structHead}>
                      <span>Columns</span>
                      <span className={styles.structCount}>{table.columns.length}</span>
                    </div>
                    {table.columns.map((c) => (
                      <div key={c.name} className={styles.structRow}>
                        <span className={styles.structName}>
                          {c.pk ? <span className={styles.pk}>{I.key(12)}</span> : c.fk ? <span className={styles.fkIcon}>{I.link(12)}</span> : <span className={styles.structDot} />}
                          {c.name}
                        </span>
                        <span className={styles.structType}>{c.type}</span>
                        <span className={styles.structMeta}>
                          {c.pk ? <span className={styles.badge}>PRIMARY KEY</span> : null}
                          {c.fk ? <span className={styles.badgeBlue}>→ {c.fk}.id</span> : null}
                          {c.nullable ? <span className={styles.badgeMuted}>nullable</span> : !c.pk ? <span className={styles.badgeMuted}>not null</span> : null}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className={styles.footer}>
                  <span className={styles.page}>‹ Page <span className={styles.pageBox}>1</span> of 1 ›</span>
                  <span className={styles.footChip}>100 rows</span>
                  <span className={styles.records}>{visibleRows.length.toLocaleString("en-US")} records{selected.length ? ` · ${selected.length} selected` : ""}</span>
                  <span className={styles.viewSwitch}>
                    <button type="button" className={view === "data" ? styles.viewOn : ""} onClick={() => setView("data")}>Data</button>
                    <button type="button" className={view === "structure" ? styles.viewOn : ""} onClick={() => setView("structure")}>Structure</button>
                  </span>
                </div>
              </div>
            )}

            {/* ---------------- SQL editor ---------------- */}
            {tab.kind === "query" && (
              <div className={styles.sql}>
                <div className={styles.sqlBar}>
                  <span className={styles.dbPick}>{I.db(12)} acme_store {I.chevron(11)}</span>
                  <span className={styles.queryPick}>
                    {QUERIES.map((q) => (
                      <button key={q.id} type="button" className={q.id === queryId ? styles.queryPickOn : ""} onClick={() => { setQueryId(q.id); setResultTab("results"); }}>
                        {q.name}
                      </button>
                    ))}
                  </span>
                  <button type="button" className={styles.runBtn} onClick={run} disabled={ran?.running}>
                    {I.play(11)} {ran?.running ? "Running…" : "Run"} <kbd>Ctrl ↵</kbd>
                  </button>
                </div>
                <pre className={styles.code}>
                  <span className={styles.lines} aria-hidden="true">
                    {query.sql.split("\n").map((_, i) => <span key={i}>{i + 1}</span>)}
                  </span>
                  <code>{highlight(query.sql)}</code>
                </pre>
                <div className={styles.results}>
                  <div className={styles.resultTabs}>
                    {(["results", "explain", "chart"] as const).map((r) => (
                      <button key={r} type="button" className={resultTab === r ? styles.resultTabOn : ""} onClick={() => setResultTab(r)}>
                        {r === "results" ? I.table(12) : r === "explain" ? I.gauge(12) : I.bars(12)}
                        {r[0]!.toUpperCase() + r.slice(1)}
                      </button>
                    ))}
                    {result && <span className={styles.resultMeta}>{result.rows.length} rows · {result.ms} ms</span>}
                  </div>
                  {!result ? (
                    <div className={styles.empty}>
                      {ran?.running ? <span className={styles.spinner} /> : null}
                      <span>{ran?.running ? "Running query…" : <>Press <kbd>Ctrl ↵</kbd> or <strong>Run</strong> to see results</>}</span>
                    </div>
                  ) : resultTab === "results" ? (
                    <div className={styles.resultGrid}>
                      <table>
                        <thead><tr>{result.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                        <tbody>{result.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
                      </table>
                    </div>
                  ) : resultTab === "explain" ? (
                    <div className={styles.plan}>
                      <div className={styles.planHead}>
                        <span className={styles.badge}>EXPLAIN ANALYZE</span>
                        <span>Planning {result.plan.planning} ms</span>
                        <strong>Execution {result.plan.execution} ms</strong>
                        <span className={styles.planNote}>Ran inside a transaction that was rolled back</span>
                      </div>
                      {result.plan.nodes.map((n, i) => {
                        const max = Math.max(...result.plan.nodes.map((x) => x.ms));
                        return (
                          <div key={i} className={`${styles.planRow} ${n.slowest ? styles.planSlow : ""}`}>
                            <span className={styles.planOp} style={{ paddingLeft: n.depth * 16 }}>
                              {n.depth > 0 && <span className={styles.planTree}>└</span>}
                              <strong>{n.op}</strong>
                              {n.detail && <span className={styles.planDetail}>{n.detail}</span>}
                              {n.slowest && <span className={styles.slowBadge}>slowest step</span>}
                            </span>
                            <span className={styles.planBar}><span style={{ width: `${Math.max(3, (n.ms / max) * 100)}%` }} /></span>
                            <span className={styles.planMs}>{n.ms} ms</span>
                            <span className={styles.planRows}>{n.rows.toLocaleString("en-US")} rows</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <BarChart labels={result.rows.map((r) => String(r[result.chart.x]))} values={result.rows.map((r) => Number(r[result.chart.y]))} xName={result.columns[result.chart.x]!} metric={result.columns[result.chart.y]!} />
                  )}
                </div>
              </div>
            )}

            {/* ---------------- ER diagram ---------------- */}
            {tab.kind === "diagram" && (
              <div className={styles.diagram}>
                <div className={styles.diagramBar}>
                  <span><strong>6 tables</strong> · 6 relations</span>
                  <span className={styles.legend}>{I.key(12)} Primary key</span>
                  <span className={styles.legendBlue}>{I.link(12)} Foreign key</span>
                  <span className={styles.diagramHint}>Drag tables · hover to trace relations</span>
                </div>
                <div className={styles.diagramCanvas} onPointerMove={onNodeMove} onPointerUp={onNodeUp}>
                  <svg className={styles.edges} width="100%" height="100%">
                    {edges.map((e) => {
                      const a = pos[e.from]!, b = pos[e.to]!;
                      const y1 = a.y + HEAD_H + e.fromCol * ROW_H + ROW_H / 2;
                      const y2 = b.y + HEAD_H + ROW_H / 2;
                      const leftToRight = a.x > b.x;
                      const x1 = leftToRight ? a.x : a.x + NODE_W;
                      const x2 = leftToRight ? b.x + NODE_W : b.x;
                      const mx = (x1 + x2) / 2;
                      const on = hoverNode === e.from || hoverNode === e.to;
                      return (
                        <path
                          key={e.id}
                          d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                          className={`${styles.edge} ${on ? styles.edgeOn : ""} ${hoverNode && !on ? styles.edgeDim : ""}`}
                        />
                      );
                    })}
                  </svg>
                  {DIAGRAM_TABLES.map((t) => {
                    const p = pos[t]!;
                    const related = hoverNode === t || edges.some((e) => (e.from === hoverNode && e.to === t) || (e.to === hoverNode && e.from === t));
                    return (
                      <div
                        key={t}
                        className={`${styles.node} ${hoverNode === t ? styles.nodeOn : ""} ${hoverNode && !related ? styles.nodeDim : ""}`}
                        style={{ left: p.x, top: p.y, width: NODE_W }}
                        onPointerDown={(e) => onNodeDown(e, t)}
                        onPointerEnter={() => setHoverNode(t)}
                        onPointerLeave={() => setHoverNode(null)}
                        onDoubleClick={() => openTable(t)}
                      >
                        <div className={styles.nodeHead}>{I.table(12)} {t}<span>{data[t]!.columns.length} cols</span></div>
                        {data[t]!.columns.map((c) => (
                          <div key={c.name} className={styles.nodeRow}>
                            <span className={styles.nodeCol}>
                              {c.pk ? <span className={styles.pk}>{I.key(11)}</span> : c.fk ? <span className={styles.fkIcon}>{I.link(11)}</span> : <span className={styles.nodeGap} />}
                              {c.name}
                            </span>
                            <span className={styles.nodeType}>{c.fk ? `→ ${c.fk}.id` : c.type}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ---------------- Popovers ---------------- */}
            {popover?.kind === "fk" && (() => {
              const ref = data[popover.table]!;
              const row = ref.rows.find((r) => r.id === popover.id);
              if (!row) return null;
              const cols = ref.columns.slice(0, 4);
              return (
                <div className={`${styles.popover} ${styles.fkPop}`} style={{ left: Math.max(8, popover.x), top: popover.y }}>
                  <div className={styles.popTitle}>Referencing record from <code>public.{ref.name}</code></div>
                  <table>
                    <thead><tr>{cols.map((c) => <th key={c.name}>{c.name}</th>)}</tr></thead>
                    <tbody><tr>{cols.map((c) => <td key={c.name}>{String(row[c.name])}</td>)}</tr></tbody>
                  </table>
                  <div className={styles.popFoot}>
                    <button type="button" className={styles.ghostBtn} onClick={() => openTable(ref.name)}>Open table {I.out(12)}</button>
                  </div>
                </div>
              );
            })()}

            {popover?.kind === "stats" && (() => {
              const s = statsFor(popover.column);
              return (
                <div className={`${styles.popover} ${styles.statsPop}`} style={{ left: Math.min(popover.x, 560), top: popover.y }}>
                  <div className={styles.popTitle}><code>{popover.column}</code></div>
                  <div className={styles.statTiles}>
                    <div><span>Rows</span><strong>{s.total}</strong></div>
                    <div><span>Distinct</span><strong>{s.distinct}</strong></div>
                    <div><span>NULL</span><strong>0%</strong></div>
                  </div>
                  <div className={styles.statLabel}>Values</div>
                  {s.values.map(([v, n]) => (
                    <button
                      type="button"
                      key={v}
                      className={styles.statRow}
                      onClick={() => { setFilter({ column: popover.column, value: v }); setPopover(null); }}
                      title={`Filter by ${v}`}
                    >
                      <span className={styles.statTop}><span>{v}</span><span>{n} · {((n / s.total) * 100).toFixed(1)}%</span></span>
                      <span className={styles.statBar}><span style={{ width: `${(n / s.values[0]![1]) * 100}%` }} /></span>
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Command palette */}
        {palette.open && (
          <div className={styles.paletteBackdrop} onMouseDown={() => setPalette((p) => ({ ...p, open: false }))}>
            <div className={styles.palette} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Command palette">
              <div className={styles.paletteInput}>
                {I.search(15)}
                <input
                  autoFocus
                  placeholder="Jump to a table, query or action…"
                  value={palette.text}
                  onChange={(e) => setPalette({ open: true, text: e.target.value, index: 0 })}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") { e.preventDefault(); setPalette((p) => ({ ...p, index: Math.min(paletteItems.length - 1, p.index + 1) })); }
                    if (e.key === "ArrowUp") { e.preventDefault(); setPalette((p) => ({ ...p, index: Math.max(0, p.index - 1) })); }
                    if (e.key === "Enter") { e.preventDefault(); runPalette(palette.index); }
                  }}
                />
                <kbd>Esc</kbd>
              </div>
              <div className={styles.paletteList}>
                {paletteItems.length === 0 && <div className={styles.paletteEmpty}>No matches</div>}
                {paletteItems.map((item, i) => (
                  <button key={item.label} type="button" className={`${styles.paletteItem} ${i === palette.index ? styles.paletteItemOn : ""}`} onMouseEnter={() => setPalette((p) => ({ ...p, index: i }))} onClick={() => runPalette(i)}>
                    <span className={styles.paletteIcon}>{item.icon}</span>
                    <span>{item.label}</span>
                    <span className={styles.paletteHint}>{item.hint}</span>
                  </button>
                ))}
              </div>
              <div className={styles.paletteFoot}><kbd>↑</kbd><kbd>↓</kbd> move <kbd>↵</kbd> run <span /> <kbd>Ctrl</kbd><kbd>K</kbd> toggle</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BarChart({ labels, values, xName, metric }: { labels: string[]; values: number[]; xName: string; metric: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...values);
  return (
    <div className={styles.chart}>
      <div className={styles.chartHead}>
        <span>X axis <strong>{xName}</strong></span>
        <span>Y axis <strong>{metric}</strong></span>
        <span className={styles.chartValue}>{hover !== null ? `${labels[hover]}: ${values[hover]!.toLocaleString("en-US")}` : "Hover a bar"}</span>
      </div>
      <div className={styles.bars}>
        {values.map((v, i) => (
          <div key={i} className={styles.barCol} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div className={`${styles.bar} ${hover === i ? styles.barOn : ""}`} style={{ height: `${(v / max) * 100}%` }} />
            <span className={styles.barLabel}>{labels[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
