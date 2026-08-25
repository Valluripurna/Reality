import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EventProvider } from '../src/store/events';
import { MarketplaceProvider } from '../src/marketplace';
import { ToastProvider } from '../src/toast';

export default function Layout() {
  return (
    <SafeAreaProvider>
      <EventProvider>
        <MarketplaceProvider>
          <ToastProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }} />
          </ToastProvider>
        </MarketplaceProvider>
      </EventProvider>
    </SafeAreaProvider>
  );
}
