import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/authContext';

import LoginScreen from '../screens/Login/loginScreen';
import HomeScreen from '../screens/Home/homeScreen';
import RegisterScreen from '../screens/Register/registerScreen';
import RekapCalonCustomerScreen from '../screens/Home/calonCustomerScreen';
import TambahCalonCustomerScreen from '../screens/Home/tambahCalonCustomerScreen';
import EditCalonCustomerScreen from '../screens/Home/editCalonCustomerScreen';
import VisitPlanScreen from '../screens/Home/visitPlanScreen';
import CariCustomerScreen from '../screens/Home/cariCustomer';
import VisitScreen from '../screens/Home/visitScreen';
import TambahVisitScreen from '../screens/Home/tambahVisitScreen';
import TambahVisitPlanScreen from '../screens/Home/tambahVisitPlanScreen';
import RekapVisitPlanDetailScreen from '../screens/Home/rekapVisitPlanDetailScreen';
import GantiPasswordScreen from '../screens/Home/gantiPasswordScreen';
import EditVisitPlanScreen from '../screens/Home/editVisitPlanScreen';
import EditVisitScreen from '../screens/Home/editVisitScreen';
import AchievementScreen from '../screens/Achievement/achievementScreen';
import AchievementDetailUserRangeScreen from '../screens/Achievement/achievementDetailUserScreen'

const Stack = createNativeStackNavigator();

export type RootStackParamList = {
    AchievementOmset: undefined;
    AchievementDetailUserRange: {
        kode: string;
        nama: string;
        jabatan: string;
        fromYear: number;
        fromMonth: number;
        toYear: number;
        toMonth: number;
        target?: number;
        realisasi?: number;
    };
};

export default function AppNavigator() {
    const { user } = useAuth();

    return (
        <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {user ? (
            <>
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
                <Stack.Screen name="Achievement" component={AchievementScreen} />
                <Stack.Screen name="AchievementDetailUserRange" component={AchievementDetailUserRangeScreen} />
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
