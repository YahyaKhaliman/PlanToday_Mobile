import React from 'react';
import { AuthProvider } from './context/authContext';
import AppNavigator from './navigation/appNavigator';
import Toast from 'react-native-toast-message';
import { toastConfig } from './components/toastCustomComponent';

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
      <Toast config={toastConfig} />
    </AuthProvider>
  );
}