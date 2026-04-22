# PlanToday CI/CD (GitHub Actions + VPS, HTTP)

Dokumen ini adalah checklist operasional untuk rilis APK otomatis ke VPS tanpa Expo dan tanpa Google Play Console.

## 1. Alur rilis

1. Developer merge ke branch `main`.
2. GitHub Actions build APK release.
3. Workflow generate `latest.json`.
4. Workflow upload APK + `latest.json` ke VPS.
5. Workflow cleanup APK lama dan menyisakan 2 versi terbaru.
6. Aplikasi membaca `latest.json` lalu menawarkan update.

## 2. Persiapan VPS

1. Sediakan folder static file, contoh: `/var/www/plantoday/releases`.
2. Pastikan file di folder tersebut bisa diakses dari URL publik.
3. Pastikan firewall mengizinkan traffic ke port yang digunakan (sementara HTTP).
4. Buat user khusus deploy (jangan root langsung), lalu berikan izin tulis ke folder releases.

Contoh command di VPS:

```bash
sudo mkdir -p /var/www/plantoday/releases
sudo chown -R deploy:deploy /var/www/plantoday
sudo chmod -R 755 /var/www/plantoday
```

## 3. Persiapan GitHub Secrets

Isi secrets berikut di repository GitHub PlanToday:

1. `ANDROID_KEYSTORE_BASE64`
2. `ANDROID_KEYSTORE_PASSWORD`
3. `ANDROID_KEY_ALIAS`
4. `ANDROID_KEY_PASSWORD`
5. `VPS_HOST`
6. `VPS_USER`
7. `VPS_SSH_KEY`
8. `VPS_TARGET_PATH` (contoh: `/var/www/plantoday`)
9. `VPS_BASE_DOWNLOAD_URL` (contoh: `http://103.94.238.252/releases`)

## 4. Persiapan Android signing

Workflow ini membutuhkan keystore release.

1. Simpan keystore sebagai file `.jks`.
2. Encode keystore ke base64.
3. Isi hasil base64 ke secret `ANDROID_KEYSTORE_BASE64`.
4. Isi password dan alias ke secret lain yang sesuai.

Contoh encode base64 (Linux/macOS):

```bash
base64 -i upload-keystore.jks | tr -d '\n'
```

Contoh encode base64 (PowerShell):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("upload-keystore.jks"))
```

## 5. Lokasi file yang dipakai

1. Workflow: `.github/workflows/android-release-vps.yml`
2. Template manifest: `deploy/latest.template.json`
3. Update checker app: `services/appUpdate.ts`

## 6. Retensi file APK

Kebijakan default workflow:

1. Simpan 2 APK terbaru.
2. Hapus APK yang lebih lama secara otomatis.
3. `latest.json` selalu menunjuk APK terbaru.

## 7. Checklist release tim

1. Pastikan perubahan sudah lolos testing internal.
2. Naikkan `versionCode` dan `versionName` di `android/app/build.gradle` sebelum merge.
3. Merge PR ke `main`.
4. Pantau workflow sampai status sukses.
5. Verifikasi URL `latest.json` di VPS ter-update.
6. Cek aplikasi menerima notifikasi update.
7. Jika ada issue, rollback dengan mengganti isi `latest.json` ke APK sebelumnya.

## 8. Validasi end-to-end pertama

1. Isi semua secrets repository di GitHub.
2. Pastikan file APK dan `latest.json` dapat diakses publik dari VPS.
3. Jalankan workflow `Android Release to VPS` secara manual dari tab Actions.
4. Setelah sukses, buka URL `latest.json` dari browser dan cek isi `versionCode`, `versionName`, dan `apkUrl`.
5. Install aplikasi dengan versi lebih lama di device Android.
6. Buka aplikasi dan pastikan prompt `Update tersedia` muncul.
7. Tekan `Update` dan pastikan browser atau downloader membuka URL APK.

## 9. Rollback cepat

1. Login ke VPS.
2. Ubah file `latest.json` agar menunjuk APK cadangan.
3. Simpan perubahan.
4. Ulangi cek update di aplikasi.

## 10. Catatan keamanan selama masih HTTP

1. Gunakan hanya untuk internal/distribusi terbatas.
2. Hindari pengiriman data sensitif lewat endpoint non-HTTPS.
3. Batasi akses server dengan firewall/IP allowlist jika memungkinkan.
4. Rencanakan migrasi HTTPS secepatnya saat domain siap.

## 11. Langkah isi secrets GitHub

1. Buka repository di GitHub.
2. Masuk ke `Settings > Secrets and variables > Actions`.
3. Tambahkan seluruh secret yang dibutuhkan workflow.
4. Untuk `VPS_SSH_KEY`, isi private key deploy user di VPS.
5. Untuk `ANDROID_KEYSTORE_BASE64`, encode file `.jks` ke base64 lalu paste hasilnya tanpa line break.
6. Panduan detail tiap secret ada di `docs/github-secrets-setup.md`.
