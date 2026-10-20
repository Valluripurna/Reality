import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FREE_ACCEPTS, useMarketplace } from './marketplace';
import { Sheet } from './sheet';
import { useToast } from './toast';
import { Badge, C, radius, type } from './ui';

const PLANS = [
  { id: 'Day' as const, title: 'Day pass', price: '₹49', per: 'for 24 hours', body: 'Unlimited quotes and job accepts today.' },
  { id: 'Monthly' as const, title: 'Monthly pass', price: '₹499', per: 'for 30 days', body: 'Unlimited quotes all month. Best for full-time pros.', best: true }
];

export function PassSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const toast = useToast();
  const { activatePass } = useMarketplace();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Keep winning jobs"
      subtitle={`Every pro gets ${FREE_ACCEPTS} free quotes. A pass removes the limit — no commission per lead.`}
    >
      {PLANS.map(p => (
        <Pressable
          key={p.id}
          onPress={() => {
            activatePass(p.id);
            onClose();
            toast.show(`${p.title} active`, 'success');
          }}
          accessibilityRole="button"
          style={({ pressed }) => [s.plan, p.best && s.best, pressed && { opacity: 0.85 }]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[type.bodyStrong, p.best && { color: C.white }]}>{p.title}</Text>
              {p.best ? <Badge label="Best value" tone="brand" /> : null}
            </View>
            <Text style={[type.small, p.best && { color: 'rgba(255,255,255,0.7)' }]}>{p.body}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[type.title, p.best && { color: C.white }]}>{p.price}</Text>
            <Text style={[type.caption, p.best && { color: 'rgba(255,255,255,0.6)' }]}>{p.per}</Text>
          </View>
        </Pressable>
      ))}
      <Text style={[type.caption, { textAlign: 'center' }]}>Demo build: passes activate without a charge.</Text>
    </Sheet>
  );
}

const s = StyleSheet.create({
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: C.lineStrong },
  best: { backgroundColor: C.ink, borderColor: C.ink }
});
