# Log v2.2 — Unfreeze 7 Fitur

Catatan kerja nyata: apa yang selesai, apa yang menghadang, dan apa yang sengaja
dibiarkan. Ditulis 2026-10-28. Rencana lengkap ada di
`C:/Users/NHQFH/.codebuddy/plans/blazing-beacon-tesla-iu2JHptW.md`, status ringkas di
[ROADMAP.md](./ROADMAP.md).

## Ringkasan

| Metrik | Awal v2.2 | Sekarang |
|---|---|---|
| Test | 87 (12 berkas) | 315 (21 berkas) |
| Gelombang selesai | 0 | 4 dari 4 |
| Fitur dibuka dari freeze | 0 | 7 dari 7 |

Keempat gelombang selesai.

## Pencapaian

### Gelombang 0 — Gate runtime
App dibuktikan boot sebelum menyentuh fitur apa pun: proses hidup 20 detik, folder
`backups/` terbentuk, nol baris ERROR di log, `page_aliases` + 3 trigger FTS ada,
`pages` = `pages_fts`. Isi berkas backup juga diperiksa langsung (bukan hanya
keberadaan berkasnya).

### Gelombang 1 — Chart lanjutan + Calendar
- `ProjectDatabaseBlock.tsx` 777 baris dipecah jadi shell 146 baris + 5 view
  (Gantt, Kanban, Table, Chart, Calendar) + `views/types.ts`.
- Empat pustaka murni baru: `database/dates.ts`, `tasks.ts`, `calendar.ts`,
  `chart-data.ts`.
- Chart line/radar/scatter ditambahkan; fallback `else` ke donut diganti switch
  eksplisit supaya tipe tak dikenal tidak diam-diam jadi pie.
- Bug tanggal hardcoded (`todayIso = '2026-10-27'`) dihapus; Calendar memakai
  `toLocalIsoDate(new Date())`.

### Gelombang 2 — Graphviz + multi-tab
- `@viz-js/viz` dengan wasm inline base64: nol berkas `.wasm`, nol request
  jaringan. Gerbang offline lulus sebelum UI ditulis; chunk awal hanya +13,8 KB
  karena import dinamis.
- `svg-sanitize.ts` dipakai Graphviz (bukan `securityLevel: 'loose'` seperti Mermaid).
- `lib/tabs.ts`: reorder, close-others, close-to-right, wrap-around, prune,
  serialize/parse tahan JSON rusak, clamp split ratio, reopen stack — 48 test.

### Gelombang 3A — CSP + font self-hosted
CSP dipasang lewat `onHeadersReceived` sehingga berlaku di dev maupun produksi
(dev lebih longgar untuk HMR). `'wasm-unsafe-eval'` wajib ada untuk Graphviz.
Tiga paket `@fontsource` menggantikan Google Fonts: nol referensi eksternal,
13 request `file://` terintersepsi, peringatan "Insecure CSP" hilang.

### Gelombang 3B — Version history
- `PageVersion` dapat `tags`; tipe baru `PageVersionSummary` (metadata saja,
  `blockCount` dari `json_array_length`) supaya drawer tidak menarik isi blok
  tiap 350 ms.
- `restorePageSnapshot` menyisipkan snapshot pengaman berlabel
  `Sebelum restore v{n}` di transaksi yang sama, memakai `insertVersion` langsung
  (bukan `updatePage`) agar tidak rekursi.
- `shared/version-diff.ts` — `diffBlockSets` → added/removed/changed/unchanged/
  titleChanged.
- Drawer: loading/empty state, rename inline, konfirmasi 2 langkah, panel diff.

### Gelombang 3C — Attachment/PDF
- Tabel `assets` aditif (aman untuk DB lama) + berkas content-addressed
  `workspace/assets/<sha256>.<ext>`. Isi sama → satu berkas, satu baris.
- Protocol `noteit-asset` didaftarkan **sebelum** `app.whenReady()`, dengan
  `standard/secure/supportFetchAPI/stream`. Handler menolak path traversal dua
  lapis dan mendukung `Range` untuk PDF besar.
- Backup ikut menyalin aset secara inkremental ke `backups/noteit-*.assets/`;
  rotasi menghapus folder pasangannya. Biner selalu lewat `copyFileSync`.
- Ekspor: `image` → `![](assets/<hash>.<ext>)`, `file` → tautan; satu salinan per
  aset unik untuk ekspor seluruh workspace.

### Gelombang 4 — Multi-kolom
- Model flat, bukan array bersarang: `BlockType` dapat `'columns'`, `DocumentBlock` dapat
  `columnGroupId`, `columnIndex`, `columnWidths` (hanya di header). FTS, ekspor, undo, dan
  snapshot tidak berubah — itu alasan model ini dipilih meski akan dibuang saat Tiptap.
- `lib/columns.ts`: `groupBlocks`, `flattenColumns`, `createColumnGroup`, `removeColumn`,
  `moveBlockToColumn`, `resolveColumnDrop`, `normalizeWidths`, `resizeColumnPair`,
  `nudgeDivider` — 26 test. Lebar minimum efektif `min(15, floor(100/count))`.
- `ColumnGroup`: grid persen eksplisit, divider `role="separator"` + pointer capture, panah
  kiri/kanan, empty state, drop target per kolom. `onChange` hanya saat pointerup, jadi satu
  drag resize = satu entri undo.
- DnD antar kolom hanya lewat handle grip. Kalau seluruh blok draggable, seleksi teks rusak.

## Obstacle

