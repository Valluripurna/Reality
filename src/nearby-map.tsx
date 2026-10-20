import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { DatabaseEngine } from './db';
import { DEFAULT_COORDS, distanceKm, etaMinutes } from './location';
import { MapProPin, ServiceKind } from './types';
import { Avatar, Button, C, Icon, radius, type } from './ui';

type LatLng = { lat: number; lng: number };

type NearbyMapProps = {
  height?: number;
  /** The customer / job position. Null = unknown (map shows a city view and says so). */
  center?: LatLng | null;
  /** Only show pros offering this service. */
  kind?: ServiceKind;
  onSelectPro?: (pro: MapProPin | null) => void;
  selectedProId?: string | null;
  /** Live-tracking mode: the assigned pro and (if known) their real position. */
  activeRoutePro?: { name: string; from?: LatLng | null } | null;
};

/** Pros shown on the customer's map: online, with a real reported position, within 25 km. */
const MAP_RADIUS_KM = 25;

export function useNearbyPros(center: LatLng, kind?: ServiceKind) {
  const [pins, setPins] = useState<MapProPin[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => DatabaseEngine.loadRegisteredPros().then(pros => {
      if (!alive) return;
      const k = kind?.toLowerCase();
      const list = pros
        .filter(p => p.isOnline !== false && p.phone && p.name && p.liveLat != null && p.liveLng != null)
        .map(p => {
          const skills = (typeof p.skills === 'string' ? p.skills.split(',') : []).map(x => x.trim()).filter(Boolean);
          const d = Number(distanceKm(center, { lat: p.liveLat!, lng: p.liveLng! }).toFixed(1));
          return {
            id: p.phone!, name: p.name, skills, lat: p.liveLat!, lng: p.liveLng!,
            rating: p.ratingScore ?? 0, distanceKm: d, eta: `${etaMinutes(d)} min`, phone: p.phone!, isOnline: true
          } as MapProPin;
        })
        .filter(p => p.distanceKm <= MAP_RADIUS_KM)
        .filter(p => !k || k === 'other' || p.skills.some(s => s.toLowerCase() === k))
        .sort((a, b) => a.distanceKm - b.distanceKm);
      setPins(list);
    });
    load();
    const t = setInterval(load, 20000); // pros move; refresh their pins
    return () => { alive = false; clearInterval(t); };
  }, [center.lat, center.lng, kind]);
  return pins;
}

/**
 * The map page. Built once per centre; afterwards the pro's marker and route
 * are moved in place through window.rcUpdatePro(), so live tracking doesn't
 * reload tiles every few seconds.
 */
