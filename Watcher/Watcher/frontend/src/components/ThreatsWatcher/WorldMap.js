import React, {
    useState, useEffect, useMemo, useCallback, useRef, Fragment,
} from 'react';
import { connect } from 'react-redux';
import {
    DeckGL, GeoJsonLayer, ScatterplotLayer,
    TileLayer, BitmapLayer,
    _GlobeView, MapView,
} from 'deck.gl';
import { feature } from 'topojson-client';
import { getSources } from '../../actions/WorldMap';
import { getRansomwareVictims } from '../../actions/CyberWatch';
import { isoToGeoName, GEO_TO_ISO, buildCountryCountMap, isoToFlag } from '../../utils/isoCountries';
import { useTheme } from '../../contexts/ThemeContext';
import preferencesService from '../../services/preferencesService';

// Basemaps. "theme" is drawn locally from the bundled country shapes (works offline, follows the
// active theme); the others are online raster tiles kept for users who have internet access.
const BASEMAPS = {
    theme: {
        label: 'Theme',
        icon: 'palette',
        url: null,
    },
    dark: {
        label: 'Dark',
        icon: 'dark_mode',
        url: 'https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
        bg: '#0d1117',
        polyFill:   [18, 30,  52,  255],
        polyStroke: [80, 110, 160,  90],
        online: true,
    },
    positron: {
        label: 'Light',
        icon: 'light_mode',
        url: 'https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png',
        bg: '#f0f4f8',
        polyFill:   [190, 210, 235, 200],
        polyStroke: [100, 130, 160, 120],
        online: true,
    },
    satellite: {
        label: 'Satellite',
        icon: 'satellite',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        bg: '#020609',
        polyFill:   [0, 0, 0, 0],
        polyStroke: [255, 255, 255, 55],
        online: true,
    },
};
const BASEMAP_PREF = 'worldmap_basemap';
const SHADE_PREF = 'worldmap_shade';

const INITIAL_VIEW_STATE = { longitude: 10, latitude: 20, zoom: 1.2, pitch: 0, bearing: 0 };

const readVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const readRgb = (name, fallback) => {
    const parts = readVar(`--bs-${name}-rgb`).split(',').map(n => parseInt(n, 10));
    return parts.length === 3 && parts.every(Number.isFinite) ? parts : fallback;
};
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const toHex = rgb => `#${rgb.map(v => v.toString(16).padStart(2, '0')).join('')}`;

function themePalette() {
    const bg = readRgb('body-bg', [255, 255, 255]);
    const ink = readRgb('body-color', [33, 37, 41]);
    const dark = document.documentElement.getAttribute('data-wt-mode') === 'dark';
    const land = mix(bg, ink, dark ? 0.13 : 0.1);
    return {
        dark,
        ocean: toHex(mix(bg, ink, dark ? 0.02 : 0.035)),
        land: [...land, 255],
        border: [...mix(bg, ink, dark ? 0.3 : 0.32), 220],
        primary: readRgb('primary', [13, 110, 253]),
        danger: readRgb('danger', [220, 53, 69]),
        info: readRgb('info', [13, 202, 240]),
        warning: readRgb('warning', [255, 193, 7]),
        landRgb: land,
        surface: bg,
    };
}

// Some themes (Clay...) have a primary very close to danger: trending dots then switch to purple
const PURPLE = [133, 103, 196];
const distance = (a, b) => Math.sqrt(a.reduce((acc, v, i) => acc + (v - b[i]) ** 2, 0));
const trendingRgb = pal => (distance(pal.primary, pal.danger) < 90 ? PURPLE : pal.primary);

// Zoom that shows the whole world in the panel width
const fitView = width => ({ ...INITIAL_VIEW_STATE, zoom: clamp(Math.log2((width || 800) / 420), 0.2, 2.2) });

function extractDomain(url) {
    try {
        const hostname = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
        const parts = hostname.split('.');
        if (
            parts.length >= 3 &&
            ['co','com','gov','org','net','edu','ac'].includes(parts[parts.length - 2])
        ) return parts.slice(-3).join('.');
        return parts.slice(-2).join('.');
    } catch { return ''; }
}

function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

/**
 * Returns the center of the LARGEST polygon in the feature (by bbox area).
 * This prevents overseas territories (French Guiana, Alaska islands, etc.)
 * from skewing the centroid of the metropolitan country.
 */
