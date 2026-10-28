# NoteIT v2.0 — Frontend Design System (`DESIGN.md`)

> [!IMPORTANT]
> **Aesthetic Direction: "Precision Drafting Workbench"**
> NoteIT v2.0 bukan sekadar aplikasi catatan kasual atau kloningan Notion yang generik. Ia adalah **meja kerja rekayasa dan arsitektur pengetahuan (*Engineering & Knowledge Workbench*)**. Bahasa visualnya berakar pada dunia fisik **buku catatan laboratorium berindeks, meja gambar arsitek, jangka sorong (*caliper*), dan lembar spesifikasi cetak biru (*blueprint spec sheet*)**—memadukan ketajaman struktural ala **Linear**, sentuhan mekanis-taktil ala **Teenage Engineering**, dan disiplin tipografi **Swiss Grid**.

---

## 1. Prinsip Desain Inti & Anti-Pola (Design Guardrails)

### 1.1 Apa yang Membuat NoteIT Terlihat Unik
1. **Structure is Information**: Garis pembatas tipis (`1px solid`), label bermonospace, dan strip warna indeks sepanjang `3px` di setiap Section tidak hadir sebagai dekorasi kosmetik, melainkan selalu menyandikan informasi nyata (hirarki halaman, tipe mode editor, relasi Foreign Key, atau ketergantungan jadwal Gantt).
2. **Tactile Precision Over Soft Blobs**: Hindari bayangan kabur yang berlebihan (*diffuse drop shadows*) dan sudut membulat besar (`16px+`). Gunakan radius sudut yang tegas (`4px` untuk elemen teknis/badge, `6px` untuk tombol/input, `8px` untuk kartu/panel) yang dipadukan dengan border `1px` ber-opasitas terukur.
3. **Spend Boldness in One Place**: Seluruh *chrome* aplikasi (sidebar, tab bar, status bar) tampil tenang, redup, dan disiplin, sehingga **Signature Element** (Header Spesifikasi Teknis + Sakelar Mode Mekanis, Diagram Skematik DBML, dan Timeline Gantt) menjadi pusat perhatian yang hidup.

### 1.2 Anti-Pola yang Dilarang Keras (No Generic AI Defaults)
* ❌ **Dilarang** menggunakan gradasi ungu-ke-biru-muda (*purple-to-cyan SaaS gradient*) seperti tombol di versi lama NoteIT.
* ❌ **Dilarang** menggunakan angka dekoratif palsu (`01 / 02 / 03`) pada elemen UI yang bukan urutan proses.
* ❌ **Dilarang** menggunakan efek *glassmorphism* berlebihan yang mengaburkan keterbacaan teks kode atau diagram.
* ❌ **Dilarang** memakai warna neon mentah (`#00FF00`, `#FF00FF`) untuk kategori atau chart; selalu gunakan palet **Drafting Marker** yang sudah dikalibrasi.

---

## 2. Sistem Token Warna (Color Token System)

NoteIT mendukung **Dual-Theme Adaptif** dengan **Dark Mode ("Graphite Slate")** sebagai tampilan bawaan (*default*) dan **Light Mode ("Archival Vellum")** sebagai alternatif ruang terang yang hangat namun tetap teknis.

### 2.1 Palet Utama: Dark Mode — *"Graphite Slate"* (Default)

