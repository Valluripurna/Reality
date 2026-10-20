import { useState } from 'react';
import { Text, View } from 'react-native';
import { describeAccuracy, geocodeAddress, locateErrorText } from './location';
import { useLocationStatus } from './location-sync';
import { useMarketplace } from './marketplace';
import { Sheet } from './sheet';
import { useToast } from './toast';
import { SavedPlace } from './types';
import { Button, C, Divider, Field, ListRow, type } from './ui';

export type LocationPreset = { name: string; area: string; lat: number; lng: number };

export const locationPresets: LocationPreset[] = [
  { name: 'Koramangala', area: 'Bengaluru 560034', lat: 12.9352, lng: 77.6245 },
  { name: 'Indiranagar', area: 'Bengaluru 560038', lat: 12.9784, lng: 77.6408 },
  { name: 'HSR Layout', area: 'Bengaluru 560102', lat: 12.9121, lng: 77.6446 },
  { name: 'Whitefield', area: 'Bengaluru 560066', lat: 12.9698, lng: 77.7499 },
  { name: 'MG Road', area: 'Bengaluru 560001', lat: 12.9756, lng: 77.6066 }
];

/**
 * Pick where the service is needed. Applies the choice to the profile itself:
 * GPS → a real high-accuracy fix plus its street address; a typed address →
 * geocoded to real coordinates (so distances and the map are right).
 */
export function LocationPromptModal({
  visible,
  onClose,
  savedPlaces = [],
  onDone
}: {
  visible: boolean;
  onClose: () => void;
  savedPlaces?: SavedPlace[];
  onDone?: (label: string) => void;
}) {
  const toast = useToast();
  const { setManualAddress } = useMarketplace();
  const { refresh } = useLocationStatus();
  const [text, setText] = useState('');
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const finish = (label: string) => {
    setText('');
    setError(undefined);
    onClose();
    onDone ? onDone(label) : toast.show(`Location set to ${label}`, 'success');
  };

  const useGps = async () => {
    setLocating(true);
    setError(undefined);
    const res = await refresh('explicit');
    setLocating(false);
    if (res.error) return setError(locateErrorText(res.error));
    finish(`${res.place?.short ?? 'your current location'} (${describeAccuracy(res.fix?.accuracy).toLowerCase()})`);
  };

  const useTyped = async () => {
    const q = text.trim();
    if (q.length < 3) return;
    setSearching(true);
    setError(undefined);
    const hit = await geocodeAddress(q);
    setSearching(false);
    setManualAddress(q, hit?.short, hit ? { lat: hit.lat, lng: hit.lng } : null);
    if (!hit) toast.show("Saved. We couldn't pin it on the map, so distances are approximate.", 'warning');
    finish(hit?.short ?? q.split(',')[0]);
  };

  const usePlace = async (label: string, address: string, coords?: { lat: number; lng: number }) => {
    let c = coords;
    if (!c) {
      const hit = await geocodeAddress(address);
      if (hit) c = { lat: hit.lat, lng: hit.lng };
    }
    setManualAddress(address, label, c ?? null);
    finish(label);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Where do you need the service?" scroll>
      <Button testID="use-gps" label={locating ? 'Getting an accurate fix…' : 'Use my current location'} icon="locate" variant="brand" onPress={useGps} loading={locating} />
      {error ? <Text style={[type.caption, { color: C.dangerDark }]}>{error}</Text> : null}
      <Field
        value={text}
        onChangeText={setText}
        placeholder="Flat / house no., street, area, city"
        returnKeyType="search"
        onSubmitEditing={useTyped}
      />
      {text.trim().length > 2 && <Button label="Use this address" variant="secondary" onPress={useTyped} loading={searching} />}
      {savedPlaces.length > 0 && (
        <View>
          {savedPlaces.map(p => (
            <ListRow
              key={p.id}
              icon={(p.icon as any) || 'location-outline'}
              title={p.label}
              subtitle={p.address}
              onPress={() => usePlace(p.label, p.address, p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : undefined)}
            />
          ))}
          <Divider />
        </View>
      )}
      <View>
        {locationPresets.map(loc => (
          <ListRow key={loc.name} icon="location-outline" title={loc.name} subtitle={loc.area} onPress={() => usePlace(loc.name, `${loc.name}, ${loc.area}`, { lat: loc.lat, lng: loc.lng })} />
        ))}
      </View>
    </Sheet>
  );
}
