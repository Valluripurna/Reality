import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Alert } from 'react-native';

export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Location Access Required',
        'RealityChain requires location access to find nearby verified service pros within your 50km working area.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Location Permission Error:', err);
    return false;
  }
}

export async function requestStoragePermission(): Promise<boolean> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Storage Permission Required',
        'RealityChain requires storage & media library access to attach issue photos and upload Aadhaar ID documents.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Storage Permission Error:', err);
    return false;
  }
}