function getFeatureCenter(geometry) {
    if (!geometry?.coordinates) return null;
    const polys =
        geometry.type === 'Polygon'      ? [geometry.coordinates] :
        geometry.type === 'MultiPolygon' ? geometry.coordinates   : [];
    if (!polys.length) return null;

    let best = null;
    let bestArea = -Infinity;
    polys.forEach(poly => {
        let [mnLng, mnLat, mxLng, mxLat] = [Infinity, Infinity, -Infinity, -Infinity];
        poly.forEach(ring => ring.forEach(([lng, lat]) => {
            if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
            if (lng < mnLng) mnLng = lng; if (lat < mnLat) mnLat = lat;
            if (lng > mxLng) mxLng = lng; if (lat > mxLat) mxLat = lat;
        }));
        if (![mnLng, mnLat, mxLng, mxLat].every(Number.isFinite)) return;
        const area = (mxLng - mnLng) * (mxLat - mnLat);
        if (area > bestArea) { bestArea = area; best = [mnLng, mnLat, mxLng, mxLat]; }
    });
    if (!best) return null;
    return [clamp((best[0] + best[2]) / 2, -179, 179), clamp((best[1] + best[3]) / 2, -80, 82)];
}

function buildCenters(geoJson) {
    if (!geoJson?.features) return {};
    const out = {};
    geoJson.features.forEach(f => {
        const n = f.properties?.name;
        if (!n) return;
        const c = getFeatureCenter(f.geometry);
        if (c) out[n] = c;
    });
    return out;
}

function buildWordsPerCC(sources, leads) {
    const dom = {};
    (sources || []).forEach(s => {
        if (!s.country_code) return;
        const d = extractDomain(s.url);
        if (d) dom[d] = s.country_code;
    });
    const out = {};
    (leads || []).forEach(word => {
        const seen = new Set();
        (word.posturls || []).forEach(ps => {
            const url = typeof ps === 'string' ? ps.split(',')[0] : (ps.url || '');
            const cc = dom[extractDomain(url)];
            if (!cc || seen.has(cc)) return;
            seen.add(cc);
            if (!out[cc]) out[cc] = [];
            out[cc].push({ name: word.name, score: word.score || 0 });
        });
    });
    return out;
}



