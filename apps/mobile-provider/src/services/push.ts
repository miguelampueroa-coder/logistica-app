import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from './api';

// Requiere credenciales Firebase reales (google-services.json / EAS project id)
// para push nativo en build standalone; en Expo Go usa el servicio de push de
// Expo, que no las necesita. El backend solo guarda el token (fcm_tokens),
// agnóstico de cuál de los dos lo generó.

export function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export async function registerForPushNotifications(authToken: string): Promise<void> {
  if (!Device.isDevice) return;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  const { data: pushToken } = await Notifications.getExpoPushTokenAsync();

  await api.push.register(
    { token: pushToken, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
    authToken
  );
}
