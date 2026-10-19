# Website SOP Toko Komputer, Aksesori dan Servis

Website baca-dan-edit dokumen SOP, **bukan sistem penjualan, servis, ataupun stok dengan database**. Isi awal diambil dari `SOP_Toko_Komputer_Aksesoris_dan_Servis_v2.docx` (dokumen 26 halaman, versi tertulis 1.0), termasuk 18 SOP dan lima lampiran.

## Isi paket

- `index.html` — halaman utama
- `assets/style.css` — desain responsif
- `assets/app.js` — daftar isi, cari, mode edit, impor/ekspor, dan cetak
- `data/sop.js` — **data isi dokumen yang ditampilkan website**
- `referensi/SOP_Toko_Komputer_Aksesoris_dan_Servis_v2.docx` — file Word sumber
- `.nojekyll` — konfigurasi agar GitHub Pages menyajikan file statis apa adanya

## Cara hosting gratis di GitHub Pages

1. Masuk ke https://github.com dan login.
2. Klik **New repository**, pilih nama, misalnya `sop-toko-komputer`, dan tentukan visibilitas **Public** bila ingin GitHub Pages gratis dapat diakses umum.
3. Unggah **isi folder ZIP** ke akar/root repository (bukan ZIP-nya saja). Pastikan `index.html` langsung di root.
4. Buka **Settings → Pages → Build and deployment → Deploy from a branch**.
5. Pilih branch `main`, folder `/ (root)`, kemudian **Save**.
6. Tunggu GitHub memublikasikan halaman. Link biasanya `https://USERNAME.github.io/sop-toko-komputer/`.
7. Saat ada perubahan, commit ke repository; GitHub Pages akan menerbitkan perubahan terbaru.

**PENTING**: GitHub Pages hanya hosting file statis. Website ini tidak menggunakan PHP/MySQL.

## Cara membaca dan mengedit

- Gunakan daftar isi kiri untuk memilih SOP, atau **Lihat Semua Dokumen**.
- Gunakan kotak cari untuk mencari kata dalam SOP/tabel.
- Klik **Mode Edit** untuk menyunting bagian yang sedang ditampilkan, termasuk teks dan tabel.
- Tambah paragraf, poin, subjudul, tabel, atau bagian SOP baru dengan tombol di atas dokumen.
- Perubahan akan tersimpan di `localStorage` browser/perangkat ini. **Perubahan lokal belum mengubah situs bagi orang lain.**
- Klik **Unduh hasil edit** untuk mengunduh `sop.js`.
- Ganti `data/sop.js` di repository GitHub dengan hasil unduhan; lakukan **Commit changes**. Pengunjung baru dapat melihat revisi setelah GitHub Pages selesai menerbitkan.
- Gunakan **Impor revisi** untuk membuka file `sop.js` atau JSON yang disimpan sebelumnya.
- Gunakan **Reset draft** untuk kembali ke naskah asli. Ini menghapus revisi browser yang belum diekspor.
- Tombol **Cetak / PDF** mencetak bagian yang sedang dibuka. Pilih **Lihat Semua Dokumen** dahulu untuk mencetak seluruh SOP.

## Batasan dan privasi

1. Situs **tidak mempunyai login atau database online**. Tombol **Mode Edit** tersedia pada setiap browser, namun tidak bisa mengubah versi publik kecuali perubahan diterbitkan melalui repository GitHub.
2. Sebagai dokumen yang berlabel **internal**, pastikan pemilik dokumen menyetujui publikasi terbuka sebelum menggunakan repository public / GitHub Pages public.
3. Perubahan yang tersimpan di browser lain tidak otomatis tersinkron; gunakan alur ekspor → commit GitHub → refresh untuk menyebarkan versi resmi.
4. Password, data pelanggan, dan catatan rahasia tidak boleh dimasukkan ke konten publik ini.
5. Tata letak website **diadaptasi** agar responsif; tidak berusaha sama persis dengan tata letak setiap halaman Word.

## Pratinjau lokal

Buka `index.html` langsung di browser. Semua sumber inti lokal; hanya font dari Google yang opsional dan otomatis memakai font pengganti jika offline.

