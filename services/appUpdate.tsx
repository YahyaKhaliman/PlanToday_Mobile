import DeviceInfo from 'react-native-device-info';
import { Linking, Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

const UPDATE_MANIFEST_URL = 'http://103.94.238.252:8182/releases/latest.json';
const UPDATE_FETCH_TIMEOUT_MS = 15000;
const MIN_VALID_APK_BYTES = 5 * 1024 * 1024; // Minimal 5 MB untuk file APK React Native

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
  | { status: 'installed-intent-opened' }
  | { status: 'opened-download-location' }
  | { status: 'downloaded-no-installer' }
  | { status: 'failed-network' }
  | { status: 'failed-incomplete' }
  | { status: 'failed-other' };

const toNumber = (value: string | number | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildManifestRequestUrl = () => {
  const separator = UPDATE_MANIFEST_URL.includes('?') ? '&' : '?';
  return `${UPDATE_MANIFEST_URL}${separator}t=${Date.now()}`;
};

export const getApkFilePaths = (manifest: AppUpdateManifest) => {
  const rawFileName =
    manifest.apkUrl.split('/').pop() || `PlanToday-v${manifest.versionName}.apk`;
  const cleanFileName = rawFileName.includes('.apk')
    ? rawFileName
    : `PlanToday-v${manifest.versionName}.apk`;

  const downloadDir =
    ReactNativeBlobUtil.fs.dirs.DownloadDir ||
    ReactNativeBlobUtil.fs.dirs.DocumentDir;

  const finalPath = `${downloadDir}/${cleanFileName}`;
  const tempPath = `${downloadDir}/${cleanFileName}.tmp`;

  return { cleanFileName, finalPath, tempPath };
};

/**
 * Memvalidasi apakah file APK ada, utuh, dan tidak korup.
 * - Ukuran file harus memenuhi syarat minimum (> 5MB).
 * - Jika hash SHA256 disediakan manifest, verifikasi hash file.
 * - Jika file rusak/setengah unduh, file akan otomatis dihapus.
 */
export const isApkFileValid = async (
  filePath: string,
  expectedSha256?: string,
): Promise<boolean> => {
  if (Platform.OS !== 'android' || !filePath) {
    return false;
  }

  try {
    const exists = await ReactNativeBlobUtil.fs.exists(filePath);
    if (!exists) {
      return false;
    }

    const stat = await ReactNativeBlobUtil.fs.stat(filePath);
    const size = Number(stat?.size || 0);

    if (size < MIN_VALID_APK_BYTES) {
      console.warn('[AppUpdate] File APK tidak komplit/terlalu kecil', {
        filePath,
        size,
        minRequired: MIN_VALID_APK_BYTES,
      });
      try {
        await ReactNativeBlobUtil.fs.unlink(filePath);
      } catch {}
      return false;
    }

    if (expectedSha256 && typeof expectedSha256 === 'string' && expectedSha256.trim()) {
      try {
        const fileHash = await ReactNativeBlobUtil.fs.hash(filePath, 'sha256');
        const isMatch =
          String(fileHash).trim().toLowerCase() ===
          String(expectedSha256).trim().toLowerCase();

        if (!isMatch) {
          console.warn('[AppUpdate] SHA-256 Hash tidak cocok (File korup/berbeda)', {
            calculated: fileHash,
            expected: expectedSha256,
          });
          try {
            await ReactNativeBlobUtil.fs.unlink(filePath);
          } catch {}
          return false;
        }
      } catch (hashErr) {
        console.warn('[AppUpdate] Gagal menghitung hash APK', hashErr);
      }
    }

    return true;
  } catch (err) {
    console.warn('[AppUpdate] Gagal validasi APK', err);
    return false;
  }
};

/**
 * Mengecek apakah APK versi target sudah pernah terunduh secara komplit & valid sebelumnya di penyimpanan.
 */
export const getValidExistingApk = async (
  manifest: AppUpdateManifest,
): Promise<string | null> => {
  if (Platform.OS !== 'android') return null;
  const { finalPath } = getApkFilePaths(manifest);
  const isValid = await isApkFileValid(finalPath, manifest.sha256);
  return isValid ? finalPath : null;
};

/**
 * Menjalankan Package Installer sistem Android secara otomatis untuk menginstal APK.
 */
export const installDownloadedApk = async (
  apkFilePath: string,
): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    console.info('[AppUpdate] Membuka Android Package Installer', { apkFilePath });
    await ReactNativeBlobUtil.android.actionViewIntent(
      apkFilePath,
      'application/vnd.android.package-archive',
    );
    return true;
  } catch (intentErr) {
    console.warn('[AppUpdate] actionViewIntent gagal, mencoba fallback VIEW_DOWNLOADS', intentErr);
    try {
      await Linking.sendIntent('android.intent.action.VIEW_DOWNLOADS');
      return true;
    } catch {
      return false;
    }
  }
};

const fetchLatestManifest = async (): Promise<{
  manifest: Partial<AppUpdateManifest> | null;
  failed: boolean;
}> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPDATE_FETCH_TIMEOUT_MS);

  try {
    const requestUrl = buildManifestRequestUrl();
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.info('[AppUpdate] Manifest request failed', {
        status: response.status,
        statusText: response.statusText,
      });
      return { manifest: null, failed: true };
    }

    const manifest = (await response.json()) as Partial<AppUpdateManifest>;
    console.info('[AppUpdate] Manifest fetched', {
      versionCode: manifest?.versionCode,
      versionName: manifest?.versionName,
      mandatory: manifest?.mandatory,
    });

    return { manifest, failed: false };
  } catch (error: any) {
    const message = String(error?.message || 'Unknown error');
    console.info('[AppUpdate] Manifest request exception', { message });
    return { manifest: null, failed: true };
  } finally {
    clearTimeout(timeout);
  }
};

