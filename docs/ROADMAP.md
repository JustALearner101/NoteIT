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
| D6 | Undo per halaman, 50 langkah, in-memory | Riwayat undo bertahan per halaman (dibersihkan saat halaman dihapus), bukan hilang saat pindah tab |

## Fase 0 — Bikin "bebas refactor" ada artinya

Bukan fitur. Tanpa ini Fase 1 cuma judi.

- [ ] `git init` + `.gitignore` (`node_modules`, `out`, `*.db`, `*.db-wal`, `*.db-shm`, `backups/`, `*.log`)
- [ ] Vitest + test untuk `src/shared/dbml-parser.ts` dan fungsi murni di `src/main/db/client.ts`
- [ ] Error boundary renderer + `uncaughtException`/`unhandledRejection` di main → log ke file

## Fase 1 — Durability (gerbang adopsi)

- [x] **Repository layer** — semua SQL pindah dari `workspace.service.ts` ke `src/main/db/repository/*.ts`
- [x] **Transaksi** — `withTransaction()`; `updatePage` jadi satu unit (UPDATE + FTS + rebuild link)
- [x] **FTS5 trigger** — buang `DELETE/INSERT` manual di `workspace.service.ts` (sekitar baris 426-427 dan 440)
- [x] **Debounce 350ms** + flush saat blur/quit; hentikan IPC per ketikan
- [x] **Undo per halaman** 50 langkah, coalescing 500ms
- [x] **Backup** `VACUUM INTO backups/noteit-YYYYMMDD-HHmm.db`, interval 10 menit, rotasi 7 hari, saat start + sebelum quit
- [x] **Export markdown** per halaman + seluruh workspace
- [x] **Link by ID** — rename halaman tidak lagi memutus backlink
- [x] Bonus: `rebuildAllPageLinks` hanya jalan kalau judul berubah atau teks mengandung `[[`

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


## v2.2 — Unfreeze 7 Fitur (aktif)

Rencana lengkap: C:/Users/NHQFH/.codebuddy/plans/blazing-beacon-tesla-iu2JHptW.md

Empat gelombang, urut dari risiko data nol ke paling besar:

| Gelombang | Fitur | Risiko data |
|---|---|---|
| 0 | Gate runtime: test, typecheck, build, npm run dev, smoke 10 titik | — |
| 1 ✅ | Chart lanjutan (line/radar/scatter) + Calendar view + pecah ProjectDatabaseBlock | Nol |
| 2 | Graphviz DOT (@viz-js/viz) + multi-tab polish (drag, context menu, shortcut, divider split) | Nol |
| 3 | CSP + font self-hosted, version history polish, attachment/PDF | Tinggi (disk + skema) |
| 4 | Multi-kolom penuh (model flat) | Sedang, diketahui akan dibuang saat Tiptap |

Keputusan kunci: aset = file content-addressed + tabel assets (K1); backup aset = salin folder inkremental (K2); CSP produksi + @fontsource (K3); multi-kolom model flat (K4); Graphviz @viz-js/viz (K5); tab persist localStorage (K6); restore versi pakai snapshot pengaman (K7); bulan Calendar = useState lokal (K8).

Target test: 87 → ≥110 → ≥132 → ≥168 → ≥190.

Aturan gate Langkah 0: kalau app gagal boot atau ada kehilangan data saat smoke, BERHENTI — perbaiki durability dulu, 7 fitur ditunda.
