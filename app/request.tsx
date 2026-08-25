import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { categories } from '../src/matching';
import { useMarketplace } from '../src/marketplace';
import { NearbyMap } from '../src/nearby-map';
import { BottomNav } from '../src/navigation';
import { useToast } from '../src/toast';
import { MapProPin, ServiceKind } from '../src/types';
import { Button, C, Icon } from '../src/ui';
import { DispatchModal } from '../src/dispatch-modal';

export default function Request() {
  const router = useRouter();
  const toast = useToast();
  const { estimate, request, addCustomCategory } = useMarketplace();
  const [kind, setKind] = useState<ServiceKind>('Plumbing');
  const [customCatInput, setCustomCatInput] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [imageUri, setImageUri] = useState<string | undefined>(undefined);
  const [selectedProPin, setSelectedProPin] = useState<MapProPin | null>(null);
  const [dispatching, setDispatching] = useState(false);
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);

  const reqCategoryScrollRef = useRef<ScrollView>(null);
  const [scrollPos, setScrollPos] = useState(0);
  const [isUserInteracting, setIsUserInteracting] = useState(false);

  useEffect(() => {
    if (isUserInteracting) return;
    const interval = setInterval(() => {
      setScrollPos(prev => {
        const nextPos = prev + 1.5;
        const maxScroll = categories.length * 130;
        const wrapPos = nextPos >= maxScroll ? 0 : nextPos;
        reqCategoryScrollRef.current?.scrollTo({ x: wrapPos, animated: false });
        return wrapPos;
      });
    }, 45);

    return () => clearInterval(interval);
  }, [isUserInteracting]);

  const marketMatch = estimate(kind, urgent ? 'Urgent' : 'Standard', imageUri);

  const attachPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7
    });

    if (!res.canceled && res.assets[0]?.uri) {
      const uri = res.assets[0].uri;
      setImageUri(uri);
      toast.show('Issue photo analyzed by AI price estimator', 'success');
    }
  };

  const handleAddCustomCategory = () => {
    if (!customCatInput.trim()) return;
    const catName = customCatInput.trim();
    addCustomCategory(catName);
    setKind(catName);
    setCustomCatInput('');
    toast.show(`Added new service category: ${catName}`, 'success');
  };

  const submit = () => {
    if (!title.trim()) {
      return Alert.alert('Issue Title Required', 'Please describe what needs fixing.');
    }

    const id = request({
      title: title.trim(),
      kind,
      detail: detail.trim() || 'Service request submitted via mobile app',
      urgency: urgent ? 'Urgent' : 'Standard',
      imageUri
    });

    setCreatedJobId(id);
    setDispatching(true);
  };

  const handleDispatchFinish = () => {
    setDispatching(false);
    toast.show('Request matched with nearby pro! Arrival PIN generated.', 'success');
    if (createdJobId) {
      router.replace(`/job/${createdJobId}` as any);
    }
  };

  return (
    <SafeAreaView style={s.page}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.kicker}>LOCAL SERVICE REQUEST</Text>
        <Text style={s.title}>What needs fixing?</Text>
        <Text style={s.sub}>We match your issue to nearby verified service professionals with transparent AI market pricing.</Text>

        <Text style={s.label}>Active Service Pros Nearby</Text>
        <NearbyMap
          onSelectPro={pro => {
            setSelectedProPin(pro);
            if (pro.skills[0]) {
              setKind(pro.skills[0]);
            }
          }}
        />

        {selectedProPin && (
          <View style={s.selectedProNotice}>
            <Icon name="checkmark-circle" size={18} color={C.green} />
            <Text style={s.selectedProNoticeText}>
              Selected pro: <Text style={{ fontWeight: '900' }}>{selectedProPin.name}</Text> ({selectedProPin.skills.join(', ')})
            </Text>
          </View>
        )}

        <ScrollView
          ref={reqCategoryScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexDirection: 'row', flexWrap: 'nowrap', gap: 8, paddingVertical: 6, paddingRight: 40 }}
          onTouchStart={() => setIsUserInteracting(true)}
          onTouchEnd={() => setTimeout(() => setIsUserInteracting(false), 3000)}
          onScrollBeginDrag={() => setIsUserInteracting(true)}
          onScrollEndDrag={() => setTimeout(() => setIsUserInteracting(false), 3000)}
        >
          {categories.map(x => (
            <Pressable key={x} onPress={() => setKind(x)}>
              <Text style={[s.option, kind === x && s.selected]}>
                {kind === x && '✓ '}{x}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Custom Category Input under "Other" */}
        {kind === 'Other' && (
          <View style={s.customCatBox}>
            <TextInput
              value={customCatInput}
              onChangeText={setCustomCatInput}
              placeholder="Type new service category name..."
              placeholderTextColor="#9AA39F"
              style={s.customInput}
            />
            <Button label="Add Category" onPress={handleAddCustomCategory} icon="add-circle" secondary />
          </View>
        )}

        <Text style={s.label}>Describe the issue</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Kitchen sink pipe leaking under cabinet"
          placeholderTextColor="#9AA39F"
          style={s.input}
        />

        {/* Issue Photo Attachment with AI Parsing */}
        <Text style={s.label}>Attach Issue Photo (AI Price & Time Parsing)</Text>
        <View style={s.photoBox}>
          {imageUri ? (
            <View style={{ gap: 8 }}>
              <Image source={{ uri: imageUri }} style={s.photoPreview} />
              <View style={s.aiAnalysisBadge}>
                <Icon name="sparkles" size={16} color={C.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={s.aiAnalysisTitle}>AI Image Complexity Analysis</Text>
                  <Text style={s.aiAnalysisSub}>
                    {marketMatch.complexityLabel} · Multiplier {marketMatch.complexityMultiplier}x · Est duration {marketMatch.workDurationEst}
                  </Text>
                </View>
              </View>
              <Button label="Change Photo" onPress={attachPhoto} icon="camera" secondary />
            </View>
          ) : (
            <Pressable onPress={attachPhoto} style={s.uploadBtn}>
              <Icon name="camera" color={C.green} size={22} />
              <Text style={s.uploadText}>Upload or capture issue photo for AI estimate</Text>
            </Pressable>
          )}
        </View>

        {/* Urgency Selector */}
        <Text style={s.label}>Priority Dispatch</Text>
        <View style={s.priority}>
          <Pressable onPress={() => setUrgent(false)} style={{ flex: 1 }}>
            <Text style={[s.priorityOption, !urgent && s.selected]}>Standard Service</Text>
          </Pressable>
          <Pressable onPress={() => setUrgent(true)} style={{ flex: 1 }}>
            <Text style={[s.priorityOption, urgent && s.urgent]}>Urgent (+₹150 Surge)</Text>
          </Pressable>
        </View>

        {/* Itemized Market Pricing Algorithm Card */}
        <View style={s.priceBreakdownCard}>
          <View style={s.priceHeaderRow}>
            <View style={s.priceIcon}>
              <Icon name="calculator" color={C.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.priceLabel}>Current Local Market Price</Text>
              <Text style={s.cost}>₹{marketMatch.estimate}</Text>
            </View>
          </View>

          <View style={s.breakdownDivider} />

          <View style={s.breakdownRow}>
            <Text style={s.breakdownLabel}>AI Labor Cost ({kind})</Text>
            <Text style={s.breakdownVal}>₹{marketMatch.aiLaborCost}</Text>
          </View>
          <View style={s.breakdownRow}>
            <Text style={s.breakdownLabel}>AI Parts / Material Cost</Text>
            <Text style={s.breakdownVal}>₹{marketMatch.aiPartsCost}</Text>
          </View>
          <View style={s.breakdownRow}>
            <Text style={s.breakdownLabel}>Distance Travel ({marketMatch.distanceKm} km @ ₹10/km)</Text>
            <Text style={s.breakdownVal}>+₹{marketMatch.distanceCharge}</Text>
          </View>
          <View style={s.breakdownRow}>
            <Text style={s.breakdownLabel}>Estimated Time Duration Fee</Text>
            <Text style={s.breakdownVal}>+₹{marketMatch.timeFee}</Text>
          </View>
          {urgent && (
            <View style={s.breakdownRow}>
              <Text style={s.breakdownLabel}>Urgency Priority Surge</Text>
              <Text style={s.breakdownVal}>+₹{marketMatch.surgeCharge}</Text>
            </View>
          )}
          <View style={s.breakdownRow}>
            <Text style={s.breakdownLabel}>Estimated Work Duration</Text>
            <Text style={[s.breakdownVal, { color: C.indigo }]}>{marketMatch.workDurationEst}</Text>
          </View>
        </View>

        {/* Arrival PIN Security Notice */}
        <View style={s.pinNoticeBox}>
          <Icon name="key" size={20} color={C.gold} />
          <View style={{ flex: 1 }}>
            <Text style={s.pinNoticeTitle}>Arrival Verification Security PIN</Text>
            <Text style={s.pinNoticeSub}>A unique 4-digit arrival PIN will be generated for your booking. Share it with your pro upon arrival.</Text>
          </View>
        </View>

        <Button label="Find Nearby Pro" onPress={submit} icon="navigate" />
      </ScrollView>

      {/* Uber/Rapido Style Slide-Up Bottom Sheet Dispatch Animation Modal */}
      <DispatchModal
        visible={dispatching}
        onDispatchComplete={handleDispatchFinish}
        serviceKind={kind}
        estimate={marketMatch.estimate}
        aiLaborCost={marketMatch.aiLaborCost}
        aiPartsCost={marketMatch.aiPartsCost}
        distanceKm={marketMatch.distanceKm}
      />

      <BottomNav />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.paper },
  content: { padding: 18, paddingBottom: 130 },
  kicker: { color: C.green, fontSize: 11, fontWeight: '900', letterSpacing: 1.3, marginTop: 20 },
  title: { color: C.navy, fontSize: 26, fontWeight: '900', marginTop: 5 },
  sub: { color: C.muted, lineHeight: 19, marginTop: 6, fontSize: 13 },
  label: { color: C.navy, fontWeight: '800', marginTop: 22, marginBottom: 8, fontSize: 14 },
  selectedProNotice: { backgroundColor: C.mint, borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  selectedProNoticeText: { color: C.green, fontSize: 12 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  option: { backgroundColor: C.white, borderColor: '#BCD5C7', borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8, color: C.green, fontWeight: '700', fontSize: 12, overflow: 'hidden' },
  selected: { backgroundColor: C.green, color: C.white, borderColor: C.green },
  customCatBox: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  customInput: { flex: 1, height: 48, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, color: C.ink, fontSize: 13, outlineStyle: 'none' as any },
  input: { height: 50, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, color: C.ink, fontSize: 14, outlineStyle: 'none' as any },
  detail: { height: 75, marginTop: 8, textAlignVertical: 'top', paddingTop: 12 },
  photoBox: { backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, padding: 12 },
  uploadBtn: { height: 60, borderRadius: 12, borderWidth: 1, borderColor: '#BCD5C7', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
  uploadText: { color: C.green, fontWeight: '800', fontSize: 13 },
  photoPreview: { width: '100%', height: 140, borderRadius: 12 },
  aiAnalysisBadge: { backgroundColor: '#FFFBEB', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#FDE68A', flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiAnalysisTitle: { color: C.navy, fontWeight: '900', fontSize: 12 },
  aiAnalysisSub: { color: '#B45309', fontSize: 11, marginTop: 2, fontWeight: '600' },
  priority: { flexDirection: 'row', gap: 9 },
  priorityOption: { textAlign: 'center', backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, color: C.ink, fontWeight: '700', fontSize: 12, overflow: 'hidden' },
  urgent: { backgroundColor: '#FFF0E8', color: '#B45229', borderColor: '#F4C5AD' },
  priceBreakdownCard: { backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 16, marginVertical: 18, gap: 8 },
  priceHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  priceIcon: { backgroundColor: C.navy, height: 42, width: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  priceLabel: { color: C.muted, fontSize: 11, fontWeight: '700' },
  cost: { color: C.navy, fontSize: 24, fontWeight: '900', marginTop: 2 },
  breakdownDivider: { height: 1, backgroundColor: C.line, marginVertical: 4 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakdownLabel: { color: C.muted, fontSize: 12 },
  breakdownVal: { color: C.navy, fontSize: 12, fontWeight: '800' },
  pinNoticeBox: { backgroundColor: '#FFFBEB', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#FDE68A', flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  pinNoticeTitle: { color: C.navy, fontWeight: '900', fontSize: 13 },
  pinNoticeSub: { color: '#B45309', fontSize: 11, marginTop: 2, lineHeight: 15 }
});


