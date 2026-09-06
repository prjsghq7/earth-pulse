'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { geoArea, geoCentroid, geoEqualEarth, geoGraticule10, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  Database,
  ExternalLink,
  Filter,
  Gauge,
  Layers3,
  LocateFixed,
  MapPinned,
  MapPin,
  Radar,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  loadEarthquakeIndex,
  loadEvent,
  loadTodayBoard,
  type CollectionState,
  type EarthPulseEvent,
  type EarthPulseIndexEvent,
  type TodayBoardData,
} from '@/lib/earth-pulse-data';

const recentEvents = [
  {
    id: 'us7000ne01',
    magnitude: '6.2',
    place: 'South of the Fiji Islands',
    time: '14:08 KST',
    depth: '582 km',
    tone: 'critical',
    latitude: -23.42,
    longitude: 179.62,
  },
  {
    id: 'us7000ne02',
    magnitude: '5.7',
    place: 'Tonga region',
    time: '10:42 KST',
    depth: '34 km',
    tone: 'warm',
    latitude: -20.58,
    longitude: -174.91,
  },
  {
    id: 'us7000ne03',
    magnitude: '4.8',
    place: 'Off the coast of Central America',
    time: '08:19 KST',
    depth: '16 km',
    tone: 'calm',
    latitude: 10.21,
    longitude: -87.44,
  },
];

const allEvents = [
  ...recentEvents,
  { id: 'us7000ne04', magnitude: '4.6', place: 'Kuril Islands', time: '06:31 KST', depth: '78 km', tone: 'calm', latitude: 47.18, longitude: 153.42 },
  { id: 'us7000ne05', magnitude: '4.5', place: 'Mid-Indian Ridge', time: '04:22 KST', depth: '10 km', tone: 'calm', latitude: -27.31, longitude: 73.82 },
  { id: 'us7000ne06', magnitude: '4.3', place: 'Northern Colombia', time: '01:16 KST', depth: '145 km', tone: 'calm', latitude: 7.92, longitude: -73.18 },
];

type PrimaryPage = 'today' | 'map' | 'explore';

const worldTopology = world as unknown as Topology<{ countries: GeometryCollection }>;
const worldGeo = feature(worldTopology, worldTopology.objects.countries);
const mapProjection = geoEqualEarth().fitExtent(
  [[22, 20], [938, 480]],
  { type: 'Sphere' },
);
const worldPath = geoPath(mapProjection)(worldGeo) ?? '';
const graticulePath = geoPath(mapProjection)(geoGraticule10()) ?? '';
const koreanCountryNames: Record<string, string> = {
  'Afghanistan': '아프가니스탄', 'Argentina': '아르헨티나', 'Australia': '호주', 'Bangladesh': '방글라데시', 'Bolivia': '볼리비아', 'Brazil': '브라질', 'Cambodia': '캄보디아', 'Canada': '캐나다', 'Chile': '칠레', 'China': '중국', 'Colombia': '콜롬비아', 'Costa Rica': '코스타리카', 'Cuba': '쿠바', 'Ecuador': '에콰도르', 'Egypt': '이집트', 'Ethiopia': '에티오피아', 'Fiji': '피지', 'France': '프랑스', 'Germany': '독일', 'Greece': '그리스', 'Guatemala': '과테말라', 'Iceland': '아이슬란드', 'India': '인도', 'Indonesia': '인도네시아', 'Iran': '이란', 'Iraq': '이라크', 'Ireland': '아일랜드', 'Israel': '이스라엘', 'Italy': '이탈리아', 'Japan': '일본', 'Kenya': '케냐', 'Malaysia': '말레이시아', 'Mexico': '멕시코', 'Mongolia': '몽골', 'Morocco': '모로코', 'Myanmar': '미얀마', 'Nepal': '네팔', 'New Zealand': '뉴질랜드', 'Nicaragua': '니카라과', 'Norway': '노르웨이', 'Pakistan': '파키스탄', 'Panama': '파나마', 'Papua New Guinea': '파푸아뉴기니', 'Peru': '페루', 'Philippines': '필리핀', 'Portugal': '포르투갈', 'Russian Federation': '러시아', 'Russia': '러시아', 'Saudi Arabia': '사우디아라비아', 'Singapore': '싱가포르', 'Solomon Is.': '솔로몬제도', 'South Africa': '남아프리카공화국', 'South Korea': '대한민국', 'Spain': '스페인', 'Sri Lanka': '스리랑카', 'Sudan': '수단', 'Sweden': '스웨덴', 'Switzerland': '스위스', 'Taiwan': '대만', 'Thailand': '태국', 'Tonga': '통가', 'Turkey': '튀르키예', 'Ukraine': '우크라이나', 'United Arab Emirates': '아랍에미리트', 'United Kingdom': '영국', 'United States of America': '미국', 'Uruguay': '우루과이', 'Vanuatu': '바누아투', 'Venezuela': '베네수엘라', 'Vietnam': '베트남',
};
const worldCountryLabels = worldGeo.features.flatMap((country) => {
  const rawName = typeof country.properties?.name === 'string' ? country.properties.name : null;
  const point = mapProjection(geoCentroid(country));
  const name = rawName ? koreanCountryNames[rawName] : null;
  if (!name || !point) return [];
  return [{ name, x: point[0], y: point[1], area: geoArea(country), kind: 'country' as const }];
});
const mapOceanLabels = [
  { name: '북태평양', coordinates: [-160, 28] as [number, number] },
  { name: '남태평양', coordinates: [-135, -30] as [number, number] },
  { name: '북대서양', coordinates: [-38, 33] as [number, number] },
  { name: '남대서양', coordinates: [-25, -27] as [number, number] },
  { name: '인도양', coordinates: [76, -22] as [number, number] },
  { name: '동해', coordinates: [137, 39] as [number, number] },
  { name: '필리핀해', coordinates: [132, 18] as [number, number] },
].flatMap((label) => {
  const point = mapProjection(label.coordinates);
  return point ? [{ ...label, x: point[0], y: point[1], kind: 'ocean' as const, area: 0 }] : [];
});
const spherePath = geoPath(mapProjection)({ type: 'Sphere' }) ?? '';

function routeFromHash() {
  if (typeof window === 'undefined') return 'today';
  return window.location.hash.replace(/^#\/?/, '') || 'today';
}

function formatKoreanDate(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

function formatKstTime(iso: string | null | undefined, withSeconds = false) {
  if (!iso) return '확인 불가';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hourCycle: 'h23',
  }).format(new Date(iso));
}

function formatDateTime(iso: string, timeZone: 'Asia/Seoul' | 'UTC') {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

function shortDate(dateString: string) {
  const [, month, day] = dateString.split('-');
  return `${Number(month)}.${Number(day)}`;
}

function addDays(dateString: string, amount: number) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function formText(value: FormDataEntryValue | null, fallback: string) {
  return typeof value === 'string' ? value : fallback;
}

function weekdayLabel(dateString: string, today: string) {
  if (dateString === today) return '오늘';
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'UTC', weekday: 'short' }).format(new Date(`${dateString}T00:00:00Z`));
}

