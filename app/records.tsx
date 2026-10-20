import { Redirect, useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { HomeBanner } from '../src/banner';
import { useMarketplace } from '../src/marketplace';
import { BottomNav, HomeHeader, useTabBarSpace } from '../src/navigation';
import { useEvents } from '../src/store/events';
import { Badge, Button, C, EmptyState, Icon, radius, type } from '../src/ui';
import { Pressable } from 'react-native';

export default function Records() {
  const router = useRouter();
  const bottomSpace = useTabBarSpace();
  const { profile } = useMarketplace();
  const { events } = useEvents();
  if (!profile) return <Redirect href="/welcome" />;

  return (
    <View style={s.page}>
      <HomeHeader left={<Text style={type.title}>Records</Text>} />
      <View style={s.bannerWrap}><HomeBanner role="records" /></View>
      <FlatList
        data={events}
        keyExtractor={e => e.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomSpace, flexGrow: 1 }}
        ListHeaderComponent={
          <View style={{ marginBottom: 16, gap: 12 }}>
            <Text style={type.small}>A timestamped trail for every job — quotes, arrival PIN, photos, payment. Useful for warranties, landlords and disputes.</Text>
            <Button label="Start a new record" icon="add" variant="secondary" size="md" onPress={() => router.push('/new-event')} />
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/event/${item.id}`)} accessibilityRole="button" style={({ pressed }) => [s.card, pressed && { backgroundColor: C.surface }]}>
            <View style={[s.icon, item.status === 'Resolved' && { backgroundColor: C.brandSoft }]}>
              <Icon name={item.status === 'Resolved' ? 'checkmark-done' : 'document-text-outline'} size={20} color={item.status === 'Resolved' ? C.brandDark : C.ink} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={type.bodyStrong} numberOfLines={1}>{item.title}</Text>
              <Text style={type.small} numberOfLines={1}>{item.type} · {item.items.length} entr{item.items.length === 1 ? 'y' : 'ies'}</Text>
              <Text style={type.caption}>{item.startedAt}</Text>
            </View>
            <Badge label={item.status === 'Resolved' ? 'Closed' : 'Open'} tone={item.status === 'Resolved' ? 'brand' : 'neutral'} />
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState icon="document-text-outline" title="No records yet" body="Records are created automatically when you book, or you can start one yourself." />
        }
      />
      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.white },
  bannerWrap: { paddingHorizontal: 20, marginBottom: 16 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: C.line },
  icon: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }
});
