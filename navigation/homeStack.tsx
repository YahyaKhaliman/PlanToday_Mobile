import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/Home/homeScreen';
import CalonCustomerScreen from '../screens/Home/calonCustomerScreen';
import VisitPlanScreen from '../screens/Home/visitPlanScreen';
import CariCustomerScreen from '../screens/Home/cariCustomer';
import VisitScreen from '../screens/Home/visitScreen';
import RekapVisitScreen from '../screens/Home/rekapVisitScreen';
import RekapVisitPlanScreen from '../screens/Home/rekapVisitScreen';
import RekapVisitPlanDetailScreen from '../screens/Home/rekapVisitPlanDetailScreen';
import RekapCalonCustomerScreen from '../screens/Home/rekapCalonCustomerScreen';
import GantiPasswordScreen from '../screens/Home/gantiPasswordScreen';

const Stack = createNativeStackNavigator();

export default function HomeStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="CalonCustomer" component={CalonCustomerScreen} />
        <Stack.Screen name="VisitPlan" component={VisitPlanScreen} />
        <Stack.Screen name="CariCustomer" component={CariCustomerScreen} />
        <Stack.Screen name="Visit" component={VisitScreen} />
        <Stack.Screen name="RekapVisit" component={RekapVisitScreen} />
        <Stack.Screen name="RekapVisitPlan" component={RekapVisitPlanScreen} />
        <Stack.Screen name="RekapVisitPlanDetail" component={RekapVisitPlanDetailScreen} />
        <Stack.Screen name="RekapCalonCustomer" component={RekapCalonCustomerScreen} />
        <Stack.Screen name="GantiPassword" component={GantiPasswordScreen} />
        </Stack.Navigator>
    );
}
