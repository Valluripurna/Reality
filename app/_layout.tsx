import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { autoApplyUpdate } from '../src/updates';
import { EventProvider } from '../src/store/events';
import { MarketplaceProvider } from '../src/marketplace';
import { NotificationsProvider } from '../src/notifications-provider';
import { LocationProvider } from '../src/location-sync';
import { ToastProvider } from '../src/toast';
import { SplashScreenOverlay } from '../src/splash';
import { C } from '../src/ui';

// Keep the native splash up until our overlay (which looks identical) is on screen.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Layout() {
  const [showSplash, setShowSplash] = useState(true);
  const finishSplash = useCallback(() => setShowSplash(false), []);

  // Installed builds check for an OTA on every launch; if one is waiting it is
  // downloaded and applied (the app reloads once) before the user starts work.
  // No-op on web, in development and when updates are disabled.
  useEffect(() => {
    autoApplyUpdate().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <EventProvider>
        <MarketplaceProvider>
          <ToastProvider>
            <NotificationsProvider>
              <LocationProvider>
                <StatusBar style={showSplash ? 'light' : 'dark'} />
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.white }, animation: 'slide_from_right' }}>
                  <Stack.Screen name="index" options={{ animation: 'fade' }} />
                  <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
                  <Stack.Screen name="bookings" options={{ animation: 'none' }} />
                  <Stack.Screen name="records" options={{ animation: 'none' }} />
                  <Stack.Screen name="profile" options={{ animation: 'none' }} />
                  <Stack.Screen name="pro" options={{ animation: 'none' }} />
                </Stack>
                {showSplash && <SplashScreenOverlay onFinish={finishSplash} />}
              </LocationProvider>
            </NotificationsProvider>
          </ToastProvider>
        </MarketplaceProvider>
      </EventProvider>
    </SafeAreaProvider>
  );
}