| Token Name | Hex Value | Peran Visual & Penggunaan |
| :--- | :--- | :--- |
| `bg-canvas-primary` | `#111317` | Permukaan utama editor dokumen & latar kanvas kerja (*Deep Matte Graphite*). |
| `bg-surface-chrome` | `#0C0E12` | Sidebar (`Index Rail`), Titlebar, Tab Host, dan Status Bar (lebih gelap 1 tingkat untuk membingkai ruang kerja). |
| `bg-surface-elevated` | `#181B22` | Kartu di atas Spatial Canvas, blok kode DBML, baris tabel, dan Command Palette (`Ctrl+K`). |
| `bg-surface-hover` | `#20242D` | State *hover* dan item aktif pada navigasi sidebar/menu. |
| `border-hairline` | `#262A34` | Garis pembatas struktural `1px` antar panel, grid tabel, dan border kartu. |
| `border-subtle` | `#1C2029` | Garis pembatas sekunder di dalam daftar atau blok editor. |
| `text-primary` | `#ECEEF2` | Teks utama dokumen, judul halaman, dan nama tabel DBML (bukan `#FFFFFF` murni agar tidak menyilaukan mata). |
| `text-secondary` | `#949BA6` | Teks pendukung, *subtitle*, label properti tabel, dan *breadcrumb*. |
| `text-muted` | `#5E6572` | Placeholder editor (`Ketik '/' untuk perintah...`), nomor baris kode, dan metadata pasif. |
| `accent-cobalt` | `#3B82F6` | **Aksen Primer (Blueprint Cobalt)**: Fokus aktif, garis relasi Foreign Key DBML, tautan `[[Wiki-Link]]`, dan indikator mode aktif. |
| `accent-amber` | `#F59E0B` | **Aksen Sekunder (Caliper Amber)**: Badge Primary Key (`PK`), *milestone* Gantt Chart, *highlight* pencarian FTS5, dan mode Canvas aktif. |

### 2.2 Palet Utama: Light Mode — *"Archival Vellum"*

| Token Name | Hex Value | Peran Visual & Penggunaan |
| :--- | :--- | :--- |
| `bg-canvas-primary` | `#F7F6F2` | Permukaan kertas gambar arsitektur (*Warm Technical Vellum*), nyaman untuk membaca dokumen panjang. |
| `bg-surface-chrome` | `#EFECE6` | Sidebar (`Index Rail`), Titlebar, dan Status Bar. |
| `bg-surface-elevated` | `#FFFFFF` | Kartu di atas Spatial Canvas, header tabel DBML, dan modal Command Palette. |
| `bg-surface-hover` | `#E5E1D8` | State *hover* dan item aktif pada navigasi sidebar. |
| `border-hairline` | `#D8D4CA` | Garis pembatas struktural `1px` antar panel dan garis tabel. |
| `border-subtle` | `#E6E3DC` | Garis pembatas halus di dalam dokumen. |
| `text-primary` | `#141619` | Tinta gambar teknik (*Drafting Ink*) untuk judul dan teks utama. |
| `text-secondary` | `#525866` | Teks sekunder, label kolom, dan *breadcrumb*. |
| `text-muted` | `#8A909E` | Placeholder, nomor baris, dan keterangan waktu. |
| `accent-cobalt` | `#2563EB` | **Aksen Primer (Blueprint Cobalt)**: Tautan, garis konektor aktif, dan tombol aksi utama. |
| `accent-amber` | `#D97706` | **Aksen Sekunder (Caliper Amber)**: Indikator Primary Key, pin favorit, dan *milestone*. |

### 2.3 Palet "Drafting Marker" (6 Warna Indeks untuk Section, Tag, DBML Header & Gantt)

Digunakan secara konsisten untuk **Strip Warna Section (3px)**, **Header Tabel DBML**, **Bar Gantt Chart**, dan **Global Tags**:

| Nama Pigmen | Dark Mode Hex | Light Mode Hex | Penggunaan Semantik |
| :--- | :--- | :--- | :--- |
| **1. Blueprint Cobalt** | `#3B82F6` | `#2563EB` | Default Section, Core Architecture, Relasi FK, Task In-Progress |
| **2. Caliper Amber** | `#F59E0B` | `#D97706` | Primary Key (`PK`), Milestone Penting, Peringatan / Review |
| **3. Verdigris Teal** | `#10B981` | `#059669` | Skema Selesai / Verified, Task Completed, Data Positif |
| **4. Vermilion Red** | `#EF4444` | `#DC2626` | Blocker / Critical Dependency, Error Sintaks DBML/Mermaid |
| **5. Oxide Violet** | `#8B5CF6` | `#7C3AED` | Referensi Eksternal, Wiki Backlinks, Dokumentasi Riset |
| **6. Slate Ochre** | `#64748B` | `#475569` | Arsip, Backlog Task, Tabel Log / Metadata Sistem |

