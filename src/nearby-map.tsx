import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { DatabaseEngine } from './db';
import { MapProPin, ServiceKind } from './types';
import { C, Icon } from './ui';
import { useToast } from './toast';

const categoryPills: (ServiceKind | 'All')[] = [
  'All', 'Plumbing', 'Electrical', 'Appliance repair', 'Cleaning', 'Carpentry', 'Painting'
];

type NearbyMapProps = {
  onSelectPro?: (pro: MapProPin) => void;
  height?: number;
  interactive?: boolean;
  activeRoutePro?: { name: string; distanceKm: number; eta: string } | null;
};

export function NearbyMap({ onSelectPro, height = 180, interactive = true, activeRoutePro }: NearbyMapProps) {
  const toast = useToast();
  const [livePros, setLivePros] = useState<MapProPin[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ServiceKind | 'All'>('All');
  const [activePin, setActivePin] = useState<MapProPin | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    DatabaseEngine.loadRegisteredPros().then(pros => {
      const pins: MapProPin[] = pros.map(p => {
        const skillsList = typeof p.skills === 'string'
          ? (p.skills.split(',').map((s: string) => s.trim()) as ServiceKind[])
          : (p.skills ?? ['Other']);
        return {
          id: p.phone || `pro-${Math.random()}`,
          name: p.name,
          skills: skillsList,
          lat: p.liveLat ?? 12.9791,
          lng: p.liveLng ?? 77.6020,
          rating: p.ratingScore ?? 4.9,
          distanceKm: 1.2,
          eta: '8 min',
          phone: p.phone || '9876543210',
          isOnline: p.isOnline ?? true
        };
      });
      setLivePros(pins);
    });
  }, []);

  const [zoomLevel, setZoomLevel] = useState(15);
  const [mapScale, setMapScale] = useState(1.0);

  const handleZoomIn = () => {
    const nextZoom = Math.min(19, zoomLevel + 1);
    const nextScale = Math.min(1.8, mapScale + 0.2);
    setZoomLevel(nextZoom);
    setMapScale(nextScale);
    toast.show(`Google Maps Zoom In (Level ${nextZoom})`, 'info');
  };

  const handleZoomOut = () => {
    const nextZoom = Math.max(12, zoomLevel - 1);
    const nextScale = Math.max(0.7, mapScale - 0.2);
    setZoomLevel(nextZoom);
    setMapScale(nextScale);
    toast.show(`Google Maps Zoom Out (Level ${nextZoom})`, 'info');
  };

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rippleAnim = useRef(new Animated.Value(0.4)).current;
  const moveAlongRouteAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
        ]),
        Animated.sequence([
          Animated.timing(rippleAnim, { toValue: 1.6, duration: 1200, useNativeDriver: true }),
          Animated.timing(rippleAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true })
        ]),
        Animated.sequence([
          Animated.timing(moveAlongRouteAnim, { toValue: 1, duration: 8000, useNativeDriver: true }),
          Animated.timing(moveAlongRouteAnim, { toValue: 0, duration: 500, useNativeDriver: true })
        ])
      ])
    ).start();
  }, []);

  const filteredPros = livePros.filter(p => {
    if (selectedCategory === 'All') return true;
    return p.skills.includes(selectedCategory);
  });

  const handlePinPress = (pro: MapProPin) => {
    setActivePin(pro);
    toast.show(`Active Service Pro: ${pro.name} (${pro.rating}★ · ${pro.eta} away)`, 'info');
    if (onSelectPro) {
      onSelectPro(pro);
    }
  };

  const getPinPos = (index: number) => {
    const coords = [
      { top: '22%', left: '25%' },
      { top: '48%', right: '18%' },
      { bottom: '28%', left: '55%' },
      { top: '28%', right: '45%' }
    ];
    return coords[index % coords.length];
  };

  const currentHeight = isExpanded ? 360 : height;

  const interpolatedTranslateX = moveAlongRouteAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [60, -40]
  });

  const interpolatedTranslateY = moveAlongRouteAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-30, 20]
  });

  const googleMapsUrl = `https://maps.google.com/maps?q=12.9716,77.5946&z=${zoomLevel}&output=embed&controls=0&disableDefaultUI=true`;

  const leafletHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; width: 100%; background: #F8FAFC; overflow: hidden; }
    #map { width: 100%; height: 100%; }
    .pro-pill {
      background: #0F172A;
      color: #10B981;
      font-family: system-ui, -apple-system, sans-serif;
      font-weight: 800;
      font-size: 11px;
      padding: 6px 12px;
      border-radius: 20px;
      border: 2px solid #10B981;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .leaflet-control-attribution { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([12.9716, 77.5946], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    var pros = ${JSON.stringify(filteredPros)};
    pros.forEach(function(p) {
      var icon = L.divIcon({
        className: 'custom-pin',
        html: '<div class="pro-pill">★ ' + p.rating + ' ' + p.name.split(' ')[0] + '</div>',
        iconSize: [90, 32],
        iconAnchor: [45, 16]
      });
      L.marker([p.lat, p.lng], { icon: icon }).addTo(map)
        .bindPopup('<b style="color:#0F172A;font-size:13px">' + p.name + '</b><br><span style="color:#10B981;font-weight:700">' + p.skills.join(', ') + '</span><br><small>ETA: ' + p.eta + ' (' + p.distanceKm + ' km)</small>');
    });
  </script>
</body>
</html>
  `;

  return (
    <View style={s.container}>
      {/* 100% Free High-Definition Leaflet / OpenStreetMap Canvas */}
      <View style={[s.mapCanvas, { height: currentHeight }]}>
        {Platform.OS === 'web' ? (
          <View style={{ width: '100%', height: currentHeight, overflow: 'hidden', borderRadius: 22 }}>
            {/* @ts-ignore */}
            <iframe
              srcDoc={leafletHtml}
              style={{ width: '100%', height: currentHeight, border: 0, borderRadius: 22, pointerEvents: 'auto' }}
            />
          </View>
        ) : (
          <View style={{ width: '100%', height: currentHeight, overflow: 'hidden', borderRadius: 22 }}>
            <WebView
              originWhitelist={['*']}
              source={{ html: leafletHtml }}
              style={{ width: '100%', height: currentHeight, borderRadius: 22 }}
              scrollEnabled={false}
              javaScriptEnabled={true}
              domStorageEnabled={true}
            />
          </View>
        )}

        {/* Active Pro Location Pins ONLY */}
        {filteredPros.map((pro, idx) => {
          const pos = getPinPos(idx);
          const isSelected = activePin?.id === pro.id;
          return (
            <Animated.View
              key={pro.id}
              style={[
                s.proPinWrap,
                pos as any,
                isSelected && { zIndex: 99, transform: [{ scale: 1.2 }] }
              ]}
            >
              <Pressable
                onPress={() => handlePinPress(pro)}
                style={[s.proPin, isSelected && s.proPinActive]}
              >
                <Icon name="construct" size={14} color={C.white} />
              </Pressable>

              {/* Pin Callout Badge */}
              <View style={s.pinLabel}>
                <Text style={s.pinLabelText}>{pro.name.split(' ')[0]}</Text>
                <Text style={s.pinRatingText}>★{pro.rating}</Text>
              </View>
            </Animated.View>
          );
        })}
      </View>

      {/* Selected Pro Card Overlay */}
      {activePin && (
        <View style={s.selectedProCard}>
          <View style={s.proAvatarWrap}>
            <Icon name="person" size={20} color={C.white} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.proHeaderRow}>
              <Text style={s.proNameText}>{activePin.name}</Text>
              <View style={s.ratingBadge}>
                <Icon name="star" size={12} color="#E6A92D" />
                <Text style={s.ratingScoreText}>{activePin.rating}</Text>
              </View>
            </View>
            <Text style={s.proSkillsText}>{activePin.skills.join(' · ')}</Text>
            <Text style={s.proDistanceText}>📍 {activePin.distanceKm} km away · ETA {activePin.eta}</Text>
          </View>
          <Pressable
            onPress={() => {
              toast.show(`Selecting ${activePin.name} for request...`);
              setActivePin(null);
            }}
            style={s.selectProBtn}
          >
            <Text style={s.selectProBtnText}>Book Pro</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    marginVertical: 10
  },
  pillScroll: {
    marginBottom: 8
  },
  pillContent: {
    gap: 7,
    paddingHorizontal: 2
  },
  floatingPillBar: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    zIndex: 100
  },
  pill: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 7,
    elevation: 4
  },
  pillSelected: {
    backgroundColor: C.green,
    borderColor: C.green
  },
  pillText: {
    color: C.navy,
    fontSize: 12,
    fontWeight: '800'
  },
  pillTextSelected: {
    color: C.white
  },
  mapCanvas: {
    backgroundColor: '#0F172A',
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    elevation: 6
  },
  zoomControls: {
    position: 'absolute',
    bottom: 54,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    overflow: 'hidden',
    zIndex: 100,
    elevation: 5
  },
  zoomBtn: {
    width: 36,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center'
  },
  zoomText: {
    color: C.navy,
    fontWeight: '900',
    fontSize: 18
  },
  zoomDivider: {
    height: 1,
    backgroundColor: '#E2E8F0'
  },
  osmAttribution: {
    position: 'absolute',
    bottom: 4,
    right: 10,
    backgroundColor: 'rgba(15,23,42,0.6)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 90
  },
  osmText: {
    color: '#94A3B8',
    fontSize: 8,
    fontWeight: '600'
  },
  urbanBlock4: {
    position: 'absolute',
    bottom: '12%',
    right: '12%',
    width: '26%',
    height: '32%',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  avenueMainHorizontal: {
    position: 'absolute',
    width: '130%',
    height: 18,
    backgroundColor: '#334155',
    transform: [{ rotate: '-12deg' }],
    top: '44%',
    left: '-15%',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#475569'
  },
  avenueMainVertical: {
    position: 'absolute',
    height: '140%',
    width: 18,
    backgroundColor: '#334155',
    transform: [{ rotate: '25deg' }],
    left: '46%',
    top: '-20%',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#475569'
  },
  streetSecondary: {
    position: 'absolute',
    width: '120%',
    height: 10,
    backgroundColor: '#334155',
    transform: [{ rotate: '60deg' }],
    top: '25%',
    left: '-10%'
  },
  streetLabelH: {
    position: 'absolute',
    top: '46%',
    left: '10%',
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    transform: [{ rotate: '-12deg' }]
  },
  streetLabelV: {
    position: 'absolute',
    top: '20%',
    left: '48%',
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    transform: [{ rotate: '25deg' }]
  },
  routeGlowLine: {
    position: 'absolute',
    height: 6,
    backgroundColor: 'rgba(99, 102, 241, 0.4)',
    width: '65%',
    left: '25%',
    top: '42%',
    borderRadius: 3,
    zIndex: 10
  },
  routeCoreLine: {
    position: 'absolute',
    height: 3,
    backgroundColor: C.indigo,
    width: '65%',
    left: '25%',
    top: '43.5%',
    borderRadius: 1.5,
    zIndex: 11
  },
  compassWidget: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100
  },
  compassText: {
    color: C.gold,
    fontSize: 10,
    fontWeight: '900'
  },
  gpsTagBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#334155',
    zIndex: 100
  },
  gpsTagText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: 'monospace'
  },
  movingProMarker: {
    position: 'absolute',
    right: '25%',
    top: '40%',
    zIndex: 90,
    alignItems: 'center'
  },
  movingProPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.navy,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.gold,
    elevation: 6
  },
  gpsBadge: {
    backgroundColor: C.gold,
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginTop: 2
  },
  gpsText: {
    color: C.navy,
    fontSize: 9,
    fontWeight: '900'
  },
  userPos: {
    position: 'absolute',
    bottom: '30%',
    left: '35%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  userRipple: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(231,117,66,0.3)'
  },
  userMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    elevation: 4
  },
  proPinWrap: {
    position: 'absolute',
    alignItems: 'center'
  },
  proPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    elevation: 4
  },
  proPinActive: {
    backgroundColor: C.orange,
    borderColor: C.white
  },
  pinLabel: {
    backgroundColor: C.white,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    elevation: 2
  },
  pinLabelText: {
    color: C.ink,
    fontSize: 10,
    fontWeight: '800'
  },
  pinRatingText: {
    color: '#D48806',
    fontSize: 10,
    fontWeight: '900'
  },
  mapOverlayBottom: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  legendWrap: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.green
  },
  legendText: {
    color: C.green,
    fontSize: 11,
    fontWeight: '800'
  },
  expandBtn: {
    backgroundColor: C.white,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  expandText: {
    color: C.green,
    fontSize: 11,
    fontWeight: '800'
  },
  selectedProCard: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 13,
    marginTop: 8,
    borderWidth: 1,
    borderColor: C.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    elevation: 4
  },
  proAvatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center'
  },
  proHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  proNameText: {
    color: C.ink,
    fontWeight: '900',
    fontSize: 14
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF8E7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  ratingScoreText: {
    color: C.ink,
    fontSize: 11,
    fontWeight: '900'
  },
  proSkillsText: {
    color: C.muted,
    fontSize: 11,
    marginTop: 2
  },
  proDistanceText: {
    color: C.green,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3
  },
  selectProBtn: {
    backgroundColor: C.green,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  selectProBtnText: {
    color: C.white,
    fontWeight: '800',
    fontSize: 12
  }
});