function eventTone(magnitude: number) {
  if (magnitude >= 6) return 'critical';
  if (magnitude >= 5) return 'warm';
  return 'calm';
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

function PulseLine({ dataThrough, events }: { dataThrough: string | null | undefined; events: EarthPulseEvent[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const ordered = [...events].sort((a, b) => a.timeUtc.localeCompare(b.timeUtc));
  const maximum = Math.max(ordered.length, 1);
  const points = ordered.map((event, index) => {
    const [hour, minute, second] = event.timeKst.split(':').map(Number);
    const x = ((hour * 3600 + minute * 60 + second) / 86400) * 740;
    const y = 105 - ((index + 1) / maximum) * 88;
    return { event, x, y, count: index + 1 };
  });
  const linePath = points.reduce((path, point) => `${path} H${point.x.toFixed(2)} V${point.y.toFixed(2)}`, 'M0 105');
  const lastX = points.at(-1)?.x ?? 0;
  const lastY = points.at(-1)?.y ?? 105;
  const coverageTime = formatKstTime(dataThrough, true);
  const [coverageHour = 0, coverageMinute = 0, coverageSecond = 0] = coverageTime.split(':').map(Number);
  const coverageX = dataThrough && Number.isFinite(coverageHour)
    ? Math.min(740, Math.max(lastX, ((coverageHour * 3600 + coverageMinute * 60 + coverageSecond) / 86400) * 740))
    : lastX;
  const areaPath = `${linePath} V116 H0 Z`;
  const hoveredPoint = hoveredIndex === null ? null : points[hoveredIndex] ?? null;
  const tooltipLeft = hoveredPoint ? (hoveredPoint.x / 740) * 100 : 0;
  // The upper-right area is reserved for the running total and current-time label.
  // Keep a hovered late-day point's detail card below that fixed information.
  const tooltipTop = hoveredPoint ? Math.min(82, Math.max(5, ((hoveredPoint.y + (hoveredPoint.y < 48 ? 38 : -40)) / 116) * 100)) : 0;
  const tooltipPlace = hoveredPoint && hoveredPoint.event.place.length > 21 ? `${hoveredPoint.event.place.slice(0, 21)}…` : hoveredPoint?.event.place;

  return (
    <div
      aria-label={`오늘 시간별 누적 지진 건수. 현재 ${events.length}건.`}
      className="pulse-line"
      onMouseLeave={() => setHoveredIndex(null)}
      onMouseMove={(event) => {
        if (!points.length) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width) * 740;
        const nearest = points.reduce((best, point, index) => Math.abs(point.x - x) < Math.abs(points[best].x - x) ? index : best, 0);
        setHoveredIndex(nearest);
      }}
    >
      <svg aria-hidden="true" className="pulse-line-svg" preserveAspectRatio="none" viewBox="0 0 740 116">
        <defs>
          <linearGradient id="pulseStroke" x1="0" x2="1"><stop offset="0" stopColor="#5de0c3" /><stop offset="0.72" stopColor="#5de0c3" /><stop offset="1" stopColor="#ff8a76" /></linearGradient>
          <linearGradient id="pulseArea" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#5de0c3" stopOpacity=".22" /><stop offset="1" stopColor="#5de0c3" stopOpacity="0" /></linearGradient>
        </defs>
        <path className="pulse-area" d={areaPath} fill="url(#pulseArea)" />
        <path className="pulse-trace" d={linePath} fill="none" stroke="url(#pulseStroke)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
        {dataThrough && <path className="pulse-coverage" d={`M${lastX} ${lastY} H${coverageX}`} fill="none" stroke="#70cbb5" strokeLinecap="round" strokeWidth="2.4" />}
        {ordered.length > 0 && <circle cx={lastX} cy={lastY} fill="#ff8a76" r="4.5" stroke="#173842" strokeWidth="2" />}
        {hoveredPoint && <g className="pulse-hover"><line x1={hoveredPoint.x} x2={hoveredPoint.x} y1="0" y2="116" stroke="#b9e7da" strokeDasharray="3 3" /><circle cx={hoveredPoint.x} cy={hoveredPoint.y} fill="#fffdf7" r="4.6" stroke="#5de0c3" strokeWidth="2.5" /></g>}
      </svg>
      {hoveredPoint && <div className={`pulse-html-tooltip ${hoveredPoint.x > 490 ? 'align-left' : ''}`} style={{ left: `${tooltipLeft}%`, top: `${tooltipTop}%` }}><span><strong>{hoveredPoint.event.timeKst.slice(0, 5)} KST</strong><em>누적 {hoveredPoint.count}건</em></span><small>규모 {hoveredPoint.event.magnitude.toFixed(1)} · {tooltipPlace}</small></div>}
    </div>
  );
}

function TopNavigation({ active, collectionState = 'fresh' }: { active: PrimaryPage; collectionState?: CollectionState }) {
  const stateLabel = collectionState === 'fresh' ? '수집 정상' : collectionState === 'delayed' ? '업데이트 지연' : '데이터 확인 불가';
  const brandContent = <><BrandMark /><span><strong>Earth Pulse</strong><small>지구 맥박</small></span></>;
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <a aria-label="Earth Pulse 홈으로" className="brand" href="#/today">{brandContent}</a>

        <nav className="desktop-nav" aria-label="주요 화면">
          <a aria-current={active === 'today' ? 'page' : undefined} className={`nav-link ${active === 'today' ? 'is-active' : ''}`} href="#/today">오늘</a>
          <a aria-current={active === 'map' ? 'page' : undefined} className={`nav-link ${active === 'map' ? 'is-active' : ''}`} href="#/map">지진 지도</a>
          <a aria-current={active === 'explore' ? 'page' : undefined} className={`nav-link ${active === 'explore' ? 'is-active' : ''}`} href="#/explore">기록 탐색</a>
        </nav>

        <div className="header-actions">
          <Badge className={`live-badge is-${collectionState}`} variant="outline">
            <span className="live-dot" /> {stateLabel}
          </Badge>
        </div>
      </div>
    </header>
  );
}

function MobileNavigation({ active }: { active: PrimaryPage }) {
  return (
    <nav className="mobile-nav" aria-label="모바일 주요 화면">
      <a aria-current={active === 'today' ? 'page' : undefined} className={active === 'today' ? 'is-active' : ''} href="#/today"><Activity /><span>오늘</span></a>
      <a aria-current={active === 'map' ? 'page' : undefined} className={active === 'map' ? 'is-active' : ''} href="#/map"><MapPinned /><span>지도</span></a>
      <a aria-current={active === 'explore' ? 'page' : undefined} className={active === 'explore' ? 'is-active' : ''} href="#/explore"><Search /><span>탐색</span></a>
    </nav>
  );
}

function ScreenFrame({ active, children, collectionState }: { active: PrimaryPage; children: ReactNode; collectionState?: CollectionState }) {
  return (
    <div className="site-frame">
      <TopNavigation active={active} collectionState={collectionState} />
      {children}
      <MobileNavigation active={active} />
    </div>
  );
}

function EventResultRow({ event, source }: { event: (typeof allEvents)[number]; source: string }) {
  return (
    <button className="event-row event-row-wide" onClick={() => { window.location.hash = `/event/${event.id}?from=${encodeURIComponent(source)}`; }} type="button">
      <span className={`magnitude-token ${event.tone}`}>{event.magnitude}</span>
      <span className="event-place">
        <strong>{event.place}</strong>
        <small><MapPin /> {event.depth} · {event.time}</small>
      </span>
      <span className="event-type">Mww</span>
      <span className="event-state"><CheckCircle2 /> 검토 완료</span>
      <ChevronRight className="event-chevron" />
    </button>
  );
}

function SearchEventResultRow({ event }: { event: EarthPulseIndexEvent }) {
  const reviewed = event.status === 'reviewed';
  return (
    <button
      className="event-row event-row-wide"
      onClick={() => {
        window.location.hash = `/event/${event.id}?from=explore&month=${event.dateKst.slice(0, 7)}`;
      }}
      type="button"
    >
      <span className={`magnitude-token ${eventTone(event.magnitude)}`}>{event.magnitude.toFixed(1)}</span>
      <span className="event-place">
        <strong>{event.place}</strong>
        <small><MapPin /> {event.depthKm === null ? '깊이 자료 없음' : `${event.depthKm.toFixed(1)} km`} · {formatKstTime(event.timeUtc)} KST</small>
      </span>
      <span className="event-type">{event.magnitudeType ?? '유형 없음'}</span>
      <span className="event-state">{reviewed ? <CheckCircle2 /> : <CircleAlert />} {reviewed ? '검토 완료' : event.status}</span>
      <ChevronRight className="event-chevron" />
    </button>
  );
}

interface MapFilters {
  startDate: string;
  endDate: string;
  minMagnitude: string;
  maxDepth: string;
}

function mapFiltersFromQuery(targetDate: string, query: string): MapFilters {
  const values = new URLSearchParams(query);
  const startDate = values.get('start') ?? targetDate;
  const endDate = values.get('end') ?? targetDate;
  return {
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : targetDate,
    endDate: /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : targetDate,
    minMagnitude: values.get('min') ?? '4.0',
    maxDepth: values.get('depth') ?? '700',
  };
}

function syncMapUrl(filters: MapFilters) {
  const query = new URLSearchParams({ start: filters.startDate, end: filters.endDate, min: filters.minMagnitude, depth: filters.maxDepth });
  window.history.replaceState(null, '', `#/map?${query.toString()}`);
}

function depthTone(depthKm: number | null) {
  if (depthKm === null || depthKm <= 70) return 'shallow';
  if (depthKm <= 300) return 'intermediate';
  return 'deep';
}

function clampMapPan(pan: { x: number; y: number }, zoom: number) {
  const xLimit = Math.round((zoom - 1) * 420);
  const yLimit = Math.round((zoom - 1) * 260);
  return {
    x: Math.max(-xLimit, Math.min(xLimit, pan.x)),
    y: Math.max(-yLimit, Math.min(yLimit, pan.y)),
  };
}

function labelsForVisibleMapArea({ zoom, pan, viewport }: { zoom: number; pan: { x: number; y: number }; viewport: { width: number; height: number } }) {
  const mapHeight = Math.max(1, viewport.height - 92);
  const toScreen = (label: { x: number; y: number }) => ({
    x: ((label.x / 960) * viewport.width - viewport.width / 2) * zoom + viewport.width / 2 + pan.x,
    y: (12 + (label.y / 500) * mapHeight - viewport.height / 2) * zoom + viewport.height / 2 + pan.y,
  });
  const isVisible = (point: { x: number; y: number }) => point.x > 24 && point.x < viewport.width - 24 && point.y > 30 && point.y < viewport.height - 96;
  const countryLimit = zoom < 1.3 ? 9 : zoom < 2 ? 15 : zoom < 3.5 ? 24 : 32;
  const minimumArea = zoom < 1.3 ? .018 : zoom < 2 ? .0015 : 0;
  const candidates = [
    ...worldCountryLabels.filter((label) => label.area >= minimumArea),
    ...(zoom >= 1.3 ? mapOceanLabels : []),
  ]
    .map((label) => ({ ...label, screen: toScreen(label) }))
    .filter((label) => isVisible(label.screen))
    .sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === 'country' ? -1 : 1;
      return right.area - left.area;
    });
  const accepted: typeof candidates = [];
  for (const candidate of candidates) {
    const labelLimit = candidate.kind === 'country' ? countryLimit : Math.max(2, Math.floor(countryLimit / 4));
    if (accepted.filter((label) => label.kind === candidate.kind).length >= labelLimit) continue;
    if (accepted.some((label) => Math.hypot(label.screen.x - candidate.screen.x, label.screen.y - candidate.screen.y) < 48)) continue;
    accepted.push(candidate);
  }
  return accepted;
}