---

## 3. Sistem Tipografi (Typography System)

Tiga keluarga huruf dengan pembagian tugas yang tegas antara **Struktur UI**, **Kenyamanan Baca Jangka Panjang**, dan **Presisi Data/Kode**:

### 3.1 Peran Keluarga Font
1. **Display & Structural Headings — `'Space Grotesk'`**
   * **Karakter**: Geometris-teknis dengan proporsi arsitektural yang tegas.
   * **Penggunaan**: Judul Halaman (`H1`–`H3`), Nama Notebook/Section di Header, Judul Modal, dan Header Kolom Kanban.
2. **Body & Long-Form Reading — `'Plus Jakarta Sans'`**
   * **Karakter**: Neo-grotesque modern dengan *x-height* tinggi dan bukaan huruf yang bersih; tetap nyaman dibaca berjam-jam pada ukuran kecil maupun paragraf panjang.
   * **Penggunaan**: Seluruh isi paragraf blok editor, daftar item sidebar, menu *slash command*, dan deskripsi kartu.
3. **Technical, Code & Tabular Data — `'JetBrains Mono'`**
   * **Karakter**: Monospace rekayasa dengan dukungan ligatur terukur dan angka sejajar (`font-variant-numeric: tabular-nums`).
   * **Penggunaan**: Editor kode DBML/Mermaid/DOT, skema kolom & tipe data ERD (`uuid`, `varchar(255)`, `[pk]`), tanggal & persentase di Gantt Chart, sakelar `[DOC | CANVAS]`, serta koordinat `X/Y` di status bar.

### 3.2 Skala Tipografi & Spesifikasi

| Elemen | Font Family | Ukuran (`rem` / `px`) | Weight | Line Height | Letter Spacing |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Page Title (H1)** | `Space Grotesk` | `2.0rem` (`32px`) | `700` | `1.2` | `-0.025em` |
| **Section Heading (H2)** | `Space Grotesk` | `1.5rem` (`24px`) | `600` | `1.3` | `-0.015em` |
| **Sub-heading (H3)** | `Space Grotesk` | `1.2rem` (`19px`) | `600` | `1.4` | `-0.01em` |
| **Editor Body Text** | `Plus Jakarta Sans` | `0.9375rem` (`15px`) | `400` | `1.65` | `0em` |
| **UI Navigation / Sidebar** | `Plus Jakarta Sans` | `0.8125rem` (`13px`) | `500` | `1.4` | `0em` |
| **Code & DBML Editor** | `JetBrains Mono` | `0.8125rem` (`13px`) | `400` | `1.6` | `0em` |
| **Technical Spec / Badge** | `JetBrains Mono` | `0.6875rem` (`11px`) | `500` | `1.2` | `+0.04em` (Uppercase) |

---

## 4. Signature Visual Element: *"Technical Blueprint Spec Header & Caliper Switch"*

Elemen khas yang membuat tangkapan layar NoteIT v2.0 langsung dikenali dalam sekali lihat adalah **Header Spesifikasi Cetak Biru (*Blueprint Spec Header*)** di bagian atas setiap halaman, lengkap dengan **Sakelar Mekanis `[ ▤ DOC | ⊞ CANVAS ]`** dan **Transisi Grid Crosshair**.

```text
+--------------------------------------------------------------------------------------------------+
| [▎#3B82F6] CORE ARCHITECTURE  /  SEC-02: DATABASE  /  PG-104        [⇄ 4 BACKLINKS]  [⏱ v12]    |
|--------------------------------------------------------------------------------------------------|
|  🗄️ Sistem Skema & Reservasi Order                        +-------------------+  +------------+  |
|  TAGS: [#dbml] [#core-v2] · UPDATED 14 MIN AGO            | [▤ DOC]  ⊞ CANVAS |  | ◫ SPLIT ▾  |  |
|                                                           +-------------------+  +------------+  |
+--------------------------------------------------------------------------------------------------+
```

