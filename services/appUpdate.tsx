import DeviceInfo from 'react-native-device-info';
import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

const UPDATE_MANIFEST_URL = 'http://103.94.238.252:8182/releases/latest.json';

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
  onProgress?: (percent: number) => void,
): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    onProgress?.(0);

    const fileName =
      manifest.apkUrl.split('/').pop() ||
      `PlanToday-v${manifest.versionName}.apk`;

    const task = ReactNativeBlobUtil.config({
      addAndroidDownloads: {
        useDownloadManager: true,
        notification: true,
        mediaScannable: true,
        title: fileName,
        description: `Mengunduh update ${manifest.versionName}`,
        mime: 'application/vnd.android.package-archive',
      },
    }).fetch('GET', manifest.apkUrl);

    task.progress({ interval: 150 }, (received, total) => {
      if (!total || total <= 0) {
        return;
      }

      const percent = Math.min(100, Math.max(0, Math.round((received / total) * 100)));
      onProgress?.(percent);
    });

    const response = await task;
    onProgress?.(100);

    const downloadedPath =
      typeof response?.path === 'function' ? response.path() : '';

    if (downloadedPath) {
      await ReactNativeBlobUtil.android.actionViewIntent(
        downloadedPath,
        'application/vnd.android.package-archive',
      );
      return true;
    }

    return false;
  } catch {
    return false;
  }
};