function MapScreen({ targetDate, initialQuery }: { targetDate: string; initialQuery: string }) {
  const initialFilters = mapFiltersFromQuery(targetDate, initialQuery);
  const [draft, setDraft] = useState<MapFilters>(initialFilters);
  const [applied, setApplied] = useState<MapFilters>(initialFilters);
  const [events, setEvents] = useState<EarthPulseIndexEvent[]>([]);
  const [mapState, setMapState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [visibleListCount, setVisibleListCount] = useState(100);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [isMapDragging, setIsMapDragging] = useState(false);
  const [mapViewport, setMapViewport] = useState({ width: 960, height: 570 });
  const mapFrameRef = useRef<HTMLDivElement>(null);
  const mapDragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const [mapSort, setMapSort] = useState<'latest' | 'largest' | 'shallow' | 'deep'>('latest');
  const displayEvents = events.slice(0, 750);
  const orderedEvents = [...events].sort((a, b) => {
    if (mapSort === 'largest') return b.magnitude - a.magnitude || b.timeUtc.localeCompare(a.timeUtc);
    if (mapSort === 'shallow') return (a.depthKm ?? Number.POSITIVE_INFINITY) - (b.depthKm ?? Number.POSITIVE_INFINITY) || b.timeUtc.localeCompare(a.timeUtc);
    if (mapSort === 'deep') return (b.depthKm ?? -1) - (a.depthKm ?? -1) || b.timeUtc.localeCompare(a.timeUtc);
    return b.timeUtc.localeCompare(a.timeUtc) || a.id.localeCompare(b.id);
  });
  const visibleListEvents = orderedEvents.slice(0, visibleListCount);
  const selected = events.find((event) => event.id === selectedId) ?? displayEvents[0] ?? null;
  const visibleMapLabels = labelsForVisibleMapArea({ zoom: mapZoom, pan: mapPan, viewport: mapViewport });

  useEffect(() => {
    const frame = mapFrameRef.current;
    if (!frame) return;
    const updateViewport = () => setMapViewport({ width: frame.clientWidth, height: frame.clientHeight });
    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    loadEarthquakeIndex(applied.startDate, applied.endDate)
      .then((items) => {
        if (!active) return;
        const minMagnitude = Number.parseFloat(applied.minMagnitude) || 0;
        const maxDepth = Number.parseFloat(applied.maxDepth);
        setEvents(items.filter((event) => event.magnitude >= minMagnitude && (Number.isNaN(maxDepth) || event.depthKm === null || event.depthKm <= maxDepth)));
        setMapState('ready');
      })
      .catch(() => { if (active) setMapState('error'); });
    return () => { active = false; };
  }, [applied]);

  const applyFilters = (nextFilters: MapFilters) => {
    const normalized = nextFilters.startDate > nextFilters.endDate ? { ...nextFilters, startDate: nextFilters.endDate, endDate: nextFilters.startDate } : nextFilters;
    setDraft(normalized);
    setApplied(normalized);
    setMapState('loading');
    setSelectedId(null);
    setVisibleListCount(100);
    setMapZoom(1);
    setMapPan({ x: 0, y: 0 });
    syncMapUrl(normalized);
  };

  const changeMapZoom = (amount: number) => {
    const nextZoom = Math.max(1, Math.min(6, Number((mapZoom + amount).toFixed(2))));
    setMapZoom(nextZoom);
    setMapPan((pan) => clampMapPan(pan, nextZoom));
  };
  const resetMapView = () => {
    setMapZoom(1);
    setMapPan({ x: 0, y: 0 });
  };
  const startMapDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    mapDragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsMapDragging(true);
  };
  const moveMapDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = mapDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const xDifference = event.clientX - drag.x;
    const yDifference = event.clientY - drag.y;
    mapDragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    setMapPan((pan) => clampMapPan({ x: pan.x + xDifference, y: pan.y + yDifference }, mapZoom));
  };
  const endMapDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (mapDragRef.current?.pointerId !== event.pointerId) return;
    mapDragRef.current = null;
    setIsMapDragging(false);
  };

  const markerPositions = displayEvents.flatMap((event) => {
    const projected = mapProjection([event.longitude, event.latitude]);
    if (!projected) return [];
    const magnitude = event.magnitude;
    const size = Math.min(36, 8 + (magnitude - 4) * 7);
    const tone = depthTone(event.depthKm);
    const positions = [{ x: projected[0], duplicate: false }];
    if (projected[0] > 960 - size) positions.push({ x: projected[0] - 960, duplicate: true });
    if (projected[0] < size) positions.push({ x: projected[0] + 960, duplicate: true });
    return positions.map((position) => ({ ...position, y: projected[1], size, tone, event }));
  });
  const hoveredMarker = markerPositions.find(({ duplicate, event }) => !duplicate && event.id === hoveredId);
  const hoveredDepth = hoveredMarker?.event.depthKm ?? null;
  const hoveredDepthLabel = hoveredDepth === null ? '깊이 자료 없음' : hoveredDepth <= 70 ? '얕은 지진' : hoveredDepth <= 300 ? '중간 깊이' : '깊은 지진';
  const maximumMagnitude = events.length ? Math.max(...events.map((event) => event.magnitude)).toFixed(1) : '—';

  return (
    <ScreenFrame active="map">
      <main className="shell page-shell screen-page map-page">
        <section className="page-heading map-heading">
          <div>
            <div className="eyebrow-row"><span className="eyebrow">GLOBAL OBSERVATION</span><span className="sample-label">{applied.startDate === applied.endDate ? formatKoreanDate(applied.startDate) : `${formatKoreanDate(applied.startDate)} – ${formatKoreanDate(applied.endDate)}`} · KST</span></div>
            <h1>지진 관측 지도</h1>
            <p>선택한 한국시간 기간과 조건에 맞는 전 세계 지진 위치를 보여 줍니다.</p>
          </div>
          <div className="map-summary" aria-label="지도 결과 요약">
            <span><small>검색 결과</small><strong>{mapState === 'ready' ? `${events.length}건` : '…'}</strong></span>
            <i />
            <span><small>최대 규모</small><strong>{maximumMagnitude}</strong></span>
            <i />
            <span><small>지도 표시</small><strong>{events.length > 750 ? '최대 750건' : '전체'}</strong></span>
          </div>
        </section>

        <form className="map-filterbar" aria-label="지도 필터" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          applyFilters({ startDate: formText(form.get('startDate'), draft.startDate), endDate: formText(form.get('endDate'), draft.endDate), minMagnitude: formText(form.get('minMagnitude'), draft.minMagnitude), maxDepth: formText(form.get('maxDepth'), draft.maxDepth) });
        }}>
          <div className="map-periods"><button className={draft.startDate === targetDate && draft.endDate === targetDate ? 'is-selected' : ''} onClick={() => applyFilters({ ...draft, startDate: targetDate, endDate: targetDate })} type="button">오늘</button><button className={draft.startDate === addDays(targetDate, -6) && draft.endDate === targetDate ? 'is-selected' : ''} onClick={() => applyFilters({ ...draft, startDate: addDays(targetDate, -6), endDate: targetDate })} type="button">최근 7일</button><button className={draft.startDate === addDays(targetDate, -29) && draft.endDate === targetDate ? 'is-selected' : ''} onClick={() => applyFilters({ ...draft, startDate: addDays(targetDate, -29), endDate: targetDate })} type="button">최근 30일</button></div>
          <div className="map-filter-fields">
            <label htmlFor="map-start-date"><span>시작일</span><Input id="map-start-date" name="startDate" onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} type="date" value={draft.startDate} /></label>
            <label htmlFor="map-end-date"><span>종료일</span><Input id="map-end-date" name="endDate" onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} type="date" value={draft.endDate} /></label>
            <label htmlFor="map-min-magnitude"><span>최소 규모</span><Input id="map-min-magnitude" min="0" name="minMagnitude" onChange={(event) => setDraft({ ...draft, minMagnitude: event.target.value })} step="0.1" type="number" value={draft.minMagnitude} /></label>
            <label htmlFor="map-max-depth"><span>최대 깊이</span><Input id="map-max-depth" min="0" name="maxDepth" onChange={(event) => setDraft({ ...draft, maxDepth: event.target.value })} type="number" value={draft.maxDepth} /></label>
          </div>
          <div className="map-filter-status"><Filter /><span>규모 {applied.minMagnitude}+ · 깊이 {applied.maxDepth}km 이하</span></div>
          <Button className="map-filter-button" type="submit" variant="outline"><SlidersHorizontal /> 적용</Button>
        </form>

        <section className="map-workspace">
          <div className="map-observation-panel">
            <div className="map-panel-heading">
              <div><span className="section-kicker">EARTHQUAKE POSITION</span><strong>전 세계 관측 위치</strong></div>
              <div className="map-tools" aria-label="지도 도구"><span aria-live="polite" className="map-zoom-level">확대 {Math.round(mapZoom * 100)}%</span><button aria-label="25% 확대" disabled={mapZoom >= 6} onClick={() => changeMapZoom(.25)} type="button"><ZoomIn /></button><button aria-label="25% 축소" disabled={mapZoom <= 1} onClick={() => changeMapZoom(-.25)} type="button"><ZoomOut /></button><button aria-label="전체 보기" disabled={mapZoom === 1 && mapPan.x === 0 && mapPan.y === 0} onClick={resetMapView} type="button"><LocateFixed /></button></div>
            </div>

            <div className="world-map-frame" ref={mapFrameRef}>
              <div className={`map-zoom-layer map-draggable ${isMapDragging ? 'is-dragging' : ''}`} onPointerCancel={endMapDrag} onPointerDown={startMapDrag} onPointerMove={moveMapDrag} onPointerUp={endMapDrag} style={{ transform: `translate(${mapPan.x}px, ${mapPan.y}px) scale(${mapZoom})` }}>
                <svg aria-label="전 세계 지진 위치 지도. 확대 뒤 드래그하여 이동할 수 있습니다." className="world-map-svg" preserveAspectRatio="none" viewBox="0 0 960 500">
                  <path className="map-sphere" d={spherePath} />
                  <path className="map-graticule" d={graticulePath} />
                  <path className="map-land" d={worldPath} />
                </svg>
                <div className="map-country-labels" aria-hidden="true">
                  {visibleMapLabels.map((label) => (
                    <span
                      className={`map-country-label ${label.kind}`}
                      key={`${label.kind}-${label.name}`}
                      style={{ left: `${(label.x / 960) * 100}%`, top: `${(label.y / 500) * 100}%` }}
                    >
                      {label.name}
                    </span>
                  ))}
                </div>
                <div className="map-markers">
                {markerPositions.map(({ event, x, y, size, tone, duplicate }) => (
                  <button
                    aria-describedby={!duplicate && hoveredId === event.id ? 'map-marker-tooltip' : undefined}
                    aria-hidden={duplicate || undefined}
                    aria-label={duplicate ? undefined : `${event.place}, 규모 ${event.magnitude.toFixed(1)}, 깊이 ${event.depthKm ?? '자료 없음'} km`}
                    className={`quake-marker ${tone} ${selectedId === event.id ? 'is-selected' : ''} ${duplicate ? 'is-duplicate' : ''}`}
                    key={`${event.id}-${duplicate ? x : 'main'}`}
                    onBlur={() => setHoveredId(null)}
                    onClick={() => { setSelectedId(event.id); setHoveredId(event.id); }}
                    onFocus={() => { if (!duplicate) setHoveredId(event.id); }}
                    onMouseEnter={() => { if (!duplicate) setHoveredId(event.id); }}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{ left: `${(x / 960) * 100}%`, top: `${(y / 500) * 100}%`, width: size, height: size }}
                    tabIndex={duplicate ? -1 : 0}
                    type="button"
                  >
                    <span>{event.magnitude >= 5.5 ? event.magnitude.toFixed(1) : ''}</span>
                  </button>
                ))}
                {hoveredMarker && (
                  <div
                    className={`map-marker-tooltip ${hoveredMarker.tone} ${hoveredMarker.x > 720 ? 'align-left' : hoveredMarker.x < 240 ? 'align-right' : ''} ${hoveredMarker.y < 125 ? 'is-below' : ''}`}
                    id="map-marker-tooltip"
                    role="tooltip"
                    style={{ left: `${(hoveredMarker.x / 960) * 100}%`, top: `${(hoveredMarker.y / 500) * 100}%` }}
                  >
                    <div className="tooltip-observation-line"><span>발생 시각</span><strong>{formatKstTime(hoveredMarker.event.timeUtc)} KST</strong></div>
                    <div className="tooltip-event-main">
                      <span className="tooltip-magnitude"><small>규모</small><strong>{hoveredMarker.event.magnitude.toFixed(1)}</strong><em>{hoveredMarker.event.magnitudeType ?? 'M'}</em></span>
                      <span className="tooltip-place"><strong>{hoveredMarker.event.place}</strong><small><i />{hoveredDepthLabel}</small></span>
                    </div>
                    <div className="tooltip-facts">
                      <span><small>진원 깊이</small><strong>{hoveredDepth === null ? '자료 없음' : `${hoveredDepth.toFixed(1)} km`}</strong></span>
                      <span><small>좌표</small><strong>{hoveredMarker.event.latitude.toFixed(2)}°, {hoveredMarker.event.longitude.toFixed(2)}°</strong></span>
                    </div>
                    <div className="tooltip-hint">선택하면 오른쪽 기록에서 자세히 볼 수 있습니다.</div>
                  </div>
                )}
                </div>
              </div>

              <div className="map-legend" aria-label="지도 표시 기준">
                <div className="legend-title"><strong>지도 읽는 법</strong><span>크기 = 규모 · 색상 = 깊이</span></div>
                <div className="magnitude-legend"><span><i className="mag-dot mag-4" />M4</span><span><i className="mag-dot mag-5" />M5</span><span><i className="mag-dot mag-6" />M6+</span></div>
                <div className="depth-legend"><span><i className="depth-dot shallow" />0–70km</span><span><i className="depth-dot intermediate" />70–300km</span><span><i className="depth-dot deep" />300km+</span></div>
              </div>
              <span className="map-coordinate">Equal Earth · 경도 180° 연속 표시</span>
            </div>
          </div>

          <aside className={`map-event-panel ${selected ? '' : 'is-empty'}`} aria-label="지도 지진 정보">
            {selected && <div className="selected-event-card">
              <div className={`selected-magnitude ${depthTone(selected.depthKm)}`}><small>규모</small><strong>{selected.magnitude.toFixed(1)}</strong><span>{selected.magnitudeType ?? 'M'}</span></div>
              <div className="selected-event-copy"><span className="section-kicker">SELECTED EVENT</span><h2>{selected.place}</h2><p>{formatKstTime(selected.timeUtc)} KST · 깊이 {selected.depthKm === null ? '자료 없음' : `${selected.depthKm.toFixed(1)} km`}</p><small>{selected.latitude.toFixed(2)}°, {selected.longitude.toFixed(2)}°</small></div>
              <Button className="selected-detail-button" onClick={() => { window.location.assign(`${window.location.pathname}${window.location.search}#/event/${selected.id}?from=map&month=${selected.dateKst.slice(0, 7)}`); }}>상세 정보 <ChevronRight /></Button>
            </div>}

            <div className="viewport-events-head"><span><strong>검색 결과 목록</strong><small>{mapSort === 'latest' ? '발생 시각 최신순' : mapSort === 'largest' ? '규모 큰 순' : mapSort === 'shallow' ? '얕은 순' : '깊은 순'}</small><small>지도는 최대 750개까지 표시</small></span><label className="map-sort"><span>정렬</span><select onChange={(event) => setMapSort(event.target.value as typeof mapSort)} value={mapSort}><option value="latest">최신순</option><option value="largest">규모 큰 순</option><option value="shallow">얕은 순</option><option value="deep">깊은 순</option></select></label><Badge variant="outline">{visibleListEvents.length}/{events.length}건</Badge></div>
            <div className="map-event-list">
              {events.length === 0 && <div className="map-empty-list">{mapState === 'loading' ? '조건에 맞는 지진을 불러오는 중입니다.' : mapState === 'error' ? '기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' : '선택한 조건에 맞는 지진이 없습니다.'}</div>}
              {visibleListEvents.map((event) => (
                <button className={selectedId === event.id ? 'is-selected' : ''} key={event.id} onClick={() => setSelectedId(event.id)} type="button">
                  <span className={`map-list-magnitude ${depthTone(event.depthKm)}`}>{event.magnitude.toFixed(1)}</span>
                  <span><strong>{event.place}</strong><small>{formatKstTime(event.timeUtc)} KST · {event.depthKm === null ? '깊이 자료 없음' : `${event.depthKm.toFixed(1)} km`}</small></span>
                  <ChevronRight />
                </button>
              ))}
              {visibleListEvents.length < events.length && <button className="map-list-more" onClick={() => setVisibleListCount((count) => Math.min(events.length, count + 100))} type="button">100건 더 보기 <ChevronDown /></button>}
            </div>
          </aside>
        </section>
      </main>
    </ScreenFrame>
  );
}

