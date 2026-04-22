# GitHub Secrets Setup PlanToday

Dokumen ini menjelaskan nilai yang harus diisi untuk setiap GitHub Actions secret yang dipakai workflow [android-release-vps.yml](../.github/workflows/android-release-vps.yml).

## 1. Buka halaman secrets repository

1. Buka repository PlanToday di GitHub.
2. Pilih `Settings`.
3. Pilih `Secrets and variables`.
4. Pilih `Actions`.
5. Klik `New repository secret` untuk menambahkan secret satu per satu.

## 2. Daftar secret yang wajib diisi

### `ANDROID_KEYSTORE_BASE64`

Isi dengan hasil encode base64 dari file keystore release Android Anda.

Contoh PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("D:\path\to\upload-keystore.jks"))
```

Catatan:

1. Copy hasil output penuh tanpa dipotong.
2. Jangan tambahkan spasi atau line break manual.

### `ANDROID_KEYSTORE_PASSWORD`

Isi dengan password keystore Android release.

### `ANDROID_KEY_ALIAS`

Isi dengan alias key di dalam keystore.

### `ANDROID_KEY_PASSWORD`

Isi dengan password key alias.

### `VPS_HOST`

Isi dengan IP atau hostname VPS.

Contoh:

```text
103.94.238.252
```

### `VPS_USER`

Isi dengan user deploy di VPS.

Contoh:

```text
deploy
```

### `VPS_SSH_KEY`

Isi dengan private key SSH milik user deploy yang dipakai GitHub Actions untuk upload file ke VPS.

Langkah membuat key di Windows PowerShell:

```powershell
ssh-keygen -t ed25519 -C "github-actions-plantoday" -f "$HOME\.ssh\plantoday_deploy"
```

Setelah itu:

1. File private key ada di `%USERPROFILE%\.ssh\plantoday_deploy`.
2. File public key ada di `%USERPROFILE%\.ssh\plantoday_deploy.pub`.
3. Copy isi file private key ke secret `VPS_SSH_KEY`.
4. Copy isi file public key ke VPS ke file `~/.ssh/authorized_keys` milik user deploy.

Contoh menambahkan public key di VPS:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "PASTE_PUBLIC_KEY_DI_SINI" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### `VPS_TARGET_PATH`

Isi dengan path root deploy di VPS.

Contoh:

```text
/var/www/plantoday
```

Workflow akan mengupload file ke folder:

```text
/var/www/plantoday/releases
```

### `VPS_BASE_DOWNLOAD_URL`

Isi dengan base URL tempat APK dan `latest.json` bisa diakses publik.

Contoh untuk kondisi Anda yang masih HTTP dan pakai IP:

```text
http://103.94.238.252/releases
```

## 3. Cara cek secret sudah benar

1. `VPS_HOST` bisa di-SSH dari komputer Anda.
2. `VPS_USER` punya hak tulis ke folder target.
3. `VPS_SSH_KEY` private key cocok dengan public key di VPS.
4. `VPS_BASE_DOWNLOAD_URL` jika dibuka di browser mengarah ke folder release yang memang diserve web server.
5. Keystore, alias, dan password cocok untuk build release Android.

## 4. Checklist cepat sebelum run workflow

1. Semua secret sudah dibuat di GitHub repository.
2. `android/app/build.gradle` sudah punya `versionCode` dan `versionName` yang benar.
3. Folder `/releases` di VPS bisa ditulis oleh user deploy.
4. URL `http://103.94.238.252/releases` benar-benar bisa diakses dari device tester.

## 5. Opsi pakai GitHub CLI

Kalau Anda punya `gh` CLI, secret juga bisa diisi lewat terminal.

Contoh:

```powershell
gh secret set VPS_HOST --body "103.94.238.252"
gh secret set VPS_USER --body "deploy"
gh secret set VPS_TARGET_PATH --body "/var/www/plantoday"
gh secret set VPS_BASE_DOWNLOAD_URL --body "http://103.94.238.252/releases"
gh secret set VPS_SSH_KEY < "$HOME\.ssh\plantoday_deploy"
```

Untuk `ANDROID_KEYSTORE_BASE64`, lebih aman generate dulu lalu paste nilainya:

```powershell
$keystoreBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes("D:\path\to\upload-keystore.jks"))
gh secret set ANDROID_KEYSTORE_BASE64 --body $keystoreBase64
```
