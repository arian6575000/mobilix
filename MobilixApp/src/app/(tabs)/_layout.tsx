import React from 'react';
import { Pressable, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../ctx/AppContext';
import { LinearGradient } from 'expo-linear-gradient';
import { C, FONT, GRAD, FONT_UR_BOLD } from '../../lib/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Raised centre button: Scan is the fastest way to sell, find or count a product. */
function ScanButton({ onPress }: { onPress?: (e: any) => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Pressable onPress={onPress} style={({ pressed }) => ({ marginTop: -24, opacity: pressed ? 0.9 : 1, borderRadius: 30, borderWidth: 5, borderColor: C.card, elevation: 6, shadowColor: '#3A1FC4', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } })}>
        <LinearGradient colors={GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="qr-code-outline" size={25} color="#fff" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const { t, rtl } = useApp();
  const insets = useSafeAreaInsets();
  const icon = (on: IconName, off: IconName) => ({ color, focused }: { color: any; focused: boolean }) => <Ionicons name={focused ? on : off} size={22} color={color} />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.faint,
        tabBarLabelStyle: rtl ? { fontFamily: FONT_UR_BOLD, fontSize: 11, lineHeight: 22 } : { fontFamily: FONT.medium, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: C.card, borderTopWidth: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, elevation: 12, shadowColor: '#3A1FC4', shadowOpacity: 0.1, shadowRadius: 12,
          height: 58 + insets.bottom, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 6), flexDirection: rtl ? 'row-reverse' : 'row',
        },
      }}>
      <Tabs.Screen name="index" options={{ title: t('navHome'), tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="stock" options={{ title: t('navStock'), tabBarIcon: icon('phone-portrait', 'phone-portrait-outline') }} />
      <Tabs.Screen name="scan" options={{ title: '', tabBarButton: (p) => <ScanButton onPress={p.onPress as any} /> }} />
      <Tabs.Screen name="sales" options={{ title: t('navSales'), tabBarIcon: icon('receipt', 'receipt-outline') }} />
      <Tabs.Screen name="more" options={{ title: t('navMore'), tabBarIcon: icon('grid', 'grid-outline') }} />
    </Tabs>
  );
}