function EventLocationMap({ event }: { event: EarthPulseIndexEvent }) {
  const { latitude, longitude, place } = event;
  const projection = geoEqualEarth().rotate([-longitude, -latitude]).scale(760).translate([420, 210]);
  const path = geoPath(projection);
  const point = projection([longitude, latitude]) ?? [420, 210];
  const nearbyCountryLabels = worldGeo.features
    .flatMap((country) => {
      const rawName = typeof country.properties?.name === 'string' ? country.properties.name : null;
      const center = projection(geoCentroid(country));
      if (!rawName || !center || center[0] < 34 || center[0] > 806 || center[1] < 30 || center[1] > 390) return [];
      const name = koreanCountryNames[rawName];
      return name ? [{ name, x: center[0], y: center[1], distance: Math.hypot(center[0] - 420, center[1] - 210) }] : [];
    })
    .sort((left, right) => left.distance - right.distance)
    .slice(0, 4);
  return (
    <Card className="event-location-card">
      <CardHeader><div><span className="section-kicker">LOCAL CONTEXT</span><CardTitle className="mt-1">발생 지점 주변 지도</CardTitle><CardDescription>지진 위치를 중심으로 확대한 지역 맥락입니다.</CardDescription></div><CardAction><Badge variant="outline">{latitude.toFixed(2)}°, {longitude.toFixed(2)}°</Badge></CardAction></CardHeader>
      <CardContent>
        <div className="event-location-map" aria-label={`${place} 주변 지도`}>
          <svg preserveAspectRatio="xMidYMid slice" viewBox="0 0 840 420">
            <path className="event-map-sphere" d={path({ type: 'Sphere' }) ?? ''} />
            <path className="event-map-graticule" d={path(geoGraticule10()) ?? ''} />
            <path className="event-map-land" d={path(worldGeo) ?? ''} />
            <circle className="event-map-halo" cx={point[0]} cy={point[1]} r="22" />
            <circle className="event-map-point" cx={point[0]} cy={point[1]} r="7" />
          </svg>
          <div className="event-map-country-labels" aria-hidden="true">
            {nearbyCountryLabels.map((country) => <span key={country.name} style={{ left: `${(country.x / 840) * 100}%`, top: `${(country.y / 420) * 100}%` }}>{country.name}</span>)}
          </div>
          <div className="event-map-caption"><span>EP</span><strong>{place}</strong><small>발생 지점 · 중심 표시</small></div>
        </div>
      </CardContent>
    </Card>
  );
}

interface SearchFilters {
  startDate: string;
  endDate: string;
  minMagnitude: string;
  maxDepth: string;
  reviewedOnly: boolean;
  tsunamiOnly: boolean;
  shallowOnly: boolean;
}

function searchDefaults(targetDate: string): SearchFilters {
  return {
    startDate: addDays(targetDate, -29),
    endDate: targetDate,
    minMagnitude: '4.0',
    maxDepth: '700',
    reviewedOnly: false,
    tsunamiOnly: false,
    shallowOnly: false,
  };
}

