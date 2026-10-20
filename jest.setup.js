/* global jest */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// No backend in unit tests: everything runs against device-local storage.
delete process.env.EXPO_PUBLIC_API_URL;
delete process.env.EXPO_PUBLIC_AUTH_MODE;
