import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/authContext';

import LoginScreen from '../screens/Login/loginScreen';
import HomeScreen from '../screens/Home/homeScreen';
import RegisterScreen from '../screens/Register/registerScreen';
import CalonCustomerScreen from '../screens/Home/calonCustomerScreen';
import VisitPlanScreen from '../screens/Home/visitPlanScreen';
import CariCustomerScreen from '../screens/Home/cariCustomer';
import VisitScreen from '../screens/Home/visitScreen';
import RekapVisitScreen from '../screens/Home/rekapVisitScreen';
import RekapVisitPlanScreen from '../screens/Home/rekapVisitPlanScreen';
import RekapVisitPlanDetailScreen from '../screens/Home/rekapVisitPlanDetailScreen';
import RekapCalonCustomerScreen from '../screens/Home/rekapCalonCustomerScreen';
import GantiPasswordScreen from '../screens/Home/gantiPasswordScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
    const { user } = useAuth();

    return (
        <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {user ? (
            <>
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
            </>
            ) : (
            <>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />
            </>
            )}
        </Stack.Navigator>
        </NavigationContainer>
    );
}
