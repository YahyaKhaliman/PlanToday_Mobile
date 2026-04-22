import DeviceInfo from 'react-native-device-info';

const UPDATE_MANIFEST_URL = 'http://103.94.238.252/releases/latest.json';

type AppUpdateManifest = {
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