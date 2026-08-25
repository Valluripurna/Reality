import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { GrokAIEngine } from './ai';
import { useToast } from './toast';
import { Button, C, Icon } from './ui';

type MessageItem = {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  imageUri?: string;
  timestamp: string;
};

type AIChatModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function AIChatModal({ visible, onClose }: AIChatModalProps) {
  const toast = useToast();
  const scrollRef = React.useRef<ScrollView>(null);
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: '1',
      sender: 'ai',
      text: 'Hello! I am your AI Chat Assistant. Describe your repair problem or upload an issue photo for an instant diagnosis, tool list & fair cost estimate!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [visible, messages, loading]);

  const handlePickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7
    });

    if (!res.canceled && res.assets[0]?.uri) {
      setAttachedImage(res.assets[0].uri);
      toast.show('Issue photo attached to AI chat query', 'info');
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() && !attachedImage) return;

    const userMsgText = inputText.trim() || 'Uploaded issue photo for AI analysis';
    const newMsg: MessageItem = {
      id: Date.now().toString(),
      sender: 'user',
      text: userMsgText,
      imageUri: attachedImage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newMsg]);
    setInputText('');
    const currentImg = attachedImage;
    setAttachedImage(undefined);
    setLoading(true);

    try {
      let fullResponse = '';
      if (currentImg) {
        const analysis = await GrokAIEngine.analyzeIssue(userMsgText, currentImg);
        fullResponse = `🔍 **AI Issue Diagnosis**: ${analysis.diagnosis}\n\n🛠️ **Recommended Tools & Parts**:\n• ${analysis.recommendedParts.join('\n• ')}\n\n⏱️ **Est. Repair Duration**: ${analysis.estimatedLaborMins} mins (Confidence: ${analysis.confidenceScore}%)\n\n${analysis.safetyWarning || '⚠️ Exercise standard electrical and physical safety precautions.'}`;
      } else {
        fullResponse = await GrokAIEngine.chatResponse(userMsgText);
      }

      setLoading(false);

      // Typewriter Streaming Animation
      const words = fullResponse.split(' ');
      const aiMsgId = (Date.now() + 1).toString();
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Insert empty AI message
      setMessages(prev => [...prev, { id: aiMsgId, sender: 'ai', text: '▋', timestamp: timeStr }]);

      let currentWords = '';
      for (let i = 0; i < words.length; i++) {
        currentWords += (i === 0 ? '' : ' ') + words[i];
        const isLast = i === words.length - 1;
        const textToDisplay = currentWords + (isLast ? '' : ' ▋');

        setMessages(prev => prev.map(m => (m.id === aiMsgId ? { ...m, text: textToDisplay } : m)));
        scrollRef.current?.scrollToEnd({ animated: true });
        await new Promise(r => setTimeout(r, 22));
      }
    } catch (err) {
      toast.show('Error connecting to AI Chat Assistant', 'warning');
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.backdrop}>
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <View style={s.aiBadgeIcon}>
                <Icon name="sparkles" size={20} color={C.white} />
              </View>
              <View>
                <Text style={s.title}>AI Chat Assistant</Text>
                <Text style={s.sub}>Verified Repair & Service Helper</Text>
              </View>
            </View>

            <Pressable onPress={onClose} style={s.closeBtn}>
              <Icon name="close" size={20} color={C.navy} />
            </Pressable>
          </View>

          {/* Messages Scroll Area */}
          <ScrollView ref={scrollRef} contentContainerStyle={s.msgScroll} showsVerticalScrollIndicator={false}>
            {messages.map(m => (
              <View
                key={m.id}
                style={[
                  s.msgBubble,
                  m.sender === 'user' ? s.userMsgBubble : s.aiMsgBubble
                ]}
              >
                {m.imageUri && (
                  <Image source={{ uri: m.imageUri }} style={s.msgImagePreview} resizeMode="cover" />
                )}
                <Text style={[s.msgText, m.sender === 'user' ? s.userMsgText : s.aiMsgText]}>
                  {m.text}
                </Text>
                <Text style={[s.timeText, m.sender === 'user' ? s.userTimeText : s.aiTimeText]}>
                  {m.timestamp}
                </Text>
              </View>
            ))}

            {loading && (
              <View style={s.aiThinkingBubble}>
                <Icon name="sparkles" size={16} color={C.indigo} />
                <Text style={s.aiThinkingText}>AI Assistant is analyzing query...</Text>
              </View>
            )}
          </ScrollView>

          {/* Attached Image Bar */}
          {attachedImage && (
            <View style={s.attachBar}>
              <Image source={{ uri: attachedImage }} style={s.attachThumb} />
              <Text style={s.attachText}>Photo attached</Text>
              <Pressable onPress={() => setAttachedImage(undefined)}>
                <Icon name="close-circle" size={18} color={C.crimson} />
              </Pressable>
            </View>
          )}

          {/* Input Box */}
          <View style={s.inputRow}>
            <Pressable onPress={handlePickImage} style={s.cameraBtn}>
              <Icon name="camera" size={20} color={C.green} />
            </Pressable>

            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask a question or describe issue..."
              placeholderTextColor="#94A3B8"
              style={s.input}
              onSubmitEditing={handleSend}
            />

            <Pressable onPress={handleSend} style={s.sendBtn}>
              <Icon name="send" size={18} color={C.white} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end'
  },
  sheet: {
    height: '82%',
    backgroundColor: C.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 18,
    gap: 12
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: C.line
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  aiBadgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: C.indigo,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    color: C.navy,
    fontWeight: '900',
    fontSize: 17
  },
  sub: {
    color: C.muted,
    fontSize: 11
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.line
  },
  msgScroll: {
    gap: 12,
    paddingVertical: 10
  },
  msgBubble: {
    maxWidth: '82%',
    padding: 13,
    borderRadius: 18,
    gap: 4
  },
  userMsgBubble: {
    alignSelf: 'flex-end',
    backgroundColor: C.green,
    borderBottomRightRadius: 4
  },
  aiMsgBubble: {
    alignSelf: 'flex-start',
    backgroundColor: C.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: C.line
  },
  msgImagePreview: {
    width: 180,
    height: 120,
    borderRadius: 12,
    marginBottom: 4
  },
  msgText: {
    fontSize: 13,
    lineHeight: 18
  },
  userMsgText: {
    color: C.white,
    fontWeight: '700'
  },
  aiMsgText: {
    color: C.navy,
    fontWeight: '600'
  },
  timeText: {
    fontSize: 9,
    alignSelf: 'flex-end',
    marginTop: 2
  },
  userTimeText: {
    color: 'rgba(255, 255, 255, 0.7)'
  },
  aiTimeText: {
    color: C.muted
  },
  aiThinkingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    padding: 10,
    borderRadius: 14,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#C7D2FE'
  },
  aiThinkingText: {
    color: C.indigo,
    fontWeight: '700',
    fontSize: 12
  },
  attachBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.white,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line
  },
  attachThumb: {
    width: 32,
    height: 32,
    borderRadius: 8
  },
  attachText: {
    flex: 1,
    color: C.navy,
    fontSize: 12,
    fontWeight: '700'
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  cameraBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: C.line
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.line,
    paddingHorizontal: 14,
    color: C.navy,
    fontWeight: '700',
    fontSize: 14,
    outlineStyle: 'none' as any
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