function buildHtml(center: LatLng, pins: MapProPin[], tracking: boolean, centerKnown: boolean) {
  const data = JSON.stringify({ center, centerKnown, tracking, pins: pins.map(p => ({ id: p.id, name: p.name.split(' ')[0], lat: p.lat, lng: p.lng })) });
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { margin:0; padding:0; height:100%; width:100%; background:#F5F5F2; font-family: -apple-system, system-ui, Roboto, sans-serif; }
  .pin { background:#111214; color:#fff; font-size:12px; font-weight:600; padding:5px 10px; border-radius:14px; white-space:nowrap; box-shadow:0 2px 8px rgba(0,0,0,.25); border:2px solid #fff; transform: translate(-50%, -50%); display:inline-block; }
  .pin.sel { background:#0E8A63; }
  .me { width:14px; height:14px; border-radius:50%; background:#2A6CF0; border:3px solid #fff; box-shadow:0 0 0 6px rgba(42,108,240,.18), 0 2px 6px rgba(0,0,0,.3); }
  .leaflet-control-attribution { font-size:9px !important; background: rgba(255,255,255,.75) !important; }
  .leaflet-tile-pane { filter: grayscale(0.55) contrast(0.95) brightness(1.03); }
  .leaflet-marker-icon { transition: transform 0.8s linear; }
</style></head><body><div id="map"></div>
<script>
(function () {
  var D = ${data};
  function send(msg) {
    var s = JSON.stringify(msg);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
    else if (window.parent) window.parent.postMessage({ source: 'rc-map', payload: s }, '*');
  }
  var C = [D.center.lat, D.center.lng];
  var map = L.map('map', { zoomControl: false, attributionControl: true }).setView(C, D.centerKnown ? 15 : 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
  map.attributionControl.setPrefix(false);
  if (D.centerKnown) L.marker(C, { icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }) }).addTo(map);

  // Live tracking: one marker + straight route, moved in place on each update.
  var proMarker = null, route = null, fitted = false;
  window.rcUpdatePro = function (lat, lng, label) {
    if (lat == null || lng == null) return;
    var P = [lat, lng];
    var html = '<div class="pin sel">' + label + '</div>';
    if (!proMarker) {
      proMarker = L.marker(P, { icon: L.divIcon({ className: '', html: html, iconSize: [0, 0] }) }).addTo(map);
      route = L.polyline([P, C], { color: '#111214', weight: 4, opacity: 0.85, dashArray: '1 8', lineCap: 'round' }).addTo(map);
    } else {
      proMarker.setLatLng(P);
      proMarker.setIcon(L.divIcon({ className: '', html: html, iconSize: [0, 0] }));
      route.setLatLngs([P, C]);
    }
    if (!fitted) { map.fitBounds(L.latLngBounds([P, C]), { padding: [44, 44], maxZoom: 16 }); fitted = true; }
  };
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (d && d.type === 'rc-pro') window.rcUpdatePro(d.lat, d.lng, d.label);
  });
  if (D.tracking) { send({ type: 'ready' }); return; }

  var markers = {};
  D.pins.forEach(function (p) {
    var m = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html: '<div class="pin" id="pin-' + p.id + '">' + p.name + '</div>', iconSize: [0, 0] }) }).addTo(map);
    m.on('click', function () {
      Object.keys(markers).forEach(function (k) { var el = document.getElementById('pin-' + k); if (el) el.className = 'pin'; });
      var el = document.getElementById('pin-' + p.id); if (el) el.className = 'pin sel';
      send({ type: 'select', id: p.id });
    });
    markers[p.id] = m;
  });
  if (D.pins.length) {
    var pts = D.pins.map(function (p) { return [p.lat, p.lng]; }); if (D.centerKnown) pts.push(C);
    map.fitBounds(L.latLngBounds(pts), { padding: [36, 36], maxZoom: 15 });
  }
})();
</script></body></html>`;
}

export function NearbyMap({ height = 200, center, kind, onSelectPro, selectedProId, activeRoutePro }: NearbyMapProps) {
  const here = center ?? DEFAULT_COORDS;
  const tracking = !!activeRoutePro;
  const pins = useNearbyPros(here, tracking ? undefined : kind);
  const [localSel, setLocalSel] = useState<string | null>(null);
  const selId = selectedProId !== undefined ? selectedProId : localSel;
  const selected = pins.find(p => p.id === selId) ?? null;
  const webRef = useRef<WebView>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Rebuilt only when the place or the set of pins changes — not on pro movement.
  const pinKey = tracking ? '' : pins.map(p => `${p.id}:${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');
  const html = useMemo(
    () => buildHtml(here, tracking ? [] : pins, tracking, !!center),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [here.lat, here.lng, pinKey, tracking, !!center]
  );
  useEffect(() => setMapReady(false), [html]);

  // Push the pro's live position into the page.
  const from = activeRoutePro?.from;
  const liveKm = from ? distanceKm(from, here) : null;
  const label = activeRoutePro ? `${activeRoutePro.name.split(' ')[0]}${liveKm != null ? ` · ${etaMinutes(liveKm)} min` : ''}` : '';
  useEffect(() => {
    if (!tracking || !mapReady || !from) return;
    if (Platform.OS === 'web') {
      frameRef.current?.contentWindow?.postMessage({ type: 'rc-pro', lat: from.lat, lng: from.lng, label }, '*');
    } else {
      webRef.current?.injectJavaScript(`window.rcUpdatePro(${from.lat}, ${from.lng}, ${JSON.stringify(label)}); true;`);
    }
  }, [tracking, mapReady, from?.lat, from?.lng, label]); // eslint-disable-line react-hooks/exhaustive-deps

  const handle = (raw: string) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === 'ready') setMapReady(true);
      if (msg.type === 'select') {
        const pro = pins.find(p => p.id === msg.id) ?? null;
        setLocalSel(pro?.id ?? null);
        onSelectPro?.(pro);
      }
    } catch { /* ignore */ }
  };

  // Web: the map lives in an iframe and talks back through window.postMessage.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const listener = (e: MessageEvent) => {
      if (e.data?.source === 'rc-map' && e.source === frameRef.current?.contentWindow) handle(e.data.payload);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  });

  if (height <= 0) return null;

  const overlay = tracking
    ? from
      ? `${activeRoutePro!.name.split(' ')[0]} is ${liveKm! < 0.1 ? 'here' : `${liveKm!.toFixed(1)} km away`}`
      : `Waiting for ${activeRoutePro!.name.split(' ')[0]}'s live location`
    : !center
      ? 'Set your location to see pros near you'
      : pins.length ? `${pins.length} pro${pins.length > 1 ? 's' : ''} online nearby` : 'No pros online nearby right now';

  return (
    <View>
      <View style={[s.map, { height }]}>
        {Platform.OS === 'web'
          ? createElement('iframe', { ref: frameRef, srcDoc: html, title: 'Map', style: { width: '100%', height: '100%', border: 0 } })
          : (
            <WebView
              ref={webRef}
              originWhitelist={['*']}
              source={{ html, baseUrl: 'https://realitychain.app' }}
              onMessage={e => handle(e.nativeEvent.data)}
              style={{ flex: 1, backgroundColor: C.surface }}
              scrollEnabled={false}
              javaScriptEnabled
              domStorageEnabled
            />
          )}
        <View style={s.overlay} pointerEvents="none">
          <View style={[s.dot, tracking && !from && { backgroundColor: C.amber }]} />
          <Text style={s.overlayText}>{overlay}</Text>
        </View>
      </View>

      {selected && onSelectPro && (
        <View style={s.card}>
          <Avatar name={selected.name} size={42} />
          <View style={{ flex: 1 }}>
            <Text style={type.bodyStrong}>{selected.name}</Text>
            <Text style={type.small} numberOfLines={1}>
              {selected.rating ? `★ ${selected.rating.toFixed(1)} · ` : ''}{selected.distanceKm} km · {selected.skills.slice(0, 2).join(', ') || 'General'}
            </Text>
          </View>
          <Button label="Clear" size="md" variant="ghost" onPress={() => { setLocalSel(null); onSelectPro(null); }} />
        </View>
      )}
    </View>
  );
}

/** Static strip used where a live map adds nothing (e.g. completed jobs). */
export function MapPlaceholder({ label }: { label: string }) {
  return (
    <View style={s.placeholder}>
      <Icon name="map-outline" size={20} color={C.muted} />
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  map: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: C.surface },
  overlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.brandBright },
  overlayText: { fontSize: 12, fontWeight: '600', color: C.ink },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: C.line },
  placeholder: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: radius.lg, backgroundColor: C.surface }
});
