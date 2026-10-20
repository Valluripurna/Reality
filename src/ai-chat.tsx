import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AssistantAction, AssistantContext, assistantReply, ChatTurn } from './ai';
import { useMarketplace } from './marketplace';
import { Button, C, Chip, Icon, IconButton, radius, type } from './ui';

type Message = { id: string; from: 'user' | 'bot'; text: string; actions?: AssistantAction[]; suggestions?: string[] };

const WELCOME: Message = {
  id: 'hello',
  from: 'bot',
  text: "Describe the problem in a sentence and I'll tell you the likely cause, what you can safely try, and a fair price range.",
  suggestions: ['Tap keeps dripping', 'MCB keeps tripping', 'AC not cooling', 'How does this app work?']
};

/** Renders **bold** spans; everything else as plain text. */
function Rich({ text, color }: { text: string; color: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={[type.body, { color }]}>
      {parts.map((p, i) => (p.startsWith('**') && p.endsWith('**')
        ? <Text key={i} style={{ fontWeight: '700' }}>{p.slice(2, -2)}</Text>
        : <Text key={i}>{p}</Text>))}
    </Text>
  );
}

function Bubble({ m, children }: { m: Message; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v]);
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }], alignSelf: m.from === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
      {children}
    </Animated.View>
  );
}

export function AIChatModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useMarketplace();
  const scroll = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const context = useRef<AssistantContext>({});

  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages, thinking]);

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || thinking) return;
    setInput('');
    const history: ChatTurn[] = messages.filter(m => m.id !== 'hello').map(m => ({ from: m.from, text: m.text }));
    setMessages(m => [...m, { id: `${Date.now()}`, from: 'user', text }]);
    setThinking(true);
    try {
      const reply = await assistantReply(text, context.current, history);
      // Remember what we're talking about so follow-ups ("how much?") stay on topic.
      if (reply.topicId) context.current = { topicId: reply.topicId, kind: reply.kind };
      else if (reply.kind) context.current = { kind: reply.kind };
      setMessages(m => [...m, { id: `${Date.now()}-r`, from: 'bot', text: reply.text, actions: reply.actions, suggestions: reply.suggestions }]);
    } catch {
      setMessages(m => [...m, { id: `${Date.now()}-e`, from: 'bot', text: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setThinking(false);
    }
  };

  const book = (a: AssistantAction) => {
    onClose();
    router.push({ pathname: '/request', params: { category: a.category, ...(a.title ? { title: a.title } : {}) } });
  };

  const lastBot = [...messages].reverse().find(m => m.from === 'bot');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : undefined} onRequestClose={onClose}>
      <View style={[s.page, { paddingTop: Platform.OS === 'ios' ? 8 : insets.top }]}>
        <View style={s.header}>
          <View style={s.botIcon}><Icon name="chatbubbles" size={18} color={C.white} /></View>
          <View style={{ flex: 1 }}>
            <Text style={type.heading}>Service assistant</Text>
            <Text style={type.caption}>General guidance — a pro confirms on site</Text>
          </View>
          <IconButton icon="close" label="Close assistant" onPress={onClose} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView ref={scroll} contentContainerStyle={s.list} keyboardShouldPersistTaps="handled">
            {messages.map(m => (
              <Bubble key={m.id} m={m}>
                <View style={[s.bubble, m.from === 'user' ? s.user : s.bot]}>
                  <Rich text={m.text} color={m.from === 'user' ? C.white : C.ink} />
                </View>
                {m.from === 'bot' && m.actions?.length && profile?.role !== 'pro' ? (
                  <View style={{ marginTop: 8, flexDirection: 'row', gap: 8 }}>
                    {m.actions.map(a => (
                      <Button key={a.label} testID="assistant-book" label={a.label} icon="arrow-forward" variant="brand" size="md" onPress={() => book(a)} />
                    ))}
                  </View>
                ) : null}
              </Bubble>
            ))}
            {thinking && (
              <View style={[s.bubble, s.bot, { flexDirection: 'row', gap: 8, alignItems: 'center', alignSelf: 'flex-start' }]}>
                <ActivityIndicator size="small" color={C.muted} />
                <Text style={type.small}>Thinking…</Text>
              </View>
            )}
            {!thinking && lastBot?.suggestions?.length ? (
              <View style={s.suggestions}>
                {lastBot.suggestions.map(q => <Chip key={q} label={q} onPress={() => send(q)} />)}
              </View>
            ) : null}
          </ScrollView>

          <View style={[s.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <TextInput
              testID="assistant-input"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => send()}
              placeholder="Describe the problem…"
              placeholderTextColor={C.faint}
              returnKeyType="send"
              style={s.input}
            />
            <Pressable
              testID="assistant-send"
              onPress={() => send()}
              disabled={!input.trim() || thinking}
              accessibilityRole="button"
              accessibilityLabel="Send"
              style={[s.send, (!input.trim() || thinking) && { backgroundColor: C.surface2 }]}
            >
              <Icon name="arrow-up" size={20} color={C.white} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.white },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  botIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.brand, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, gap: 12 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  user: { backgroundColor: C.ink, borderBottomRightRadius: 6 },
  bot: { backgroundColor: C.surface, borderBottomLeftRadius: 6 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  input: { flex: 1, height: 46, borderRadius: radius.pill, backgroundColor: C.surface, paddingHorizontal: 18, fontSize: 15, color: C.ink, outlineStyle: 'none' } as any,
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }
});
