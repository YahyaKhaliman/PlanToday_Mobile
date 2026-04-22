import DeviceInfo from 'react-native-device-info';
import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

const UPDATE_MANIFEST_URL = 'http://103.94.238.252/releases/latest.json';

export type AppUpdateManifest = {
  versionCode: number;
  versionName: string;
  mandatory: boolean;
  apkUrl: string;
  sha256?: string;
  releaseDate?: string;
  notes?: string;
};

const toNumber = (value: string | number | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const checkAppUpdate = async (): Promise<AppUpdateManifest | null> => {
  try {
    const response = await fetch(UPDATE_MANIFEST_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const manifest = (await response.json()) as Partial<AppUpdateManifest>;
    const latestVersionCode = toNumber(manifest.versionCode);
    const currentVersionCode = toNumber(DeviceInfo.getBuildNumber());

    if (!latestVersionCode || latestVersionCode <= currentVersionCode) {
      return null;
    }

    if (!manifest.apkUrl || !manifest.versionName) {
      return null;
    }

    return {
      versionCode: latestVersionCode,
      versionName: manifest.versionName,
      mandatory: Boolean(manifest.mandatory),
      apkUrl: manifest.apkUrl,
      sha256: manifest.sha256,
      releaseDate: manifest.releaseDate,
      notes: manifest.notes,
    };
  } catch {
    return null;
  }
};

export const downloadUpdateApk = async (
  manifest: AppUpdateManifest,
): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    const fileName =
      manifest.apkUrl.split('/').pop() ||
      `PlanToday-v${manifest.versionName}.apk`;

    await ReactNativeBlobUtil.config({
      addAndroidDownloads: {
        useDownloadManager: true,
        notification: true,
        mediaScannable: true,
        title: fileName,
        description: `Mengunduh update ${manifest.versionName}`,
        mime: 'application/vnd.android.package-archive',
      },
    }).fetch('GET', manifest.apkUrl);

    return true;
  } catch {
    return false;
  }
};