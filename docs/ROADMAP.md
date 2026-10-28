# ROADMAP — NoteIT v2.1 "Durability & Adoption"

> Dokumen ini adalah hasil sesi grilling. Isinya keputusan yang sudah dikunci, bukan daftar keinginan.
> Aturan tertinggi: **tidak ada fitur baru sampai gate adopsi lolos.**

## Konteks & Posisi Proyek

NoteIT v2.0 adalah **personal supertool + lab belajar**, bukan produk komersial. Tidak ada pengguna lain,
tidak ada deadline, tidak ada onboarding/telemetri/auto-update. Overengineering diperbolehkan selama
tujuannya belajar, bukan menambah luas permukaan.

Karena itu definisi "selesai" bukan rilis, tapi: **berhenti membuka Notion**.

## Keputusan yang Dikunci

| # | Keputusan | Konsekuensi yang diterima |
|---|---|---|
| D1 | Personal supertool + lab belajar | Tanpa onboarding, telemetri, auto-update. Gate = 7 hari tanpa Notion |
| D2 | Durability dulu, Tiptap belakangan | Bulan ini TIDAK ada perubahan model dokumen |
| D3 | Tetap `node:sqlite`, semua SQL lewat repository layer | Swap ke `better-sqlite3` nanti = 1 file, bukan 12 |
| D4 | Target akhir: satu dokumen Tiptap, blok custom jadi node | Dieksekusi setelah data aman, bukan sekarang |
| D5 | Backup `VACUUM INTO` tiap 10 menit, rotasi 7 hari | Aman dari corrupt, TIDAK aman dari disk mati |
| D6 | Undo per halaman, 50 langkah, in-memory | Pindah tab = riwayat undo hilang |

## Fase 0 — Bikin "bebas refactor" ada artinya

Bukan fitur. Tanpa ini Fase 1 cuma judi.

- [ ] `git init` + `.gitignore` (`node_modules`, `out`, `*.db`, `*.db-wal`, `*.db-shm`, `backups/`, `*.log`)
- [ ] Vitest + test untuk `src/shared/dbml-parser.ts` dan fungsi murni di `src/main/db/client.ts`
- [ ] Error boundary renderer + `uncaughtException`/`unhandledRejection` di main → log ke file

## Fase 1 — Durability (gerbang adopsi)

- [ ] **Repository layer** — semua SQL pindah dari `workspace.service.ts` ke `src/main/db/repository/*.ts`
- [ ] **Transaksi** — `withTransaction()`; `updatePage` jadi satu unit (UPDATE + FTS + rebuild link)
- [ ] **FTS5 trigger** — buang `DELETE/INSERT` manual di `workspace.service.ts` (sekitar baris 426-427 dan 440)
- [ ] **Debounce 350ms** + flush saat blur/quit; hentikan IPC per ketikan
- [ ] **Undo per halaman** 50 langkah, coalescing 500ms
- [ ] **Backup** `VACUUM INTO backups/noteit-YYYYMMDD-HHmm.db`, interval 10 menit, rotasi 7 hari, saat start + sebelum quit
- [ ] **Export markdown** per halaman + seluruh workspace
- [ ] **Link by ID** — rename halaman tidak lagi memutus backlink
- [ ] Bonus: `rebuildAllPageLinks` hanya jalan kalau judul berubah atau teks mengandung `[[`

## Fase 2 — Satu-satunya fitur baru yang diizinkan

- [ ] **Quick capture** — `globalShortcut` Ctrl+Shift+Space → window frameless kecil → simpan ke Inbox
- [ ] **Inbox section** otomatis untuk menampung capture mentah
- [ ] **Daily note** — hotkey → halaman `YYYY-MM-DD` di section Daily, dibuat otomatis

## Fase 3 — Tiptap (baru boleh mulai setelah gate lolos)

- [ ] Spike di **salinan DB**: satu halaman, satu dokumen Tiptap, `dbml`/`mermaid`/`database` jadi custom node
- [ ] Migrasi `blocks[]` → ProseMirror JSON
- [ ] Switch hanya kalau 20 halaman migrasi bersih; kalau gagal, balik ke salinan

## Yang Ditolak Masuk Roadmap

Graphviz, attachment/PDF, Calendar, multi-kolom, version history UI, multi-tab polish, chart lanjutan.

Alasan: menambah pilar ke-5 sementara DBML solid, Canvas tipis, dan Gantt/Kanban/Chart menumpuk di satu
file 776 baris berarti 5 fitur setengah jadi. Nol nilai untuk lab belajar, maksimal untuk ilusi progres.

## Gate

**7 hari berturut-turut tanpa membuka Notion.**

Kalau gagal: plan berikutnya adalah audit friction (apa yang bikin balik ke Notion), BUKAN menambah fitur.