### 1. Flaky test yang bukan flaky
Test "judul aktif menang atas alias" gagal 3 dari 10 kali. Dugaan awal: race
condition. Setelah skrip diagnostik, penyebabnya deterministik: dua baris punya
`created_at` milidetik identik, dan tie-breaker `ORDER BY created_at ASC, id ASC`
memakai UUID acak — jadi hasilnya acak. Diperbaiki jadi
`ORDER BY created_at ASC, rowid ASC`. Verifikasi 10/10 lulus. Pelajarannya: jangan
menambahkan retry sebelum membuktikan penyebabnya.

### 2. Worker tanpa tool tulis (menunda Gelombang 4)
Tiga percobaan menjalankan Gelombang 4 lewat sub-agent berhenti di langkah 0 karena
worker hanya menerima `Read`/`Grep` — tanpa `Write`, `Edit`, `Bash`. Probe minimal
tanpa tugas pun mengembalikan hasil sama, jadi penyebabnya provisioning tool, bukan
prompt. Karena worker berhenti sebelum membaca atau menulis apa pun, tidak ada
perubahan setengah jadi. Gelombang 4 ditunda, bukan gagal.

Yang kemudian membuka jalan: masalahnya acak, bukan sistematis. Task kecil berhasil
padahal task besar dengan provisioning yang sama gagal. Gelombang 4 dipecah jadi empat
langkah kecil — lib kolom, `ColumnGroup`, integrasi, DnD — dan keempatnya berhasil.

### 3. Spesifikasi undo yang salah
Ctrl+Z tidak berfungsi di dalam editor karena saya mengecualikan target
`INPUT`/`TEXTAREA` dari undo aplikasi. Akibatnya undo hanya hidup di luar area
menulis — praktis tidak berguna. Diperbaiki: pengecualian sekarang hanya command
palette.

### 4. Eksportir Markdown ganda
`SpecHeader.tsx` punya pembangun Markdown sendiri yang hasilnya berbeda dari
ekspor via Command Palette. Dihapus (−30 baris), sekarang keduanya memanggil
`window.noteitAPI.exportMarkdown`.

### 5. Budget bundle terlampaui
Kenaikan raw +145 KB vs budget 60 KB. Setelah diperiksa, delta gzip hanya
+21,9 KB dan sisanya berasal dari tipe chart Recharts yang baru dipakai. Diterima
dengan sadar, bukan diabaikan.

### 6. `File.path` sudah dihapus di Electron 35
Paste screenshot tidak punya path berkas, jadi jalur impor berbasis path tidak
cukup. Ditambah IPC `assets:importBytes` — deviasi kecil dari rencana, bukan
pengurangan cakupan.

### 7. AskUserQuestion tidak bisa dipanggil dari sel REPL
Pertanyaan yang butuh jawaban pengguna harus disampaikan sebagai teks balasan.
Kalau dipanggil di dalam sel, panggilan gagal/timeout.

### 8. Plan mode memblokir penulisan
Saat menyusun rencana, sub-agent tidak bisa menulis berkas rencana karena plan mode
menahan semua penulisan. Berkas baru tertulis setelah rencana disetujui.

## Utang teknis yang diketahui (sengaja belum dibayar)

- GC aset hanya dipicu saat halaman dihapus. Menghapus blok aset meninggalkan
  berkas sampai halaman itu dihapus — GC tiap save berisiko memutus rantai undo.
- Impor aset membaca berkas penuh ke memori setelah `stat`; berkas 120 MB ditolak
  berdasarkan ukuran, bukan streaming.
- Berkas identik dengan ekstensi berbeda memakai ekstensi impor pertama.
- `assets:import` tidak memfilter tipe berkas; hanya batas ukuran.
- Mermaid masih static import dan `securityLevel: 'loose'`; sanitizer hanya dipakai
  Graphviz.
- Field `assignee` belum pernah dirender.
- Belum ada drag di Gantt/Kanban/Calendar (hanya tombol ±1 hari dan pilih tanggal).
- Tanggal seed masih hardcoded di `BlockEditor.tsx`.
- Tab persistensi memakai `localStorage`; perilaku di origin `file://` belum
  dibuktikan, fallback IPC `ui-state.json` belum dibuat.
- Dua cast TypeScript di jalur kolom karena `ColumnBlock.type` bertipe string, bukan
  `BlockType`.
- Gutter hover (badge + tombol hapus grup) tambahan di luar rencana, dibuat supaya
  hapus header grup terjangkau dari UI.

## Belum diverifikasi (butuh klik manual di Electron)

Semua di bawah ini **belum** dijalankan; jangan dianggap lulus:

- drag PNG ke editor, paste screenshot, tampil setelah restart
- PDF 10 MB bisa di-scroll (Range), berkas 120 MB ditolak
- `backups/noteit-*.assets/` benar-benar berisi berkas setelah backup nyata
- hapus halaman → aset hilang, tetapi aset yang dipakai halaman lain aman
- restore versi lama → gambar tetap tampil
- ekspor workspace menghasilkan `.md` + folder `assets/` dan gambar terbuka
- CSP produksi tanpa error di console
- urutan tab dan lebar divider split bertahan setelah restart
- Graphviz membersihkan SVG lama saat error
- slash entry 2/3 kolom, resize divider, hapus kolom, drag blok antar kolom, dan undo setelah drag

## Status gate

Gate tetap **7 hari berturut-turut tanpa membuka Notion**, dan belum mulai dihitung.
Ketujuh fitur sudah ada. Gate bisa mulai dihitung kapan saja; yang tersisa hanya
smoke manual di Electron.