### Detail Perilaku Signature Element
1. **Top Spec Strip (`28px` height)**:
   * Menampilkan indikator warna Section aktif di sisi paling kiri (`3px` bar), *breadcrumb* berhuruf `JetBrains Mono 11px`, lencana jumlah **Backlinks (`⇄ 4 BACKLINKS`)** yang jika diklik membuka laci referensi silang, serta tombol **Snapshot Version (`⏱ v12`)**.
2. **Mechanical Mode Caliper (`[ ▤ DOC | ⊞ CANVAS ]`)**:
   * Sakelar dua posisi dengan *sliding indicator* berbingkai `1px solid` dan bunyi visual transisi `150ms cubic-bezier(0.22, 1, 0.36, 1)`.
   * Saat berada di **DOC Mode**, indikator beraksen **Blueprint Cobalt (`#3B82F6`)** dan latar halaman tampil bersih untuk fokus menulis.
   * Saat digeser ke **CANVAS Mode**, indikator berubah ke **Caliper Amber (`#F59E0B`)**, dan latar belakang halaman melakukan *cross-fade* halus (`200ms`) memunculkan **Architectural Crosshair Grid** (titik silang `+` halus setiap `24px` dengan titik mikro setiap `6px`).
3. **Bottom Telemetry Status Bar (`24px` height)**:
   * Di bagian paling bawah jendela aplikasi, bar tipis bermonospace menampilkan status mesin lokal secara langsung:
     * Mode DOC: `SQLITE WAL: READY  │  FTS5 INDEXED  │  1,420 WORDS · 6 BLOCKS  │  UTF-8`
     * Mode CANVAS / DBML: `SQLITE WAL: READY  │  GRID: 24PX SNAP  │  X: +0420  Y: -0180  │  ZOOM: 100%`

---

## 5. Arsitektur Layout & Wireframe Desktop Shell

NoteIT menggunakan **Frameless Electron Window** dengan *custom titlebar* terintegrasi, **Single Collapsible Sidebar ("Index Rail")** untuk menjaga ruang horizontal tetap lega, serta **Multi-Tab + Split-Pane Workspace**.

### 5.1 Wireframe Utama: Split-Pane (Kiri: Block Document + DBML, Kanan: Gantt Chart)

```text
+==================================================================================================================+
| ❖ NoteIT   [≡]  [🔍 Search or type a command... (Ctrl+K)        ]                     [☀/☾]  [—]  [□]  [✕]       |
+==================================================================================================================+
| NOTEBOOK             | [▎📄 Sistem Skema & Order ×] [▎📊 Master Roadmap ×] [+] || [▎📊 Master Roadmap (Gantt) ×] |
| [📘 Engineering  ▾]  |=========================================================||================================|
|----------------------| [▎] ENGINEERING / BACKEND / PG-104      [▤ DOC|⊞ CANV] || [▎] ENGINEERING / PM / PG-108  |
| ★ FAVORITES          |---------------------------------------------------------||--------------------------------|
|   📄 System Spec     | # Skema Database Order & Inventory                      || # Q4 Engineering Roadmap       |
|   🗺️ Core ERD        |                                                         || [Table] [▪Gantt] [Kanban] [Chart]|
|                      | Berikut adalah rancangan tabel utama yang terhubung ke  ||--------------------------------|
| ▼ SECTIONS           | modul [[Master Roadmap]] untuk fase pertama:            || TASK          | OCT 12 | OCT 19|
| ▎[Cobalt] Backend ▾  |                                                         ||---------------+--------+-------|
|   ├─ 📄 API Contract | +-----------------------------------------------------+ || 1. SQLite Core| ██████ |       |
|   ├─ 📄 Sistem Skema | | DBML STUDIO          [Code | ▪Split | Preview] [SQL]| ||               |      └─►       |
|   │  └─ 📄 Audit Log | +------------------------+----------------------------+ || 2. Dual Editor|        | ████░░|
| ▎[Amber] Product  ▾  | | 1 Table orders {       |  +----------------------+  | ||               |        |     └►|
|   └─ 📊 Master Roadm | | 2   id uuid [pk]       |  | ▎orders              |  | || 3. DBML Engine|        |    ◆  |
| ▎[Teal] Research  ▸  | | 3   user_id uuid [ref] |  +----------------------+  | ||               |        | (M1)  |
|                      | | 4   total int          |  | ◆ id           uuid  |──┼─||---------------+--------+-------|
| ▼ TAGS               | | 5 }                    |  | ○ user_id      uuid  |  | || [📊 Ringkasan Beban Kerja]     |
|   ● #dbml (4)        | |                        |  +----------------------+  | ||  Backend  ████████████  65%    |
|   ● #core-v2 (7)     | +------------------------+----------------------------+ ||  Frontend ███████       35%    |
+----------------------+---------------------------------------------------------++--------------------------------+
| ● SQLITE WAL: ONLINE │ FTS5: 42 PAGES │ BACKLINKS: 4               X: 0120 Y: 0085 │ SNAP: ON │ ZOOM: 100%       |
+==================================================================================================================+
```