function WorldMap({
    sources, leads, ransomwareVictims,
    getSources, getRansomwareVictims,
    onCountrySelect, embedded, filterCountry,
}) {
    const { currentTheme, themeVersion } = useTheme();
    const [viewState, setViewState]     = useState(INITIAL_VIEW_STATE);
    const [geoJson, setGeoJson]         = useState(null);
    const [basemap, setBasemapState]    = useState(() => {
        const saved = preferencesService.get(BASEMAP_PREF, 'theme');
        return BASEMAPS[saved] ? saved : 'theme';
    });
    const [shade, setShadeState]        = useState(() => preferencesService.get(SHADE_PREF, true) !== false);
    const [globeMode, setGlobeMode]     = useState(false);
    const [selectedIso, setSelectedIso] = useState(null);
    const [hoveredInfo, setHoveredInfo] = useState(null);
    const [visible, setVisible]         = useState({ sources: true, trending: true, victims: true });
    const [panelOpen, setPanelOpen]     = useState(true);
    const containerRef = useRef(null);

    // Until the user pans or zooms, keep the whole world fitted to the panel (panels are resizable
    // and only get their final width once the grid has laid out)
    const userMovedRef = useRef(false);
    const resetView = useCallback(() => {
        userMovedRef.current = false;
        setViewState(fitView(containerRef.current?.clientWidth));
    }, []);

    useEffect(() => {
        const el = containerRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(() => {
            if (!userMovedRef.current && el.clientWidth) setViewState(vs => ({ ...vs, zoom: fitView(el.clientWidth).zoom }));
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        setSelectedIso(filterCountry || null);
    }, [filterCountry]);

    // Preferences may arrive after the first render
    useEffect(() => {
        const onReady = () => {
            const saved = preferencesService.get(BASEMAP_PREF, 'theme');
            if (BASEMAPS[saved]) setBasemapState(saved);
            setShadeState(preferencesService.get(SHADE_PREF, true) !== false);
        };
        window.addEventListener('watcher:prefs:ready', onReady);
        return () => window.removeEventListener('watcher:prefs:ready', onReady);
    }, []);

    const setBasemap = key => { setBasemapState(key); preferencesService.set(BASEMAP_PREF, key); };
    const setShade = on => { setShadeState(on); preferencesService.set(SHADE_PREF, on); };

    // Colours are read from the theme's CSS variables. They are re-read when the theme changes and
    // again once its stylesheet has actually applied (the swap is asynchronous).
    const [paletteTick, setPaletteTick] = useState(0);
    useEffect(() => {
        const bump = () => setPaletteTick(t => t + 1);
        const link = document.getElementById('theme-stylesheet');
        if (link) link.addEventListener('load', bump);
        const timer = setTimeout(bump, 600);
        return () => {
            if (link) link.removeEventListener('load', bump);
            clearTimeout(timer);
        };
    }, [currentTheme, themeVersion]);
    const pal = useMemo(() => themePalette(), [currentTheme, themeVersion, paletteTick]); // eslint-disable-line react-hooks/exhaustive-deps
    const isTheme = basemap === 'theme';
    const bm = BASEMAPS[basemap];
    const DOT = useMemo(() => ({
        sources:  { rgb: pal.info,    hex: toHex(pal.info),    label: 'RSS sources' },
        trending: { rgb: trendingRgb(pal), hex: toHex(trendingRgb(pal)), label: 'Trending words' },
        victims:  { rgb: pal.danger,  hex: toHex(pal.danger),  label: 'Ransomware victims' },
    }), [pal]);

    useEffect(() => {
        getSources();
        if (!ransomwareVictims.length) getRansomwareVictims();
        fetch('/static/countries-110m.json')
            .then(r => r.json())
            .then(topo => {
                const geo = feature(topo, topo.objects.countries);
                geo.features = geo.features.filter(f => f.properties?.name !== 'Antarctica');
                setGeoJson(geo);
            })
            .catch(err => console.error('[WorldMap] GeoJSON load failed:', err));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const centers    = useMemo(() => buildCenters(geoJson), [geoJson]);
    const wordsByCC  = useMemo(() => buildWordsPerCC(sources, leads), [sources, leads]);

    const sourceCountByGeo = useMemo(() => {
        const m = {};
        (sources || []).forEach(s => {
            if (!s.country_code) return;
            const g = isoToGeoName(s.country_code);
            if (g) m[g] = (m[g] || 0) + 1;
        });
        return m;
    }, [sources]);

    const trendingCountByGeo = useMemo(() => {
        const m = {};
        Object.entries(wordsByCC).forEach(([cc, words]) => {
            const g = isoToGeoName(cc);
            if (g) m[g] = words.length;
        });
        return m;
    }, [wordsByCC]);

    const victimCountByGeo = useMemo(
        () => buildCountryCountMap(ransomwareVictims || [], 'country'),
        [ransomwareVictims]
    );
    const maxVictims = useMemo(() => Math.max(1, ...Object.values(victimCountByGeo)), [victimCountByGeo]);

    const toScatter = useCallback((countMap, extra = {}) =>
        Object.entries(countMap)
            .map(([geo, count]) => ({ position: centers[geo], count, geoName: geo, iso: GEO_TO_ISO[geo] || null, ...extra }))
            .filter(d => d.position),
    [centers]);

    const sourcesData  = useMemo(() => toScatter(sourceCountByGeo),  [toScatter, sourceCountByGeo]);
    const trendingData = useMemo(() => toScatter(trendingCountByGeo).map(d => ({
        ...d, words: d.iso ? (wordsByCC[d.iso] || []) : [],
    })), [toScatter, trendingCountByGeo, wordsByCC]);
    const victimsData  = useMemo(() => toScatter(victimCountByGeo),  [toScatter, victimCountByGeo]);

    const buildPayload = useCallback(geoName => {
        const iso = GEO_TO_ISO[geoName] || null;
        return {
            geoName, iso,
            sourceCount:   sourceCountByGeo[geoName]   || 0,
            trendingCount: trendingCountByGeo[geoName] || 0,
            victimCount:   victimCountByGeo[geoName]   || 0,
            words: iso ? (wordsByCC[iso] || []).slice(0, 8) : [],
        };
    }, [sourceCountByGeo, trendingCountByGeo, victimCountByGeo, wordsByCC]);

    const onGeoHover = useCallback(info => {
        const n = info.object?.properties?.name;
        setHoveredInfo(n ? { x: info.x, y: info.y, ...buildPayload(n) } : null);
    }, [buildPayload]);

    const onDotHover = useCallback(info => {
        const d = info.object;
        setHoveredInfo(d ? { x: info.x, y: info.y, ...buildPayload(d.geoName) } : null);
    }, [buildPayload]);

    const selectIso = useCallback(iso => {
        const next = selectedIso === iso ? null : iso;
        setSelectedIso(next);
        if (onCountrySelect) onCountrySelect(next);
    }, [selectedIso, onCountrySelect]);

    const onGeoClick = useCallback(info => {
        const n = info.object?.properties?.name;
        if (n) selectIso(GEO_TO_ISO[n] || null);
    }, [selectIso]);

    const onDotClick = useCallback(info => {
        if (info.object?.iso) selectIso(info.object.iso);
    }, [selectIso]);

    const zoomBy      = delta => {
        userMovedRef.current = true;
        setViewState(vs => ({ ...vs, zoom: clamp(vs.zoom + delta, 0.2, 12) }));
    };
    const toggleLayer = key   => setVisible(v => ({ ...v, [key]: !v[key] }));

    const deckView = useMemo(() =>
        globeMode ? new _GlobeView({ id: 'globe', repeat: true }) : new MapView({ id: 'map', repeat: true }),
    [globeMode]);

    // Sequential shade (one hue): land -> danger, on a log scale so a few hot spots don't flatten the rest
    const shadeFor = useCallback(count => {
        if (!count) return null;
        const t = 0.22 + 0.7 * (Math.log(count + 1) / Math.log(maxVictims + 1));
        return [...mix(pal.landRgb, pal.danger, t), 255];
    }, [pal, maxVictims]);

    const deckLayers = useMemo(() => {
        const hovGeo  = hoveredInfo?.geoName ?? null;
        const selGeo  = selectedIso
            ? (Object.keys(GEO_TO_ISO).find(k => GEO_TO_ISO[k] === selectedIso) || null)
            : null;
        const shading = shade && visible.victims;

        const tileLayer = bm.url ? new TileLayer({
            id: `basemap-tiles-${basemap}`,
            data: bm.url,
            minZoom: 0,
            maxZoom: 19,
            tileSize: 256,
            renderSubLayers: props => {
                const { west, south, east, north } = props.tile.bbox;
                return new BitmapLayer(props, { data: null, image: props.data, bounds: [west, south, east, north] });
            },
        }) : null;

        const baseFill = isTheme ? pal.land : bm.polyFill;
        const baseLine = isTheme ? pal.border : bm.polyStroke;

        const countryLayer = geoJson ? new GeoJsonLayer({
            id: 'countries',
            data: geoJson,
            pickable: true,
            filled: true,
            stroked: true,
            wrapLongitude: true,
            getFillColor: f => {
                const n = f.properties?.name;
                if (n && n === selGeo) return [...pal.primary, isTheme ? 200 : 110];
                const shaded = shading ? shadeFor(victimCountByGeo[n]) : null;
                const fill = shaded ? (isTheme ? shaded : [...shaded.slice(0, 3), 150]) : baseFill;
                if (n && n === hovGeo) return [...mix(fill.slice(0, 3), pal.primary, 0.3), Math.max(fill[3], 120)];
                return fill;
            },
            getLineColor: f => (f.properties?.name === selGeo ? [...pal.primary, 255] : baseLine),
            lineWidthMinPixels: 0.6,
            onHover: onGeoHover,
            onClick: onGeoClick,
            updateTriggers: {
                getFillColor: [hovGeo, selGeo, basemap, pal, shading, maxVictims],
                getLineColor: [selGeo, basemap, pal],
            },
        }) : null;

        const selectionGlow = (geoJson && selGeo) ? new GeoJsonLayer({
            id: 'country-sel-glow',
            data: { type: 'FeatureCollection', features: geoJson.features.filter(f => f.properties?.name === selGeo) },
            filled: false,
            stroked: true,
            wrapLongitude: true,
            getLineColor: [...pal.primary, 255],
            lineWidthMinPixels: 2.5,
            lineWidthMaxPixels: 4,
            pickable: false,
        }) : null;

        const ring = isTheme ? [...pal.surface, 230] : [255, 255, 255, 140];
        const dots = (id, data, key, radius) => new ScatterplotLayer({
            id,
            data,
            visible: visible[key],
            pickable: true,
            getPosition: d => d.position,
            getRadius: radius,
            radiusUnits: 'pixels',
            getFillColor: [...DOT[key].rgb, 215],
            getLineColor: ring,
            lineWidthMinPixels: 1.5,
            stroked: true,
            onHover: onDotHover,
            onClick: onDotClick,
            updateTriggers: { getFillColor: [pal], getLineColor: [pal, basemap] },
        });

        return [
            ...(tileLayer ? [tileLayer] : []),
            ...(countryLayer ? [countryLayer] : []),
            dots('scatter-sources', sourcesData, 'sources', d => clamp(4 + Math.sqrt(d.count) * 2.6, 4, 18)),
            dots('scatter-trending', trendingData, 'trending', d => clamp(5 + Math.sqrt(d.count) * 3, 5, 22)),
            dots('scatter-victims', victimsData, 'victims', d => clamp(4 + Math.sqrt(d.count) * 3.2, 4, 24)),
            ...(selectionGlow ? [selectionGlow] : []),
        ];
    }, [
        geoJson, bm, basemap, isTheme, pal, DOT, shade, shadeFor, maxVictims, victimCountByGeo,
        hoveredInfo, selectedIso, visible,
        sourcesData, trendingData, victimsData,
        onGeoHover, onGeoClick, onDotHover, onDotClick,
    ]);

    const sourcesCount = (sources || []).filter(s => s.country_code).length;
    const trendCount   = (leads || []).length;
    const vicCount     = (ransomwareVictims || []).length;
    const ocean = isTheme ? pal.ocean : bm.bg;

    const mapContent = (
        <div ref={containerRef} className="wt-map" style={{ background: ocean }}>
            <DeckGL
                views={deckView}
                viewState={viewState}
                onViewStateChange={({ viewState: vs, interactionState: is = {} }) => {
                    if (is.isDragging || is.isPanning || is.isZooming || is.isRotating) userMovedRef.current = true;
                    setViewState(vs);
                }}
                controller={true}
                layers={deckLayers}
                style={{ width: '100%', height: '100%' }}
                getCursor={({ isDragging }) => (isDragging ? 'grabbing' : (hoveredInfo ? 'pointer' : 'grab'))}
            />

            {/* Totals */}
            <div className="wt-map-panel wt-map-totals">
                {[
                    { key: 'sources', value: sourcesCount, label: 'sources' },
                    { key: 'trending', value: trendCount, label: 'trends' },
                    { key: 'victims', value: vicCount, label: 'victims' },
                ].map(t => (
                    <span key={t.key} title={DOT[t.key].label}>
                        <i className="wt-map-dot" style={{ background: DOT[t.key].hex }} />
                        <strong>{t.value}</strong> {t.label}
                    </span>
                ))}
            </div>

            {/* Controls */}
            <div className="wt-map-panel wt-map-controls">
                <button type="button" className="wt-map-controls-head" onClick={() => setPanelOpen(o => !o)} aria-expanded={panelOpen}>
                    <span><i className="material-icons" aria-hidden="true">tune</i> Map</span>
                    <i className="material-icons" aria-hidden="true">{panelOpen ? 'expand_less' : 'expand_more'}</i>
                </button>
                {panelOpen && (
                    <div className="wt-map-controls-body">
                        <div className="wt-map-label">Basemap</div>
                        <div className="wt-map-options">
                            {Object.entries(BASEMAPS).map(([key, b]) => (
                                <button
                                    key={key}
                                    type="button"
                                    className={basemap === key ? 'is-active' : ''}
                                    onClick={() => setBasemap(key)}
                                    title={b.online ? `${b.label} (online tiles)` : 'Drawn locally in the theme colours, works offline'}
                                >
                                    <i className="material-icons" aria-hidden="true">{b.icon}</i>
                                    {b.label}
                                    {b.online && <i className="material-icons wt-map-online" aria-label="online">cloud_queue</i>}
                                </button>
                            ))}
                        </div>

                        <div className="wt-map-label">Projection</div>
                        <div className="wt-segmented wt-map-seg" role="radiogroup" aria-label="Projection">
                            {[{ key: false, label: 'Flat' }, { key: true, label: 'Globe' }].map(opt => (
                                <button key={String(opt.key)} type="button" role="radio" aria-checked={globeMode === opt.key}
                                        className={globeMode === opt.key ? 'is-active' : ''} onClick={() => setGlobeMode(opt.key)}>
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        <div className="wt-map-label">Layers</div>
                        <div className="wt-map-layers">
                            {['sources', 'trending', 'victims'].map(key => (
                                <label key={key} className="wt-map-layer">
                                    <input type="checkbox" checked={visible[key]} onChange={() => toggleLayer(key)} />
                                    <i className="wt-map-dot" style={{ background: DOT[key].hex }} />
                                    {DOT[key].label}
                                </label>
                            ))}
                            <label className="wt-map-layer">
                                <input type="checkbox" checked={shade} onChange={() => setShade(!shade)} />
                                <i className="wt-map-swatch" />
                                Shade countries by victims
                            </label>
                        </div>

                        <button type="button" className="btn btn-secondary wt-btn-ghost btn-sm w-100 mt-2" onClick={resetView}>
                            <i className="material-icons" aria-hidden="true">home</i> Reset view
                        </button>
                    </div>
                )}
            </div>

            {/* Zoom */}
            <div className="wt-map-panel wt-map-zoom">
                <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => zoomBy(+0.8)}><i className="material-icons">add</i></button>
                <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => zoomBy(-0.8)}><i className="material-icons">remove</i></button>
            </div>

            {/* Victims shade legend */}
            {shade && visible.victims && vicCount > 0 && (
                <div className="wt-map-panel wt-map-legend">
                    <span>Victims per country</span>
                    <div className="wt-map-ramp" style={{
                        background: `linear-gradient(90deg, ${toHex(mix(pal.landRgb, pal.danger, 0.22))}, ${toHex(mix(pal.landRgb, pal.danger, 0.92))})`,
                    }} />
                    <div className="wt-map-ramp-labels"><span>1</span><span>{maxVictims}</span></div>
                </div>
            )}

            {/* Selected country */}
            {selectedIso && (
                <div className="wt-map-panel wt-map-selected">
                    <span>{isoToFlag(selectedIso)}</span>
                    <strong>{isoToGeoName(selectedIso) || selectedIso}</strong>
                    <button type="button" className="btn-close" aria-label="Deselect country"
                            onClick={() => { setSelectedIso(null); if (onCountrySelect) onCountrySelect(null); }} />
                </div>
            )}

            {/* Tooltip */}
            {hoveredInfo && (
                <div className="wt-map-panel wt-map-tooltip" style={{ left: hoveredInfo.x + 16, top: hoveredInfo.y - 12 }}>
                    <div className="wt-map-tooltip-title">
                        {hoveredInfo.iso && <span>{isoToFlag(hoveredInfo.iso)}</span>}
                        {hoveredInfo.geoName}
                    </div>
                    {[
                        { key: 'sources', n: hoveredInfo.sourceCount, one: 'RSS source', many: 'RSS sources' },
                        { key: 'trending', n: hoveredInfo.trendingCount, one: 'trending word', many: 'trending words' },
                        { key: 'victims', n: hoveredInfo.victimCount, one: 'ransomware victim', many: 'ransomware victims' },
                    ].filter(r => r.n > 0).map(r => (
                        <div key={r.key} className="wt-map-tooltip-row">
                            <i className="wt-map-dot" style={{ background: DOT[r.key].hex }} />
                            <strong>{r.n}</strong> {r.n > 1 ? r.many : r.one}
                        </div>
                    ))}
                    {hoveredInfo.words.length > 0 && (
                        <div className="wt-map-tooltip-words">{hoveredInfo.words.map(w => w.name).join(' · ')}</div>
                    )}
                    {!hoveredInfo.sourceCount && !hoveredInfo.trendingCount && !hoveredInfo.victimCount && (
                        <div className="wt-map-tooltip-empty">No data</div>
                    )}
                </div>
            )}
        </div>
    );

    if (embedded) return <Fragment>{mapContent}</Fragment>;

    return (
        <div style={{ height: 'calc(var(--wt-vh, 100vh) - 108px)', display: 'flex', flexDirection: 'column' }}>
            <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div className="card-body p-0" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {mapContent}
                </div>
            </div>
        </div>
    );
}


const mapStateToProps = state => ({
    sources:           state.WorldMap.sources             || [],
    leads:             state.leads.leads                  || [],
    ransomwareVictims: state.CyberWatch.ransomwareVictims || [],
    auth:              state.auth,
});

export default connect(mapStateToProps, { getSources, getRansomwareVictims })(WorldMap);
