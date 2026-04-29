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

export type AppUpdateCheckResult = {
  manifest: AppUpdateManifest | null;
  failed: boolean;
};

export type DownloadUpdateResult =
  | { status: 'opened-installer' }
  | { status: 'downloaded-no-installer' }
  | { status: 'failed-network' }
  | { status: 'failed-other' };

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

export const checkAppUpdateWithStatus =
  async (): Promise<AppUpdateCheckResult> => {
    try {
      const response = await fetch(UPDATE_MANIFEST_URL, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return { manifest: null, failed: true };
      }

      const manifest = (await response.json()) as Partial<AppUpdateManifest>;
      const latestVersionCode = toNumber(manifest.versionCode);
      const currentVersionCode = toNumber(DeviceInfo.getBuildNumber());

      if (!latestVersionCode || latestVersionCode <= currentVersionCode) {
        return { manifest: null, failed: false };
      }

      if (!manifest.apkUrl || !manifest.versionName) {
        return { manifest: null, failed: true };
      }

      return {
        manifest: {
          versionCode: latestVersionCode,
          versionName: manifest.versionName,
          mandatory: Boolean(manifest.mandatory),
          apkUrl: manifest.apkUrl,
          sha256: manifest.sha256,
          releaseDate: manifest.releaseDate,
          notes: manifest.notes,
        },
        failed: false,
      };
    } catch {
      return { manifest: null, failed: true };
    }
  };

export const downloadUpdateApk = async (
  manifest: AppUpdateManifest,
  onProgress?: (percent: number) => void,
): Promise<DownloadUpdateResult> => {
  if (Platform.OS !== 'android') {
    return { status: 'failed-other' };
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

      const percent = Math.min(
        100,
        Math.max(0, Math.round((received / total) * 100)),
      );
      onProgress?.(percent);
    });

    const response = await task;
    onProgress?.(100);

    const downloadedPath =
      typeof response?.path === 'function' ? response.path() : '';

    if (downloadedPath) {
      try {
        await ReactNativeBlobUtil.android.actionViewIntent(
          downloadedPath,
          'application/vnd.android.package-archive',
        );
        return { status: 'opened-installer' };
      } catch {
        return { status: 'downloaded-no-installer' };
      }
    }

    // Download manager may finish without a resolvable path on some devices.
    return { status: 'downloaded-no-installer' };
  } catch (error: any) {
    const message = String(error?.message || '').toLowerCase();
    const isNetworkError =
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('unable to resolve host') ||
      message.includes('failed to connect') ||
      message.includes('connection');

    return { status: isNetworkError ? 'failed-network' : 'failed-other' };
  }
};
