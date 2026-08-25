import React, { useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { C, Icon } from './ui';

type SwipeButtonProps = {
  label: string;
  onSwipeComplete: () => void;
  color?: string;
};

export function SwipeButton({ label, onSwipeComplete, color = C.green }: SwipeButtonProps) {
  const [containerWidth, setContainerWidth] = useState(300);
  const panX = useRef(new Animated.Value(0)).current;

  const maxSwipe = Math.max(100, containerWidth - 54);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const dx = Math.max(0, Math.min(gestureState.dx, maxSwipe));
        panX.setValue(dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx >= maxSwipe * 0.75) {
          Animated.timing(panX, {
            toValue: maxSwipe,
            duration: 150,
            useNativeDriver: false
          }).start(() => {
            onSwipeComplete();
            setTimeout(() => {
              panX.setValue(0);
            }, 800);
          });
        } else {
          Animated.spring(panX, {
            toValue: 0,
            bounciness: 10,
            useNativeDriver: false
          }).start();
        }
      }
    })
  ).current;

  return (
    <View
      style={[s.container, { borderColor: color }]}
      onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Background Fill Track */}
      <Animated.View
        style={[
          s.fillTrack,
          {
            backgroundColor: color,
            width: panX.interpolate({
              inputRange: [0, maxSwipe],
              outputRange: [50, containerWidth],
              extrapolate: 'clamp'
            })
          }
        ]}
      />

      {/* Center Label Text */}
      <Text style={s.label}>{label} ››</Text>

      {/* Draggable Knob */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          s.knob,
          {
            transform: [{ translateX: panX }]
          }
        ]}
      >
        <Icon name="arrow-forward" color={C.white} size={20} />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    height: 54,
    backgroundColor: '#F1F5F9',
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
    marginVertical: 8
  },
  fillTrack: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 27,
    opacity: 0.25
  },
  label: {
    color: C.navy,
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.5
  },
  knob: {
    position: 'absolute',
    left: 3,
    top: 3,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.navy,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    elevation: 5
  }
});
