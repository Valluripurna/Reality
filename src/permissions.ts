import * as ImagePicker from 'expo-image-picker';
import { DEFAULT_COORDS, getAccurateLocation } from './location';

export { DEFAULT_COORDS } from './location';

export type Coords = { lat: number; lng: number; precise: boolean; accuracy?: number | null };

/**
 * Current position for places that must always show *something* (e.g. the
 * SOS sheet). `precise: false` means it is the map fallback, not the user.
 */
export async function getCurrentCoords(): Promise<Coords> {
  const res = await getAccurateLocation({ targetAccuracy: 30, maxWaitMs: 10000 });
  return res.ok
    ? { lat: res.fix.lat, lng: res.fix.lng, precise: true, accuracy: res.fix.accuracy }
    : { ...DEFAULT_COORDS, precise: false };
}

/** Opens the photo library. Returns the picked uri or undefined. */
export async function pickImage(opts: { square?: boolean } = {}): Promise<string | undefined> {
  try {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: !!opts.square,
      aspect: opts.square ? [1, 1] : undefined,
      quality: 0.7
    });
    return !res.canceled ? res.assets[0]?.uri : undefined;
  } catch {
    return undefined;
  }
}

/** Opens the camera, falling back to the library where there is no camera (web, simulators). */
export async function capturePhoto(): Promise<string | undefined> {
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return pickImage();
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    return !res.canceled ? res.assets[0]?.uri : undefined;
  } catch {
    return pickImage();
  }
}