function medianValue(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function dateAxisLabel(dateString: string) {
  const [year, month, day] = dateString.split('-').map(Number);
  return `${year}. ${month}. ${day}.`;
}

type TrendGranularity = 'day' | 'week' | 'month';

function trendBucketStart(dateString: string, granularity: TrendGranularity) {
  if (granularity === 'day') return dateString;
  if (granularity === 'month') return `${dateString.slice(0, 7)}-01`;
  const date = new Date(`${dateString}T00:00:00Z`);
  const daysFromMonday = (date.getUTCDay() + 6) % 7;
  return addDays(dateString, -daysFromMonday);
}

function nextTrendBucket(dateString: string, granularity: TrendGranularity) {
  if (granularity === 'day') return addDays(dateString, 1);
  if (granularity === 'week') return addDays(dateString, 7);
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

function trendBucketEnd(dateString: string, endDate: string, granularity: TrendGranularity) {
  const end = addDays(nextTrendBucket(dateString, granularity), -1);
  return end > endDate ? endDate : end;
}

function filtersFromQuery(targetDate: string, query: string) {
  const defaults = searchDefaults(targetDate);
  const values = new URLSearchParams(query);
  const startDate = values.get('start') ?? defaults.startDate;
  const endDate = values.get('end') ?? defaults.endDate;
  return {
    ...defaults,
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : defaults.startDate,
    endDate: /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? endDate : defaults.endDate,
    minMagnitude: values.get('min') ?? defaults.minMagnitude,
    maxDepth: values.get('depth') ?? defaults.maxDepth,
    reviewedOnly: values.get('reviewed') === '1',
    tsunamiOnly: values.get('tsunami') === '1',
    shallowOnly: values.get('shallow') === '1',
  };
}

function syncExploreUrl(filters: SearchFilters) {
  const query = new URLSearchParams({
    start: filters.startDate,
    end: filters.endDate,
    min: filters.minMagnitude,
    depth: filters.maxDepth,
  });
  if (filters.reviewedOnly) query.set('reviewed', '1');
  if (filters.tsunamiOnly) query.set('tsunami', '1');
  if (filters.shallowOnly) query.set('shallow', '1');
  window.history.replaceState(null, '', `#/explore?${query.toString()}`);
}

function ExploreScreen({ targetDate, initialQuery }: { targetDate: string; initialQuery: string }) {
  const initialFilters = filtersFromQuery(targetDate, initialQuery);
  const [draft, setDraft] = useState<SearchFilters>(initialFilters);
  const [applied, setApplied] = useState<SearchFilters>(initialFilters);
  const [events, setEvents] = useState<EarthPulseIndexEvent[]>([]);
  const [searchState, setSearchState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hoveredBucket, setHoveredBucket] = useState<number | null>(null);
  const [trendGranularity, setTrendGranularity] = useState<TrendGranularity>('day');
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [validationNotice, setValidationNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!initialQuery) syncExploreUrl(searchDefaults(targetDate));
  }, [initialQuery, targetDate]);

  useEffect(() => {
    let active = true;
    loadEarthquakeIndex(applied.startDate, applied.endDate)
      .then((indexed) => {
        if (!active) return;
        const minimum = Number(applied.minMagnitude) || 4;
        const maximumDepth = Number(applied.maxDepth) || 700;
        const filtered = indexed
          .filter((event) => event.magnitude >= minimum)
          .filter((event) => {
            if (event.depthKm === null) return !applied.shallowOnly;
            return event.depthKm <= maximumDepth;
          })
          .filter((event) => !applied.reviewedOnly || event.status === 'reviewed')
          .filter((event) => !applied.tsunamiOnly || event.tsunami)
          .sort((a, b) => b.timeUtc.localeCompare(a.timeUtc) || a.id.localeCompare(b.id));
        setEvents(filtered);
        setSearchState('ready');
      })
      .catch(() => {
        if (!active) return;
        setEvents([]);
        setSearchState('error');
        setSearchError('검색 색인을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
      });
    return () => { active = false; };
  }, [applied]);

  const runSearch = (next: SearchFilters) => {
    const minimumMagnitude = Number(next.minMagnitude);
    const maximumDepth = Number(next.maxDepth);
    if (!next.startDate || !next.endDate) {
      setEvents([]);
      setSearchState('error');
      setSearchError('시작일과 종료일을 모두 입력해 주세요.');
      setValidationNotice('시작일과 종료일을 모두 입력해 주세요.');
      return;
    }
    if (next.startDate > next.endDate) {
      setEvents([]);
      setSearchState('error');
      setSearchError('시작일은 종료일보다 늦을 수 없습니다.');
      setValidationNotice('시작일은 종료일보다 늦을 수 없습니다.');
      return;
    }
    if (next.startDate > targetDate || next.endDate > targetDate) {
      setEvents([]);
      setSearchState('error');
      setSearchError(`미래 날짜는 검색할 수 없습니다. 종료일을 ${formatKoreanDate(targetDate)} 이전으로 입력해 주세요.`);
      setValidationNotice(`미래 날짜는 검색할 수 없습니다. ${formatKoreanDate(targetDate)} 이전 날짜를 입력해 주세요.`);
      return;
    }
    if (!Number.isFinite(minimumMagnitude) || minimumMagnitude < 4) {
      setEvents([]);
      setSearchState('error');
      setSearchError('최소 규모는 4.0 이상의 숫자로 입력해 주세요.');
      setValidationNotice('최소 규모는 4.0 이상의 숫자로 입력해 주세요.');
      return;
    }
    if (!Number.isFinite(maximumDepth) || maximumDepth < 0) {
      setEvents([]);
      setSearchState('error');
      setSearchError('최대 깊이는 0 이상의 숫자로 입력해 주세요.');
      setValidationNotice('최대 깊이는 0 이상의 숫자로 입력해 주세요.');
      return;
    }
    setPage(0);
    setSearchState('loading');
    setSearchError(null);
    setValidationNotice(null);
    syncExploreUrl(next);
    setApplied(next);
  };
  const applyQuick = (next: SearchFilters) => {
    setDraft(next);
    runSearch(next);
  };

  const magnitudes = events.map((event) => event.magnitude);
  const depths = events.flatMap((event) => event.depthKm === null ? [] : [event.depthKm]);
  const maximumEvent = events.reduce<EarthPulseIndexEvent | null>((current, event) => !current || event.magnitude > current.magnitude ? event : current, null);
  const medianMagnitude = medianValue(magnitudes);
  const averageMagnitude = magnitudes.length ? magnitudes.reduce((sum, value) => sum + value, 0) / magnitudes.length : null;
  const medianDepth = medianValue(depths);
  const maximumDepth = depths.length ? Math.max(...depths) : null;
  const missingDepthCount = events.length - depths.length;
  const magnitudeGroups = [
    { label: '4.0–4.9', count: events.filter((event) => event.magnitude >= 4 && event.magnitude < 5).length },
    { label: '5.0–5.9', count: events.filter((event) => event.magnitude >= 5 && event.magnitude < 6).length },
    { label: '6.0–6.9', count: events.filter((event) => event.magnitude >= 6 && event.magnitude < 7).length },
    { label: '7.0+', count: events.filter((event) => event.magnitude >= 7).length },
  ];
  const largestGroup = Math.max(...magnitudeGroups.map((group) => group.count), 1);

  const startTime = new Date(`${applied.startDate}T00:00:00Z`).getTime();
  const endTime = new Date(`${applied.endDate}T00:00:00Z`).getTime();
  const bucketStartDate = trendBucketStart(applied.startDate, trendGranularity);
  const trendBuckets: { start: string; end: string; count: number }[] = [];
  for (let cursor = bucketStartDate; cursor <= applied.endDate; cursor = nextTrendBucket(cursor, trendGranularity)) {
    trendBuckets.push({ start: cursor, end: trendBucketEnd(cursor, applied.endDate, trendGranularity), count: 0 });
  }
  const bucketByStart = new Map(trendBuckets.map((bucket, index) => [bucket.start, index]));
  for (const event of events) {
    const bucket = bucketByStart.get(trendBucketStart(event.dateKst, trendGranularity));
    if (bucket !== undefined) trendBuckets[bucket].count += 1;
  }
  const bucketCounts = trendBuckets.map((bucket) => bucket.count);
  const bucketMaximum = Math.max(...bucketCounts, 1);
  const trendPoints = bucketCounts.map((count, index) => {
    const x = bucketCounts.length === 1 ? 340 : (index / (bucketCounts.length - 1)) * 680;
    const y = 205 - (count / bucketMaximum) * 175;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const trendLine = trendPoints.length ? `M${trendPoints.join(' L')}` : '';
  const trendArea = trendPoints.length ? `${trendLine} L680 220 L0 220 Z` : '';
  const middleDate = new Date(startTime + Math.floor((endTime - startTime) / 2)).toISOString().slice(0, 10);
  const hoveredBucketCount = hoveredBucket === null ? null : bucketCounts[hoveredBucket];
  const hoveredBucketStart = hoveredBucket === null ? null : trendBuckets[hoveredBucket]?.start ?? null;
  const hoveredBucketEnd = hoveredBucket === null ? null : trendBuckets[hoveredBucket]?.end ?? null;

  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(events.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visibleEvents = events.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const resultStart = events.length ? safePage * pageSize + 1 : 0;
  const resultEnd = Math.min(events.length, (safePage + 1) * pageSize);

  return (
    <ScreenFrame active="explore">
      <main className="shell page-shell screen-page">
        <section className="page-heading compact-heading">
          <div>
            <div className="eyebrow-row"><span className="eyebrow">EARTHQUAKE ARCHIVE</span><span className="sample-label">1900–현재 · M4.0+ · KST</span></div>
            <h1>기록 탐색</h1>
            <p>날짜와 규모, 깊이, 검토 상태를 조합해 USGS 실제 기록을 탐색합니다.</p>
          </div>
          <Button className="export-button" onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); setCopyNotice('화면 주소를 복사했어요.'); } catch { setCopyNotice('주소 복사에 실패했습니다.'); } window.setTimeout(() => setCopyNotice(null), 2400); }} variant="outline"><ArrowUpRight /> 화면 주소 복사</Button>
        </section>
        {copyNotice && <div className="copy-toast" role="status">{copyNotice}</div>}
        {validationNotice && <div className="copy-toast search-validation-toast is-error" role="alert">{validationNotice}</div>}

        <Card className="filter-panel">
          <form onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const next = {
              ...draft,
              startDate: formText(form.get('startDate'), draft.startDate),
              endDate: formText(form.get('endDate'), draft.endDate),
              minMagnitude: formText(form.get('minMagnitude'), draft.minMagnitude),
              maxDepth: formText(form.get('maxDepth'), draft.maxDepth),
            };
            setDraft(next);
            runSearch(next);
          }}>
            <CardContent className="filter-content">
              <div className="filter-title"><SlidersHorizontal /><span><strong>검색 조건</strong><small>모든 시각은 KST 기준</small></span></div>
              <label className="filter-field" htmlFor="filter-start"><span>시작일</span><Input max={targetDate} min="1900-01-01" name="startDate" onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} value={draft.startDate} id="filter-start" type="date" /></label>
              <label className="filter-field" htmlFor="filter-end"><span>종료일</span><Input max={targetDate} min="1900-01-01" name="endDate" onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} value={draft.endDate} id="filter-end" type="date" /></label>
              <label className="filter-field" htmlFor="filter-min-magnitude"><span>최소 규모</span><Input min="4" name="minMagnitude" onChange={(event) => setDraft({ ...draft, minMagnitude: event.target.value })} step="0.1" value={draft.minMagnitude} id="filter-min-magnitude" inputMode="decimal" type="number" /></label>
              <label className="filter-field" htmlFor="filter-max-depth"><span>최대 깊이</span><Input min="0" name="maxDepth" onChange={(event) => setDraft({ ...draft, maxDepth: event.target.value, shallowOnly: false })} value={draft.maxDepth} id="filter-max-depth" inputMode="numeric" type="number" /></label>
              <Button className="filter-apply" disabled={searchState === 'loading'} type="submit"><Filter /> {searchState === 'loading' ? '검색 중' : '적용'}</Button>
            </CardContent>
          </form>
          <div className="quick-filters">
            <button className={draft.startDate === addDays(targetDate, -29) && draft.endDate === targetDate ? 'is-selected' : ''} onClick={() => applyQuick(searchDefaults(targetDate))} type="button">최근 30일</button>
            <button className={Number(draft.minMagnitude) >= 5 ? 'is-selected' : ''} onClick={() => applyQuick({ ...draft, minMagnitude: Number(draft.minMagnitude) >= 5 ? '4.0' : '5.0' })} type="button">규모 5.0+</button>
            <button className={draft.shallowOnly ? 'is-selected' : ''} onClick={() => applyQuick({ ...draft, maxDepth: draft.shallowOnly ? '700' : '70', shallowOnly: !draft.shallowOnly })} type="button">얕은 지진</button>
            <button className={draft.reviewedOnly ? 'is-selected' : ''} onClick={() => applyQuick({ ...draft, reviewedOnly: !draft.reviewedOnly })} type="button">검토 완료</button>
            <button className={draft.tsunamiOnly ? 'is-selected' : ''} onClick={() => applyQuick({ ...draft, tsunamiOnly: !draft.tsunamiOnly })} type="button">쓰나미 플래그</button>
          </div>
        </Card>

        {searchState === 'error' && <div className="search-feedback is-error"><CircleAlert /> {searchError}</div>}
        {searchState === 'loading' && <div className="search-feedback"><RefreshCw className="is-spinning" /> {applied.startDate.slice(0, 4)}~{applied.endDate.slice(0, 4)}년 색인을 확인하고 있습니다.</div>}

        <section className="stat-grid" aria-label="검색 결과 통계">
          <div><span>검색 결과</span><strong>{searchState === 'loading' ? '—' : `${events.length.toLocaleString()}건`}</strong><small>규모 {Number(applied.minMagnitude || 4).toFixed(1)} 이상</small></div>
          <div><span>최대 규모</span><strong>{maximumEvent ? maximumEvent.magnitude.toFixed(1) : '—'}</strong><small>{maximumEvent?.place ?? '조건에 맞는 기록 없음'}</small></div>
          <div><span>중앙 규모</span><strong>{medianMagnitude === null ? '—' : medianMagnitude.toFixed(1)}</strong><small>{averageMagnitude === null ? '평균 자료 없음' : `평균 ${averageMagnitude.toFixed(1)}`}</small></div>
          <div><span>중앙 깊이</span><strong>{medianDepth === null ? '—' : `${medianDepth.toFixed(0)} km`}</strong><small>{maximumDepth === null ? '깊이 자료 없음' : `최대 ${maximumDepth.toFixed(0)} km · 미상 ${missingDepthCount}건`}</small></div>
        </section>

        <section className="explore-grid">
          <Card className="trend-card">
            <CardHeader>
              <div><span className="section-kicker ink">OCCURRENCE FLOW</span><CardTitle className="mt-1">기간별 발생 흐름</CardTitle></div>
              <CardAction><div className="trend-granularity" aria-label="그래프 집계 기준"><button className={trendGranularity === 'day' ? 'is-selected' : ''} onClick={() => setTrendGranularity('day')} type="button">일별</button><button className={trendGranularity === 'week' ? 'is-selected' : ''} onClick={() => setTrendGranularity('week')} type="button">주별</button><button className={trendGranularity === 'month' ? 'is-selected' : ''} onClick={() => setTrendGranularity('month')} type="button">월별</button></div></CardAction>
            </CardHeader>
            <CardContent>
              <div className="trend-plot interactive-chart" aria-label={`${trendGranularity === 'day' ? '일별' : trendGranularity === 'week' ? '주별' : '월별'} 지진 발생 건수 선 그래프`}>
                <div className="trend-scale" aria-hidden="true"><span>{bucketMaximum.toLocaleString()}건</span><span>{Math.round(bucketMaximum / 2).toLocaleString()}건</span><span>0건</span></div>
                <svg
                  aria-hidden="true"
                  onMouseLeave={() => setHoveredBucket(null)}
                  onMouseMove={(event) => {
                    const bounds = event.currentTarget.getBoundingClientRect();
                    const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
                    setHoveredBucket(Math.round(ratio * Math.max(0, bucketCounts.length - 1)));
                  }}
                  viewBox="0 0 680 220"
                  preserveAspectRatio="none"
                >
                  <defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#50bfa5" stopOpacity=".28"/><stop offset="1" stopColor="#50bfa5" stopOpacity="0"/></linearGradient></defs>
                  <path d={trendArea} fill="url(#areaFill)" />
                  <path d={trendLine} fill="none" stroke="#2f8b78" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                  {hoveredBucket !== null && <circle cx={bucketCounts.length === 1 ? 340 : (hoveredBucket / (bucketCounts.length - 1)) * 680} cy={205 - ((hoveredBucketCount ?? 0) / bucketMaximum) * 175} fill="#fffdf7" r="5" stroke="#2f8b78" strokeWidth="3" />}
                  <rect fill="transparent" height="220" width="680" x="0" y="0" />
                </svg>
                {hoveredBucketCount !== null && hoveredBucketStart !== null && hoveredBucketEnd !== null && <div className={`chart-tooltip ${hoveredBucket === 0 ? 'tooltip-edge-start' : hoveredBucket === bucketCounts.length - 1 ? 'tooltip-edge-end' : ''}`} style={{ left: `${bucketCounts.length === 1 ? 50 : (hoveredBucket! / (bucketCounts.length - 1)) * 100}%` }}><small>{hoveredBucketStart === hoveredBucketEnd ? formatKoreanDate(hoveredBucketStart) : `${formatKoreanDate(hoveredBucketStart)}–${formatKoreanDate(hoveredBucketEnd)}`}</small><strong>{hoveredBucketCount.toLocaleString()}건</strong></div>}
              </div>
              <div className="trend-axis"><span>{dateAxisLabel(applied.startDate)}</span><span>{dateAxisLabel(middleDate)}</span><span>{dateAxisLabel(applied.endDate)}</span></div>
            </CardContent>
          </Card>

          <Card className="distribution-card">
            <CardHeader><div><span className="section-kicker ink">MAGNITUDE</span><CardTitle className="mt-1">규모 분포</CardTitle></div></CardHeader>
            <CardContent className="distribution-list">
              {magnitudeGroups.map((group) => (
                <div key={group.label}><span>{group.label}</span><i><b style={{ width: `${(group.count / largestGroup) * 100}%` }} /></i><strong>{group.count.toLocaleString()}</strong></div>
              ))}
            </CardContent>
          </Card>
        </section>

        <Card className="results-card">
          <CardHeader>
            <div><CardTitle>지진 목록</CardTitle><CardDescription>발생 시각이 최근인 순서입니다.</CardDescription></div>
            <CardAction><Badge variant="outline"><Layers3 /> 최신순</Badge></CardAction>
          </CardHeader>
          <CardContent className="event-list search-results">
            {searchState === 'ready' && visibleEvents.map((event) => <SearchEventResultRow event={event} key={event.id} />)}
            {searchState === 'ready' && events.length === 0 && <div className="empty-search-result"><Search /><strong>조건에 맞는 지진이 없습니다.</strong><span>날짜 범위나 규모·깊이 조건을 넓혀 보세요.</span></div>}
          </CardContent>
          <div className="results-footer"><span>{events.length.toLocaleString()}건 중 {resultStart.toLocaleString()}–{resultEnd.toLocaleString()}</span><div><Button disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} size="sm" variant="outline">이전</Button><Button disabled={safePage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} size="sm" variant="outline">다음</Button></div></div>
        </Card>
      </main>
    </ScreenFrame>
  );
}

