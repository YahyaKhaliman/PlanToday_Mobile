import DeviceInfo from 'react-native-device-info';

export const getDeviceId = () => {
    return DeviceInfo.getAndroidId();
};

export const getAppVersion = () => {
    return DeviceInfo.getVersion();
};
