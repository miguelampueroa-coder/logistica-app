import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';

// Auth screens
import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';

// Main screens
import AvailableScreen from '../screens/Home/AvailableScreen';
import ShipmentDetailScreen from '../screens/Home/ShipmentDetailScreen';
import ActiveScreen from '../screens/Active/ActiveScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import VehiclesScreen from '../screens/Profile/VehiclesScreen';
import EarningsScreen from '../screens/Profile/EarningsScreen';
import HistoryScreen from '../screens/History/HistoryScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const linking: LinkingOptions<any> = {
  prefixes: ['enviazo://', 'https://enviazo.app/'],
  config: {
    screens: {
      Disponibles: 'available',
      ShipmentDetail: 'shipments/:id',
      Activo: 'active',
      Historial: 'history',
      Perfil: 'profile',
      Vehicles: 'profile/vehicles',
      Earnings: 'profile/earnings',
    },
  },
};

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="AvailableList"
        component={AvailableScreen}
        options={{ title: 'Envíos Disponibles' }}
      />
      <Stack.Screen
        name="ShipmentDetail"
        component={ShipmentDetailScreen}
        options={{ title: 'Detalle del Envío' }}
      />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{ title: 'Mi Perfil' }}
      />
      <Stack.Screen
        name="Vehicles"
        component={VehiclesScreen}
        options={{ title: 'Mis Vehículos' }}
      />
      <Stack.Screen
        name="Earnings"
        component={EarningsScreen}
        options={{ title: 'Mis Ganancias' }}
      />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'list';

          if (route.name === 'Disponibles') {
            iconName = focused ? 'list' : 'list-outline';
          } else if (route.name === 'Activo') {
            iconName = focused ? 'car' : 'car-outline';
          } else if (route.name === 'Historial') {
            iconName = focused ? 'time' : 'time-outline';
          } else if (route.name === 'Perfil') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen
        name="Disponibles"
        component={HomeStack}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Activo"
        component={ActiveScreen}
        options={{ title: 'Envío Activo' }}
      />
      <Tab.Screen
        name="Historial"
        component={HistoryScreen}
        options={{ title: 'Historial' }}
      />
      <Tab.Screen
        name="Perfil"
        component={ProfileStack}
        options={{ headerShown: false }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  return (
    <NavigationContainer linking={user ? linking : undefined}>
      {user ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}