function DayScreen() {
  return (
    <ScreenFrame active="explore">
      <main className="shell page-shell screen-page">
        <a className="back-link" href="#/today"><ArrowLeft /> 오늘 화면으로</a>
        <section className="detail-hero day-detail-hero">
          <div>
            <span className="section-kicker">DAILY RECORD / FINAL</span>
            <h1>2026년 8월 31일</h1>
            <p>Asia/Seoul 기준으로 확정된 일별 기록입니다.</p>
          </div>
          <div className="detail-hero-metric"><span>규모 4.0 이상</span><strong>19<small>건</small></strong><em><ArrowUpRight /> 전날 대비 +3건</em></div>
        </section>

        <section className="stat-grid detail-stats">
          <div><span>최대 규모</span><strong>6.8</strong><small>Mww · 검토 완료</small></div>
          <div><span>평균 규모</span><strong>4.8</strong><small>중앙값 4.6</small></div>
          <div><span>중앙 깊이</span><strong>41 km</strong><small>가장 깊음 582 km</small></div>
          <div><span>쓰나미 플래그</span><strong>1건</strong><small>발생 확정 의미 아님</small></div>
        </section>

        <section className="day-detail-grid">
          <Card className="magnitude-card">
            <CardHeader><div><span className="section-kicker ink">DISTRIBUTION</span><CardTitle className="mt-1">규모 구간별 분포</CardTitle></div></CardHeader>
            <CardContent className="magnitude-rings">
              <div className="ring-chart"><span><strong>19</strong><small>전체</small></span></div>
              <div className="ring-legend">
                <div><i className="ring-1"/><span>4.0–4.9</span><strong>13건</strong></div>
                <div><i className="ring-2"/><span>5.0–5.9</span><strong>4건</strong></div>
                <div><i className="ring-3"/><span>6.0 이상</span><strong>2건</strong></div>
              </div>
            </CardContent>
          </Card>
          <Card className="evidence-card">
            <CardHeader><div><span className="section-kicker ink">PROVENANCE</span><CardTitle className="mt-1">이 기록의 수집 근거</CardTitle></div></CardHeader>
            <CardContent className="evidence-timeline">
              <div><i/><span><small>원천 응답 생성</small><strong>2026-09-01 09:16:42 KST</strong></span></div>
              <div><i/><span><small>Earth Pulse 수집</small><strong>2026-09-01 09:17:08 KST</strong></span></div>
              <div><i/><span><small>일별 기록 확정</small><strong>2026-09-01 09:17:11 KST</strong></span></div>
            </CardContent>
          </Card>
        </section>

        <Card className="results-card">
          <CardHeader><div><CardTitle>이날의 지진 19건</CardTitle><CardDescription>발생 시각이 최근인 순서입니다.</CardDescription></div><CardAction><Button size="sm" variant="outline"><Filter /> 날짜 안에서 필터</Button></CardAction></CardHeader>
          <CardContent className="event-list search-results">{allEvents.map((event) => <EventResultRow event={event} key={event.id} source="day/2026-08-31" />)}</CardContent>
        </Card>
      </main>
    </ScreenFrame>
  );
}

