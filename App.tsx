import React, { useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import { AuthProvider } from './context/authContext';
import AppNavigator from './navigation/appNavigator';
import Toast from 'react-native-toast-message';
import { toastConfig } from './components/toastCustomComponent';
import { checkAppUpdate } from './services/appUpdate';

export default function App() {
  useEffect(() => {
    const runUpdateCheck = async () => {
      const update = await checkAppUpdate();

      if (!update || !update.apkUrl) {
        return;
      }

      const buttons = update.mandatory
        ? [
            {
              text: 'Update',
              onPress: () => Linking.openURL(update.apkUrl),
            },
          ]
        : [
            { text: 'Nanti' },
            {
              text: 'Update',
              onPress: () => Linking.openURL(update.apkUrl),
            },
          ];

      Alert.alert(
        'Update tersedia',
        `Versi ${update.versionName} tersedia.${
          update.notes ? `\n\n${update.notes}` : ''
        }`,
        buttons,
        { cancelable: !update.mandatory },
      );
    };

    runUpdateCheck();
  }, []);

  return (
    <AuthProvider>
      <AppNavigator />
      <Toast config={toastConfig} />
    </AuthProvider>
  );
}
