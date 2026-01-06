import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/Home/homeScreen';
import TambahCalonCustomerScreen from '../screens/Home/tambahCalonCustomerScreen';
import RekapCalonCustomerScreen from '../screens/Home/calonCustomerScreen';
import VisitPlanScreen from '../screens/Home/visitPlanScreen';
import CariCustomerScreen from '../screens/Home/cariCustomer';
import VisitScreen from '../screens/Home/visitScreen';
import TambahVisitScreen from '../screens/Home/tambahVisitScreen';
import TambahVisitPlanScreen from '../screens/Home/tambahVisitPlanScreen';
import RekapVisitPlanDetailScreen from '../screens/Home/rekapVisitPlanDetailScreen';
import GantiPasswordScreen from '../screens/Home/gantiPasswordScreen';
import EditVisitPlanScreen from '../screens/Home/editVisitPlanScreen';
import EditVisitScreen from '../screens/Home/editVisitScreen';
import EditCalonCustomerScreen from '../screens/Home/editCalonCustomerScreen'

const Stack = createNativeStackNavigator();

export default function HomeStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="CalonCustomer" component={TambahCalonCustomerScreen} />
        <Stack.Screen name="EditCalonCustomer" component={EditCalonCustomerScreen} />
        <Stack.Screen name="VisitPlan" component={VisitPlanScreen} />
        <Stack.Screen name="CariCustomer" component={CariCustomerScreen} />
        <Stack.Screen name="Visit" component={VisitScreen} />
        <Stack.Screen name="TambahVisit" component={TambahVisitScreen} />
        <Stack.Screen name="EditVisit" component={EditVisitScreen} />
        <Stack.Screen name="TambahVisitPlan" component={TambahVisitPlanScreen} />
        <Stack.Screen name="EditVisitPlan" component={EditVisitPlanScreen} />
        <Stack.Screen name="RekapVisitPlanDetail" component={RekapVisitPlanDetailScreen} />
        <Stack.Screen name="RekapCalonCustomer" component={RekapCalonCustomerScreen} />
        <Stack.Screen name="GantiPassword" component={GantiPasswordScreen} />
        </Stack.Navigator>
    );
}