function EventScreen({ eventId, returnTo, liveEvent, eventMonth, board }: { eventId: string; returnTo: string; liveEvent?: EarthPulseEvent; eventMonth?: string | null; board?: TodayBoardData | null }) {
  const [archiveEvent, setArchiveEvent] = useState<EarthPulseEvent | null>(liveEvent ?? null);
  const [archiveError, setArchiveError] = useState(false);

  useEffect(() => {
    if (!eventMonth) return;
    let active = true;
    loadEvent(eventMonth, eventId)
      .then((event) => {
        if (!active) return;
        setArchiveEvent(event);
        setArchiveError(event === null);
      })
      .catch(() => {
        if (active) setArchiveError(true);
      });
    return () => { active = false; };
  }, [eventId, eventMonth, liveEvent]);

  if (eventMonth && !archiveEvent) {
    return (
      <ScreenFrame active="explore">
        <main className="shell page-shell screen-page">
          <a className="back-link" href="#/explore"><ArrowLeft /> 검색 결과로</a>
          <div className={`search-feedback ${archiveError ? 'is-error' : ''}`}>
            {archiveError ? <CircleAlert /> : <RefreshCw className="is-spinning" />}
            {archiveError ? '선택한 지진 상세 기록을 불러오지 못했습니다.' : '지진 상세 기록을 불러오고 있습니다.'}
          </div>
        </main>
      </ScreenFrame>
    );
  }

  const fallback = allEvents.find((item) => item.id === eventId) ?? allEvents[0];
  const actualEvent = liveEvent ?? archiveEvent;
  const event = actualEvent ? {
    id: actualEvent.id,
    magnitude: actualEvent.magnitude.toFixed(1),
    magnitudeType: actualEvent.magnitudeType ?? '정보 없음',
    place: actualEvent.place,
    time: `${actualEvent.timeKst.slice(0, 5)} KST`,
    dateKst: actualEvent.dateKst,
    timeUtc: actualEvent.timeUtc,
    updatedUtc: actualEvent.updatedUtc,
    depth: actualEvent.depthKm === null ? '자료 없음' : `${actualEvent.depthKm.toFixed(1)} km`,
    tone: eventTone(actualEvent.magnitude),
    latitude: actualEvent.latitude,
    longitude: actualEvent.longitude,
    network: actualEvent.network ?? '정보 없음',
    status: actualEvent.status,
    stationCount: actualEvent.stationCount ?? null,
    azimuthalGap: actualEvent.azimuthalGap ?? null,
    rmsSeconds: actualEvent.rmsSeconds ?? null,
    mmi: actualEvent.mmi,
    cdi: actualEvent.cdi,
    felt: actualEvent.felt,
    alert: actualEvent.alert,
    tsunami: actualEvent.tsunami,
    url: actualEvent.url,
  } : null;
  if (!event) return <ScreenFrame active="explore"><main className="shell page-shell screen-page"><a className="back-link" href="#/explore"><ArrowLeft /> 검색 결과로</a><div className="search-feedback is-error"><CircleAlert /> 선택한 지진의 실제 기록을 찾지 못했습니다.</div></main></ScreenFrame>;
  const returnsToday = returnTo === 'today';
  const returnsMap = returnTo === 'map';
  const returnsDay = returnTo.startsWith('day/');
  const backLabel = returnsToday ? '오늘 화면으로' : returnsMap ? '지진 지도로' : returnsDay ? '날짜 기록으로' : '검색 결과로';
  return (
    <ScreenFrame active={returnsToday ? 'today' : returnsMap ? 'map' : 'explore'}>
      <main className="shell page-shell screen-page event-detail-page">
        <a className="back-link" href={`#/${returnTo}`}><ArrowLeft /> {backLabel}</a>
        <section className="detail-hero event-detail-hero">
          <div className={`event-magnitude-hero ${event.tone}`}><small>규모</small><strong>{event.magnitude}</strong><span>{event.magnitudeType}</span></div>
          <div className="event-hero-copy">
            <div><Badge className="reviewed-badge" variant="outline"><CheckCircle2 /> {event.status === 'reviewed' ? '검토 완료' : event.status === 'preliminary' ? '잠정 검토' : '상태 확인'}</Badge><Badge className="event-id-badge" variant="outline">{event.id}</Badge></div>
            <h1>{event.place}</h1>
            <p>{formatKoreanDate(event.dateKst)} {event.time} · 깊이 {event.depth}</p>
          </div>
          <Button className="source-button" disabled={!event.url} onClick={() => { if (event.url) window.open(event.url, '_blank', 'noopener,noreferrer'); }} variant="outline">USGS 원본 <ExternalLink /></Button>
        </section>

        <section className="event-primary-layout">
          <div className="event-primary-cards">
            <Card className="fact-card">
              <CardHeader><CardTitle>지진 정보</CardTitle></CardHeader>
              <CardContent className="fact-grid">
                <div><span>발생 시각 KST</span><strong>{formatDateTime(event.timeUtc, 'Asia/Seoul')}</strong></div>
                <div><span>발생 시각 UTC</span><strong>{formatDateTime(event.timeUtc, 'UTC')}</strong></div>
                <div><span>위도 · 경도</span><strong>{event.latitude.toFixed(3)} · {event.longitude.toFixed(3)}</strong></div>
                <div><span>진원 깊이</span><strong>{event.depth}</strong></div>
                <div><span>이벤트 ID</span><strong>{event.id}</strong></div>
                <div><span>제공 네트워크</span><strong>{event.network}</strong></div>
              </CardContent>
            </Card>
            <Card className="impact-card">
            <CardHeader><div><CardTitle>영향 정보</CardTitle><CardDescription>제공되지 않는 값은 추정하지 않습니다.</CardDescription></div><CardAction><details className="impact-guide"><summary>용어 안내</summary><dl><div><dt>계산 진도 MMI</dt><dd>관측 자료로 계산한 해당 지역의 흔들림 강도입니다.</dd></div><div><dt>체감 신고 CDI</dt><dd>사람들이 신고한 흔들림 경험을 바탕으로 산정한 값입니다.</dd></div><div><dt>PAGER 경보</dt><dd>지진 영향 규모를 추정하는 USGS 경보 체계입니다.</dd></div><div><dt>쓰나미 플래그</dt><dd>USGS 원천이 쓰나미 관련 여부를 표시한 값입니다.</dd></div></dl></details></CardAction></CardHeader>
              <CardContent className="impact-list">
                <div><Gauge /><span><small>계산 진도 MMI</small><strong>{event.mmi ?? '정보 없음'}</strong></span></div>
                <div><Activity /><span><small>체감 신고 CDI</small><strong>{event.cdi === null ? '정보 없음' : `${event.felt ?? 0}건 · ${event.cdi}`}</strong></span></div>
                <div><CircleAlert /><span><small>PAGER 경보</small><strong>{event.alert ?? '정보 없음'}</strong></span></div>
                <div><Radar /><span><small>쓰나미 플래그</small><strong>{event.tsunami ? '있음' : '없음'}</strong></span></div>
              </CardContent>
            </Card>
          </div>
          <EventLocationMap event={event} />
        </section>

        <section className="event-detail-grid lower-detail-grid">
          <Card className="fact-card">
            <CardHeader><CardTitle>관측 품질</CardTitle></CardHeader>
            <CardContent className="quality-grid">
              <div><strong>{event.stationCount === null ? '—' : event.stationCount}</strong><span>관측소 수</span></div><div><strong>{event.azimuthalGap === null ? '—' : `${event.azimuthalGap.toFixed(0)}°`}</strong><span>방위각 공백</span></div><div><strong>{event.rmsSeconds === null ? '—' : event.rmsSeconds.toFixed(2)}</strong><span>RMS 오차 (초)</span></div><div><strong>{event.status === 'reviewed' ? '검토' : '잠정'}</strong><span>원천 검토 상태</span></div>
            </CardContent>
          </Card>
          <Card className="source-detail-card">
            <CardHeader><CardTitle>데이터 시각</CardTitle></CardHeader>
            <CardContent className="source-detail-list">
              <div><span>USGS 최종 수정</span><strong>{formatDateTime(event.updatedUtc, 'Asia/Seoul')}</strong></div>
              <div><span>Earth Pulse 수집</span><strong>{board?.status.lastSuccessAt ? formatDateTime(board.status.lastSuccessAt, 'Asia/Seoul') : '정보 없음'}</strong></div>
              <div><span>현재 표시 상태</span><strong className="fresh-text"><CheckCircle2 /> {board?.status.state === 'fresh' ? '최신' : board?.status.state === 'delayed' ? '업데이트 지연' : '확인 필요'}</strong></div>
            </CardContent>
          </Card>
        </section>
      </main>
    </ScreenFrame>
  );
}