export const checkAppUpdate = async (): Promise<AppUpdateManifest | null> => {
  try {
    const { manifest, failed } = await fetchLatestManifest();
    if (failed || !manifest) {
      return null;
    }

    const latestVersionCode = toNumber(manifest.versionCode);
    const currentVersionCode = toNumber(DeviceInfo.getBuildNumber());

    console.info('[AppUpdate] Comparing version', {
      currentVersionCode,
      latestVersionCode,
    });

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
      const { manifest, failed } = await fetchLatestManifest();
      if (failed || !manifest) {
        return { manifest: null, failed: true };
      }

      const latestVersionCode = toNumber(manifest.versionCode);
      const currentVersionCode = toNumber(DeviceInfo.getBuildNumber());

      console.info('[AppUpdate] Comparing version (status)', {
        currentVersionCode,
        latestVersionCode,
      });

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

/**
 * Mengunduh APK dengan sistem pengaman:
 * 1. Simpan ke file temporary (.tmp) terlebih dahulu.
 * 2. Lakukan validasi ukuran dan integritas file saat selesai.
 * 3. Jika valid, rename ke file final .apk dan langsung trigger Package Installer otomatis.
 * 4. Jika gagal/terputus di tengah jalan, bersihkan file .tmp agar tidak korup.
 */
export const downloadUpdateApk = async (
  manifest: AppUpdateManifest,
  onProgress?: (percent: number) => void,
): Promise<DownloadUpdateResult> => {
  if (Platform.OS !== 'android') {
    return { status: 'failed-other' };
  }

  const { finalPath, tempPath } = getApkFilePaths(manifest);

  try {
    // 1. Cek apakah sudah ada file final yang valid sebelumnya
    const isAlreadyValid = await isApkFileValid(finalPath, manifest.sha256);
    if (isAlreadyValid) {
      console.info('[AppUpdate] File APK sudah komplit tersedia di penyimpanan, langsung install');
      onProgress?.(100);
      const opened = await installDownloadedApk(finalPath);
      return { status: opened ? 'installed-intent-opened' : 'downloaded-no-installer' };
    }

    // 2. Bersihkan file temp lama jika ada sisa unduhan yang macet
    try {
      const tempExists = await ReactNativeBlobUtil.fs.exists(tempPath);
      if (tempExists) {
        await ReactNativeBlobUtil.fs.unlink(tempPath);
      }
    } catch {}

    console.info('[AppUpdate] Memulai download APK ke temporary file', {
      versionName: manifest.versionName,
      versionCode: manifest.versionCode,
      tempPath,
    });
    onProgress?.(0);

    const task = ReactNativeBlobUtil.config({
      fileCache: true,
      path: tempPath,
    }).fetch('GET', manifest.apkUrl);

    task.progress({ interval: 150 }, (received, total) => {
      if (!total || total <= 0) {
        return;
      }

      const percent = Math.min(
        99,
        Math.max(0, Math.round((received / total) * 100)),
      );
      onProgress?.(percent);
    });

    const response = await task;
    const downloadedTempPath =
      typeof response?.path === 'function' ? response.path() : tempPath;

    // 3. Verifikasi integritas file yang baru diunduh
    const isValid = await isApkFileValid(downloadedTempPath, manifest.sha256);
    if (!isValid) {
      console.error('[AppUpdate] File hasil download tidak valid / belum komplit');
      try {
        await ReactNativeBlobUtil.fs.unlink(downloadedTempPath);
      } catch {}
      return { status: 'failed-incomplete' };
    }

    onProgress?.(100);

    // 4. Rename dari .tmp ke file final .apk
    try {
      const finalExists = await ReactNativeBlobUtil.fs.exists(finalPath);
      if (finalExists) {
        await ReactNativeBlobUtil.fs.unlink(finalPath);
      }
      await ReactNativeBlobUtil.fs.mv(downloadedTempPath, finalPath);
    } catch (mvErr) {
      console.warn('[AppUpdate] Gagal rename file, menggunakan file download langsung', mvErr);
    }

    const installPath = (await ReactNativeBlobUtil.fs.exists(finalPath))
      ? finalPath
      : downloadedTempPath;

    console.info('[AppUpdate] Download selesai & diverifikasi, meluncurkan installer', { installPath });
    const openedInstaller = await installDownloadedApk(installPath);

    if (openedInstaller) {
      return { status: 'installed-intent-opened' };
    }

    return { status: 'downloaded-no-installer' };
  } catch (error: any) {
    // Bersihkan file temp jika download gagal di tengah jalan
    try {
      const tempExists = await ReactNativeBlobUtil.fs.exists(tempPath);
      if (tempExists) {
        await ReactNativeBlobUtil.fs.unlink(tempPath);
      }
    } catch {}

    const message = String(error?.message || '').toLowerCase();
    const isNetworkError =
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('unable to resolve host') ||
      message.includes('failed to connect') ||
      message.includes('connection');

    console.info('[AppUpdate] Download failed', {
      message: String(error?.message || 'Unknown error'),
      isNetworkError,
    });

    return { status: isNetworkError ? 'failed-network' : 'failed-other' };
  }
};
