# VELORA

VELORA — marketplace multi-seller dengan toko pribadi, pembayaran nyata,
wallet/ledger dan struktur payout.

## Mode payment

Project ini sekarang disiapkan untuk **LIVE payment provider**, bukan sandbox.
Provider konkret yang digunakan sebagai target integrasi adalah **Xendit xenPlatform**.

Xendit xenPlatform mendukung platform multi-merchant: sub-account merchant,
routing/split payment, dan transfer antar balance dalam ekosistem platform.
Setiap seller tetap harus melalui onboarding/verifikasi provider sebelum
menerima settlement live.

### Yang harus disiapkan sebelum live

1. Akun bisnis/provider yang sudah disetujui.
2. Aktivasi fitur platform/multi-merchant yang diperlukan.
3. Seller/sub-account yang sudah diverifikasi.
4. Secret API key production.
5. Webhook/callback token.
6. Domain HTTPS untuk webhook.
7. Aturan split/fee yang benar.
8. Review legal, KYC/AML, refund, chargeback, dan settlement.

**Jangan masukkan API secret ke frontend dan jangan kirim secret ke chat.**

### Payment flow

Customer -> VELORA backend -> Xendit -> customer membayar ->
Xendit webhook -> VELORA memverifikasi webhook ->
order PAID -> ledger seller -> settlement/payout.

Harga dan seller ID selalu diambil dari database server, bukan dipercaya dari
browser.

### Database

PostgreSQL menyimpan:
- users
- sessions
- stores
- products
- orders
- payments
- payment_events
- wallets
- wallet_transactions
- payouts
- audit_logs
- analytics

### Menjalankan

```bash
npm install
cp .env.example .env
# isi credential production di .env
# jalankan database/schema.sql
npm start
```

Untuk production gunakan HTTPS, reverse proxy, backup PostgreSQL,
monitoring, secret manager, rate limiting, log management, dan audit keamanan.

## Penting

Kode ini adalah fondasi integrasi. "Tidak sandbox" tidak berarti otomatis
bisa menerima uang hanya dengan menjalankan ZIP: provider harus mengaktifkan
akun live dan kredensial production yang sah. Tanpa itu, aplikasi tidak boleh
memalsukan pembayaran atau saldo.