export default function Home() {
  const [route, setRoute] = useState(routeFromHash);
  const [todayBoard, setTodayBoard] = useState<TodayBoardData | null>(null);
  const [todayDataError, setTodayDataError] = useState<string | null>(null);
  const [hoveredChartKey, setHoveredChartKey] = useState<string | null>(null);

  useEffect(() => {
    const syncRoute = () => {
      setRoute(routeFromHash());
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    syncRoute();
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

  useEffect(() => {
    let active = true;
    loadTodayBoard()
      .then((data) => {
        if (!active) return;
        setTodayBoard(data);
        setTodayDataError(null);
      })
      .catch(() => {
        if (!active) return;
        setTodayDataError('저장된 지진 데이터를 불러오지 못했습니다.');
      });
    return () => { active = false; };
  }, []);

  const status = todayBoard?.status;
  const todayEvents = todayBoard?.todayEvents ?? [];
  const recentWeek = todayBoard?.recentDays.slice(-7) ?? [];
  const comparisonDays = todayBoard?.recentDays.slice(-3) ?? [];
  const finalizedDays = todayBoard?.recentDays.filter((record) => record.state === 'final').slice(-2) ?? [];
  const confirmedDelta = finalizedDays.length === 2 ? finalizedDays[1].count - finalizedDays[0].count : null;
  const comparisonMaximum = Math.max(...comparisonDays.map((record) => record.count), 1);
  const weekMaximum = Math.max(...recentWeek.map((record) => record.count), 1);
  const weekTotal = recentWeek.reduce((sum, record) => sum + record.count, 0);
  const largestToday = [...todayEvents].sort((a, b) => b.magnitude - a.magnitude || b.timeUtc.localeCompare(a.timeUtc)).slice(0, 3);
  const currentTime = formatKstTime(status?.dataThrough);
  const [currentHour = 0, currentMinute = 0] = currentTime.split(':').map(Number);
  const currentProgress = Number.isFinite(currentHour) ? Math.min(94, Math.max(2, ((currentHour * 60 + currentMinute) / 1440) * 100)) : 2;

  const [routePath, routeQuery = ''] = route.split('?');

  if (routePath === 'explore') {
    const targetDate = status?.targetDateKst ?? '2026-09-02';
    return <ExploreScreen initialQuery={routeQuery} key={`${targetDate}:${routeQuery}`} targetDate={targetDate} />;
  }
  if (routePath === 'map') {
    const targetDate = status?.targetDateKst ?? '2026-09-02';
    return <MapScreen initialQuery={routeQuery} key={`${targetDate}:${routeQuery}`} targetDate={targetDate} />;
  }
  if (routePath.startsWith('day/')) return <DayScreen />;
  if (routePath.startsWith('event/')) {
    const eventId = routePath.split('/')[1] ?? '';
    const queryParams = new URLSearchParams(routeQuery);
    const requestedReturn = queryParams.get('from') ?? 'explore';
    const eventMonth = queryParams.get('month');
    const returnTo = requestedReturn === 'today' || requestedReturn === 'map' || requestedReturn === 'explore' || /^day\/\d{4}-\d{2}-\d{2}$/.test(requestedReturn)
      ? requestedReturn
      : 'explore';
    return <EventScreen board={todayBoard} eventId={eventId} eventMonth={eventMonth} key={eventId} liveEvent={todayEvents.find((event) => event.id === eventId)} returnTo={returnTo} />;
  }

  return (
    <ScreenFrame active="today" collectionState={status?.state}>
      <main className="shell page-shell screen-page">
        <section className="page-heading" aria-labelledby="today-heading">
          <div>
            <div className="eyebrow-row">
              <span className="eyebrow">TODAY / KST</span>
              <span className="sample-label">{status ? `${status.targetDateKst.replaceAll('-', '.')} · KST` : 'DATA LOADING'}</span>
            </div>
            <h1 id="today-heading">오늘의 지구 맥박</h1>
            <p>전 세계 규모 4.0 이상 지진을 한국시간 기준으로 기록합니다.</p>
          </div>
          <div className="heading-meta" aria-label="오늘 날짜와 갱신 일정">
            <div><CalendarDays /><span><small>기준 날짜</small><strong>{status ? formatKoreanDate(status.targetDateKst) : '불러오는 중'}</strong><em>Asia/Seoul</em></span></div>
            <div><RefreshCw /><span><small>마지막 갱신</small><strong>{status ? `${formatKstTime(status.lastSuccessAt)} KST` : '불러오는 중'}</strong><em>{status?.state === 'fresh' ? '정상 수집' : status?.state === 'delayed' ? '업데이트 지연' : '상태 확인 중'}</em></span></div>
            <div><Clock3 /><span><small>다음 자동 수집</small><strong>{status ? `${formatKstTime(status.nextScheduledAt)} KST` : '불러오는 중'}</strong><em>00:10부터 3시간 간격</em></span></div>
          </div>
        </section>

        <section className="hero-grid" aria-label="오늘의 지진 요약">
          <article className="live-card">
            <div className="live-card-head">
              <div>
                <span className="section-kicker">오늘 현재까지</span>
                <div className="metric-line"><strong>{todayBoard ? todayEvents.length : '—'}</strong><span>건</span></div>
                <p>{todayDataError ?? '규모 4.0 이상 · 전 세계'}</p>
              </div>
              <span className="provisional-pill">잠정 집계</span>
            </div>

            <div className="pulse-stage">
              <PulseLine dataThrough={status?.dataThrough} events={todayEvents} />
              <div className="cumulative-chart-label"><span>발생 시각 기반 누적</span><strong>{todayBoard ? `${todayEvents.length}건` : '확인 중'}</strong></div>
              <span className="current-point-label" style={{ left: `${currentProgress}%` }}>{status ? `${currentTime}까지 수집` : '데이터 확인 중'}</span>
              <div className="cumulative-axis"><span>00시</span><span>06시</span><span>12시</span><span>18시</span><span>24시</span></div>
            </div>

            <div className="live-card-foot">
              <div><Clock3 /><span><small>집계 범위</small><strong>{status ? `00:00—${currentTime} KST` : '확인 중'}</strong></span></div>
              <div><Gauge /><span><small>집계 기준</small><strong>규모 {status?.minMagnitude?.toFixed(1) ?? '4.0'} 이상</strong></span></div>
              <div><Database /><span><small>공개 원천</small><strong>USGS ComCat</strong></span></div>
            </div>
          </article>

          <Card className="comparison-card">
            <CardHeader>
              <div>
                <span className="section-kicker ink">최근 확정 기록</span>
                <CardTitle className="mt-1 text-xl">하루가 끝난 값끼리 비교</CardTitle>
                <CardDescription>오늘 잠정값은 변화량에서 제외합니다.</CardDescription>
              </div>
              <CardAction><Button className="view-action" onClick={() => { if (finalizedDays.length === 2) window.location.hash = `/explore?start=${finalizedDays[0].dateKst}&end=${finalizedDays[1].dateKst}&min=4&depth=700`; }} size="sm" variant="outline">확정 기록 탐색 <ChevronRight /></Button></CardAction>
            </CardHeader>
            <CardContent className="comparison-content">
              <div className="day-bars" aria-label={comparisonDays.map((record) => `${record.dateKst} ${record.count}건 ${record.state === 'final' ? '확정' : '잠정'}`).join(', ')}>
                {comparisonDays.map((record) => {
                  const tooltipKey = `comparison-${record.dateKst}`;
                  const edgeClass = record === comparisonDays[0] ? 'tooltip-edge-start' : record === comparisonDays.at(-1) ? 'tooltip-edge-end' : '';
                  return <div aria-label={`${formatKoreanDate(record.dateKst)} ${record.count}건 ${record.state === 'final' ? '확정' : '잠정'}`} className={`day-bar-column ${edgeClass} ${record.dateKst === finalizedDays.at(-1)?.dateKst ? 'is-latest' : ''} ${record.state === 'provisional' ? 'is-provisional' : ''}`} key={record.dateKst} onBlur={() => setHoveredChartKey(null)} onFocus={() => setHoveredChartKey(tooltipKey)} onMouseEnter={() => setHoveredChartKey(tooltipKey)} onMouseLeave={() => setHoveredChartKey(null)} tabIndex={0}>
                    <span className="bar-value">{record.count}</span>
                    <span className="day-bar" style={{ height: `${record.count === 0 ? 2 : Math.max(12, (record.count / comparisonMaximum) * 100)}%` }} />
                    <small>{record.state === 'provisional' ? '오늘' : shortDate(record.dateKst)}</small>
                    <em>{record.state === 'final' ? '확정' : '잠정'}</em>
                    {hoveredChartKey === tooltipKey && <span className="bar-chart-tooltip"><small>{formatKoreanDate(record.dateKst)}</small><strong>{record.count}건 · {record.state === 'final' ? '확정' : '잠정'}</strong></span>}
                  </div>;
                })}
              </div>
              <div className="delta-panel">
                <span>직전 확정일 대비</span><strong>{confirmedDelta === null ? '—' : `${confirmedDelta >= 0 ? '+' : ''}${confirmedDelta}건`}</strong>{finalizedDays.length === 2 ? <small className="comparison-period"><span>{shortDate(finalizedDays[0].dateKst)}<b>{finalizedDays[0].count}건</b></span><i>→</i><span>{shortDate(finalizedDays[1].dateKst)}<b>{finalizedDays[1].count}건</b></span></small> : <small>확정 기록 확인 중</small>}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="content-grid">
          <Card className="week-card">
            <CardHeader>
              <div>
                <span className="section-kicker ink">THIS WEEK</span>
                <CardTitle className="mt-1">이번 주의 흐름</CardTitle>
                <CardDescription>오늘 잠정값을 포함한 누적 현황입니다.</CardDescription>
              </div>
              <CardAction><Badge className="soft-badge" variant="secondary">{weekTotal}건</Badge></CardAction>
            </CardHeader>
            <CardContent>
              <div className="week-chart" aria-label="최근 7일 지진 건수 막대 그래프">
                {recentWeek.map((record) => {
                  const tooltipKey = `week-${record.dateKst}`;
                  const edgeClass = record === recentWeek[0] ? 'tooltip-edge-start' : record === recentWeek.at(-1) ? 'tooltip-edge-end' : '';
                  return <div aria-label={`${formatKoreanDate(record.dateKst)} ${record.count}건 ${record.state === 'final' ? '확정' : '잠정'}`} className={`week-column ${edgeClass}`} key={record.dateKst} onBlur={() => setHoveredChartKey(null)} onFocus={() => setHoveredChartKey(tooltipKey)} onMouseEnter={() => setHoveredChartKey(tooltipKey)} onMouseLeave={() => setHoveredChartKey(null)} tabIndex={0}>
                    <span className={record.state === 'provisional' ? 'is-today' : ''} style={{ height: `${record.count === 0 ? 2 : Math.max(8, (record.count / weekMaximum) * 100)}%` }} />
                    <small>{weekdayLabel(record.dateKst, status?.targetDateKst ?? '')}</small>
                    {hoveredChartKey === tooltipKey && <span className="bar-chart-tooltip"><small>{formatKoreanDate(record.dateKst)}</small><strong>{record.count}건 · {record.state === 'final' ? '확정' : '잠정'}</strong></span>}
                  </div>;
                })}
              </div>
              <div className="chart-note">
                <span><i className="legend-solid" /> 확정 기록</span>
                <span><i className="legend-dotted" /> 오늘 잠정</span>
              </div>
            </CardContent>
          </Card>

          <Card className="events-card">
            <CardHeader>
              <div><span className="section-kicker ink">LARGEST TODAY</span><CardTitle className="mt-1">오늘 규모가 큰 지진</CardTitle></div>
              <CardAction><Button className="view-action" onClick={() => { if (status) window.location.hash = `/explore?start=${status.targetDateKst}&end=${status.targetDateKst}&min=${status.minMagnitude}&depth=700`; }} size="sm" variant="outline">오늘 기록 탐색 <ArrowUpRight /></Button></CardAction>
            </CardHeader>
            <CardContent className="event-list">
              {largestToday.map((event) => (
                <button className="event-row" key={event.id} onClick={() => { window.location.hash = `/event/${event.id}?from=today`; }} type="button">
                  <span className={`magnitude-token ${eventTone(event.magnitude)}`}>{event.magnitude.toFixed(1)}</span>
                  <span className="event-place">
                    <strong>{event.place}</strong>
                    <small><MapPin /> {event.depthKm === null ? '깊이 자료 없음' : `${event.depthKm.toFixed(1)} km`} · {event.timeKst.slice(0, 5)} KST</small>
                  </span>
                  <ChevronRight className="event-chevron" />
                </button>
              ))}
              {todayBoard && largestToday.length === 0 && <div className="data-empty">현재까지 규모 4.0 이상 지진이 없습니다.</div>}
              {!todayBoard && <div className="data-empty">실제 지진 기록을 불러오는 중입니다.</div>}
            </CardContent>
          </Card>
        </section>

        <section className="source-strip" aria-label="데이터 출처와 상태">
          <div><Database /><span><small>공개 원천</small><strong>USGS ComCat</strong></span></div>
          <div><Clock3 /><span><small>원천 응답 생성</small><strong>{status?.source.generatedAt ? `${formatKstTime(status.source.generatedAt, true)} KST` : '확인 중'}</strong></span></div>
          <div><ShieldCheck /><span><small>마지막 정상 수집</small><strong>{status?.lastSuccessAt ? `${formatKstTime(status.lastSuccessAt, true)} KST` : '확인 중'}</strong></span></div>
          <a className="source-link" href={status?.source.queryUrl ?? 'https://earthquake.usgs.gov/fdsnws/event/1/'} rel="noreferrer" target="_blank">USGS 원천 보기 <ExternalLink /></a>
        </section>
      </main>
    </ScreenFrame>
  );
}
