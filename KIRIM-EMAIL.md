# Kirim PDF hasil quiz ke email pengunjung

Tombol **Unduh Hasil (PDF)** di layar hasil sudah jalan sekarang, tanpa setup apa pun.

Yang butuh setup adalah **pengiriman otomatis ke email pengunjung**. Selama belum
di-setup, bagian itu dilewati diam-diam: quiz tetap normal, data tetap masuk
Supabase, tombol unduh tetap berfungsi. Tidak ada error yang terlihat pengunjung.

Alurnya: browser membuat PDF-nya sendiri, lalu mengirimnya ke sebuah Edge Function
di Supabase, dan fungsi itu yang mengirim email. Kunci API email disimpan di
server, tidak pernah ada di halaman.

## 1. Daftar penyedia email

Kode ini memakai [Resend](https://resend.com) (gratis untuk volume kecil).

1. Daftar, lalu tambahkan domain Anda di menu **Domains**.
2. Pasang data DNS yang mereka minta (SPF/DKIM) di pengelola domain Anda.
   Tanpa ini email besar kemungkinan masuk spam.
3. Buat **API Key**, salin (formatnya `re_...`).

Alamat pengirim harus memakai domain yang sudah diverifikasi di atas.
`hasil@gohalal.com` bisa, `hasil@gmail.com` tidak.

## 2. Deploy Edge Function

Butuh [Supabase CLI](https://supabase.com/docs/guides/cli) di komputer Anda.

```bash
supabase login
supabase link --project-ref qqbqrlrfvbrynvdtrrhc

# simpan kredensial (jangan pernah masuk ke Git)
supabase secrets set RESEND_API_KEY=re_xxxxxxxx
supabase secrets set EMAIL_PENGIRIM="GoHalal <hasil@domainanda.com>"

supabase functions deploy kirim-hasil --no-verify-jwt
```

`--no-verify-jwt` memang disengaja: yang memanggil fungsi ini pengunjung anonim
dari halaman publik, bukan user yang login.

Setelah deploy, URL-nya:

```
https://qqbqrlrfvbrynvdtrrhc.supabase.co/functions/v1/kirim-hasil
```

## 3. Aktifkan di halaman

Di `index.html`, cari `KIRIM_HASIL_URL` dan isi dengan URL di atas:

```js
var KIRIM_HASIL_URL = 'https://qqbqrlrfvbrynvdtrrhc.supabase.co/functions/v1/kirim-hasil';
```

Commit dan push. Selesai.

## 4. Daftar domain yang boleh memanggil

Di `supabase/functions/kirim-hasil/index.ts` ada `ASAL_DIIZINKAN`. Isinya harus
mencakup domain tempat situs ini dibuka. Kalau nanti pakai domain sendiri,
tambahkan ke daftar itu lalu deploy ulang fungsinya.

Ini yang mencegah situs lain memakai fungsi (dan kuota email) Anda.

## Kalau email tidak sampai

Cek berurutan:

1. **Console browser** saat menyelesaikan quiz. Kalau ada `Kirim email gagal: 500`,
   berarti secret-nya belum ter-set. Kalau `502`, penyedia emailnya yang menolak.
2. **Log fungsi**: `supabase functions logs kirim-hasil`. Pesan error asli dari
   Resend ada di sini, sengaja tidak dikirim ke browser.
3. **Folder spam**, dan status domain di dashboard Resend.
4. Kalau di console tidak ada apa-apa sama sekali, `KIRIM_HASIL_URL` masih kosong.

## Batasan yang sudah dipasang

- PDF di atas 5MB ditolak.
- Alamat email divalidasi ulang di server, bukan cuma di browser.
- Teks dari form dipotong panjangnya sebelum masuk badan email.
- Pesan error dari penyedia email tidak diteruskan ke browser, hanya ke log.