### 5.2 Aturan Ukuran & Grid Spasial
* **Titlebar Custom**: Tinggi `36px`, berisi tombol *collapse sidebar*, pemicu **Command Palette (`Ctrl+K`)** di tengah dengan lebar `380px`, switcher tema, dan kontrol jendela native (`Minimize`, `Maximize`, `Close`).
* **Sidebar ("Index Rail")**:
  * Lebar default `248px` (dapat di-resize antara `200px` – `340px`, atau disembunyikan penuh dengan `Ctrl+\`).
  * Setiap **Section** memiliki **3px Vertical Marker Bar** sesuai warna *Drafting Marker*-nya.
  * **Page & Subpage** menggunakan garis panduan pohon (*tree hairline*) `1px solid var(--border-hairline)` dengan indentasi `16px` per level.
* **Tab Bar per Split-Pane**:
  * Tinggi `34px`. Tab yang sedang aktif menampilkan garis atas `2px` berwarna sesuai Section tempat halaman tersebut berada, sehingga pengguna langsung tahu konteks Section meskipun sidebar sedang ditutup.
* **Lebar Baca Dokumen (Block Mode)**:
  * Teks paragraf dibatasi pada `max-width: 740px` (terpusat di dalam pane) untuk ergonomi membaca optimal, **namun** blok khusus seperti **DBML Studio Block**, **Local Database Table**, dan **Gantt Chart Block** dapat direntangkan ke mode **Wide (`100%` lebar pane)**.

---

## 6. Desain Komponen Khusus: Diagramming & Charting

### 6.1 Engineering Schematic Style — DBML ERD Node

Setiap tabel yang di-render dari kode DBML (baik di dalam *DBML Block* maupun di atas *Spatial Canvas*) dirancang menyerupai kartu skematik teknik:

```text
+-----------------------------------------+
| [▎#3B82F6]  users                  [::] |  <-- Header (Background #181B22, Top/Left Accent 3px)
+-----------------------------------------+
| ◆ id              uuid         [PK]     |  <-- ◆ Diamond Amber (#F59E0B) untuk Primary Key
| ● email           varchar(255) [UQ NN]  |  <-- Badge constraint monospace kecil
| ○ org_id          uuid         [FK] ───►|  <-- ○ Lingkaran Cobalt (#3B82F6) + port garis keluar
|   created_at      timestamp             |
+-----------------------------------------+
```

* **Interaktivitas Relasi**:
  * Dalam keadaan normal, garis relasi antar tabel (*orthogonal step edge* dengan sudut membulat `6px`) berwarna `var(--border-hairline)` (`#262A34` di Dark Mode).
  * Saat pengguna mengarahkan kursor (*hover*) ke sebuah tabel atau baris kolom `FK`, garis relasi yang terhubung otomatis menyala menjadi **Blueprint Cobalt (`#3B82F6`)** atau **Caliper Amber (`#F59E0B`)** dengan ketebalan `2px` dan animasi aliran titik halus, sementara tabel lain yang tidak berelasi meredup (`opacity: 0.45`).
* **Toolbar DBML Studio**:
  * Menyediakan sakelar `[ Code | Split | Diagram ]`, tombol `[ ⊞ Auto-Layout (ELK) ]`, `[ 🎯 Fit View ]`, dan dropdown `[ ⬇ Export: SQL / SVG / PNG ]`.

### 6.2 Interactive Gantt Chart & Timeline View

* **Header Skala Waktu Dua Lapis**:
  * Baris atas menampilkan Bulan/Kuartal (`Space Grotesk 12px`), baris bawah menampilkan Tanggal/Minggu (`JetBrains Mono 11px` dengan `tabular-nums`).
  * Garis vertikal hari ini (**Today Marker**) ditampilkan dengan garis tegas `1px` berwarna **Caliper Amber (`#F59E0B`)** lengkap dengan lencana `TODAY` di puncak kolom.
* **Task Bar & Progress**:
  * Tinggi bar `22px`, radius sudut `4px`, bingkai luar `1px solid` warna *Drafting Marker*, bagian dalam yang sudah selesai (*progress %*) diisi warna solid ber-opasitas `85%`, dan bagian sisa durasi diisi pola garis arsir diagonal halus (*hatched pattern* 45 derajat) khas gambar teknik.
* **Dependency & Milestone**:
  * **Milestone** dirender sebagai bangun belah ketupat (*diamond* `◆` `12px × 12px` diputar `45deg`) berwarna `#F59E0B`.
  * **Garis Dependency** ditarik secara siku-siku (*orthogonal*) dari ujung kanan task pendahulu ke ujung kiri task penerus; berubah menjadi **Vermilion Red (`#EF4444`)** jika jadwal task penerus melanggar tanggal selesai task pendahulu (*schedule conflict*).

### 6.3 Spatial Freeform Canvas (`CANVAS Mode`)

* **Kartu Catatan (Note Card Node)**:
  * Memiliki *drag handle bar* tipis di bagian atas (`24px`), mendukung pemilihan warna border/aksen dari 6 *Drafting Marker*, dan dapat menampilkan *mini-editor* Tiptap langsung di dalam kartu.
* **Sticky Note & Frame Grouping**:
  * **Section Frame** di atas kanvas ditampilkan sebagai kotak berbingkai garis putus-putus (`1px dashed`) dengan label judul berhuruf `Space Grotesk` di sudut kiri atas yang menggerakkan seluruh node di dalamnya saat di-drag.

---

## 7. Gerakan, Transisi & Aksesibilitas (Motion & Quality Floor)

* **Kecepatan Responsif Desktop**:
  * Aplikasi desktop produktivitas tidak boleh terasa lambat karena animasi yang bertele-tele. Semua mikro-interaksi UI (buka menu `/`, pindah tab, buka Command Palette `Ctrl+K`) menggunakan durasi **`120ms` – `180ms`** dengan kurva `cubic-bezier(0.16, 1, 0.3, 1)`.
* **Keyboard-First Navigation**:
  * Setiap elemen interaktif wajib memiliki state `:focus-visible` berupa `outline: 1.5px solid var(--accent-cobalt)` dengan `outline-offset: 2px`.
  * Shortcut standar:
    * `Ctrl+K`: Command Palette & Pencarian FTS5 Instan
    * `Ctrl+\`: Buka/Tutup Sidebar (`Index Rail`)
    * `Ctrl+Shift+M`: Ganti Mode Halaman (`DOC` ↔ `CANVAS`)
    * `Ctrl+Alt+Right / Left`: Split Pane Kanan / Pindah Fokus Pane
* **Menghormati `prefers-reduced-motion`**:
  * Jika pengguna mengaktifkan pengurangan gerak di OS, matikan transisi *zoom/pan* otomatis pada kanvas dan animasi garis relasi DBML.

---

## 8. Panduan Bahasa & UX Copywriting (Interface Voice)

Mengikuti prinsip bahwa kata-kata di dalam UI adalah material desain, bukan hiasan:

1. **Gunakan Kalimat Aktif & Kata Kerja Spesifik**:
   * Tombol selalu menyebutkan hasil tindakannya secara spesifik: gunakan **"Buat Halaman Baru"**, **"Ekspor ke SQL"**, atau **"Simpan Snapshot"**, bukan label kabur seperti *"Submit"*, *"OK"*, atau *"Proses"*.
2. **Konsistensi Istilah Sepanjang Alur**:
   * Jika tombol di header bernama **"Simpan Snapshot"**, maka notifikasi *toast* yang muncul harus berbunyi **"Snapshot v13 disimpan"**, dan daftar riwayatnya bernama **"Riwayat Snapshot"**.
3. **Empty States sebagai Undangan Bertindak (Bukan Hiasan Mood)**:
   * Jangan tampilkan ilustrasi kartun kosong. Saat Section belum memiliki halaman, tampilkan kartu aksi teknis yang langsung bisa diklik:
     * *Judul*: `Section ini belum memiliki halaman`
     * *Tindakan*: `[ 📄 Buat Dokumen Blok (Ctrl+N) ]` atau `[ ⊞ Buat Kanvas Spasial ]` atau `[ 🗄️ Mulai dari Template DBML ]`
4. **Pesan Error yang Jelas & Membantu Penyelesaian (Tanpa Basa-basi Minta Maaf)**:
   * Saat sintaks DBML atau Mermaid salah diketik, jangan tampilkan *"Oops! Something went wrong :("*.
   * Tampilkan baris dan penyebab pastinya di panel bawah kode:
     `Baris 14: Kolom 'user_id' pada tabel 'orders' merujuk ke tabel 'users' yang belum didefinisikan.`

---

## 9. Implementasi CSS Variables (`globals.css` Acuan Awal)

Berikut adalah blok variabel CSS dasar yang siap langsung dipasang pada tahap inisialisasi `electron-vite` + Tailwind CSS:

```css
:root {
  /* Light Mode: Archival Vellum */
  --bg-canvas-primary: #F7F6F2;
  --bg-surface-chrome: #EFECE6;
  --bg-surface-elevated: #FFFFFF;
  --bg-surface-hover: #E5E1D8;

  --border-hairline: #D8D4CA;
  --border-subtle: #E6E3DC;

  --text-primary: #141619;
  --text-secondary: #525866;
  --text-muted: #8A909E;

  --accent-cobalt: #2563EB;
  --accent-amber: #D97706;

  /* Drafting Markers (Light) */
  --marker-cobalt: #2563EB;
  --marker-amber: #D97706;
  --marker-teal: #059669;
  --marker-red: #DC2626;
  --marker-violet: #7C3AED;
  --marker-slate: #475569;

  /* Fonts */
  --font-display: 'Space Grotesk', sans-serif;
  --font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

.dark {
  /* Dark Mode: Graphite Slate (Default) */
  --bg-canvas-primary: #111317;
  --bg-surface-chrome: #0C0E12;
  --bg-surface-elevated: #181B22;
  --bg-surface-hover: #20242D;

  --border-hairline: #262A34;
  --border-subtle: #1C2029;

  --text-primary: #ECEEF2;
  --text-secondary: #949BA6;
  --text-muted: #5E6572;

  --accent-cobalt: #3B82F6;
  --accent-amber: #F59E0B;

  /* Drafting Markers (Dark) */
  --marker-cobalt: #3B82F6;
  --marker-amber: #F59E0B;
  --marker-teal: #10B981;
  --marker-red: #EF4444;
  --marker-violet: #8B5CF6;
  --marker-slate: #64748B;
}
```
