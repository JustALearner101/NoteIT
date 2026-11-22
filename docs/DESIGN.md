# NoteIT — Obsidian Studio Design System (`DESIGN.md`)

> [!IMPORTANT]
> **Aesthetic Direction: "Obsidian Studio"**
> Bahasa visual NoteIT memadukan ketenangan **Matte Obsidian neutral graphite**, aksen **Periwinkle Indigo (`#6E7BF2`)** yang taktil, **soft pastel tinted pills** ber-kontras tinggi, tipografi **sentence-case Inter** yang lapang, dan **dot-matrix workflow canvas** dengan kontrol melayang (*floating dock*, *floating node toolbar*, dan *MiniMap*). Diserap dari esensi 3 layar referensi di `docs/` (Grouped Table, Kanban Board, dan Node Canvas) untuk menghadirkan ruang kerja spesifikasi & ADE yang tenang, tajam, dan terstruktur.

---

## 1. Prinsip Desain Inti & Guardrails

1. **Calm Matte Depth Over Noise**: Permukaan gelap dibangun dari lapisan grafit netral tanpa bias biru berlebih (`#0E0E11` chrome → `#141417` canvas → `#1C1C21` elevated → `#24242B` hover) dengan garis pembatas `1px` terukur (`#27272E` / `#1F1F25`). Tidak ada ambient glow berlebihan di mode bawaan — sorotan cahaya hanya muncul secara disengaja pada **node terpilih** (`#1D1E34` + ring `#6E7BF2`) dan **top sheen** tombol CTA primer.
2. **Sentence-Case UI Hierarchy**: Seluruh navigasi, header, tombol, badge status, dan status bar memakai **Inter sentence-case** yang mudah dipindai. Uppercase tracking mikro (`9.5px`) dibatasi ketat pada eyebrow tipe node (`SPEC NOTE`, `MEMO`, `DATA NODE`, `TABLE`), sementara `JetBrains Mono` dikhususkan untuk kode, shortcut keyboard (`Ctrl+K`), kode halaman (`PG-104`), dan angka sejajar (`tabular-nums`).
3. **One Primary Accent per Context**: Setiap layar/panel menempatkan hanya **satu tombol primer Periwinkle (`btn-primary-sheen`)** untuk aksi paling penting (`Dispatch Spec`, `Add task`, `Add Note`, `Export SQL`, `Launch Mission`), sementara kontrol lain tetap redup dan tenang.
4. **Accessible Contrast & Focus Floor**: Semua teks sekunder/muted dikalibrasi (`--text-muted: #787886` pada `#141417`, rasio ≥ 4.5:1), setiap elemen interaktif menjaga `:focus-visible` `2px solid var(--accent-cobalt)`, dan `prefers-reduced-motion` serta toggle Motion di Settings selalu dihormati.

---

## 2. Sistem Token Warna (`globals.css` & `themes.ts`)

### 2.1 Palet Utama: Dark Mode — *"Obsidian Studio"* (Default)

| Token CSS | Tailwind Class | Hex Value | Peran Visual |
| :--- | :--- | :--- | :--- |
| `--bg-surface-chrome` | `bg-surface-chrome` | `#0E0E11` | Sidebar, Titlebar, Status Bar, Track Segmented Control, Lane Kanban |
| `--bg-canvas-primary` | `bg-canvas-primary` | `#141417` | Permukaan utama editor, tabel, dan latar dot-matrix canvas |
| `--bg-surface-elevated` | `bg-surface-elevated` | `#1C1C21` | Kartu Kanban, Node Canvas, Dropdown, Modal, Input |
| `--bg-surface-hover` | `bg-surface-hover` | `#24242B` | State *hover*, item aktif sidebar, dan segmen aktif |
| `--border-hairline` | `border-border-hairline` | `#27272E` | Garis pembatas `1px` panel, kartu, dan kontrol |
| `--border-subtle` | `border-border-subtle` | `#1F1F25` | Garis pembatas baris halus di tabel & daftar |
| `--border-strong` | `border-border-strong` | `#34343E` | Border hover kartu/node dan konektor pasif |
| `--text-primary` | `text-ink-primary` | `#EDEDEF` | Judul, teks utama dokumen, label aktif |
| `--text-secondary` | `text-ink-secondary` | `#9A9AA6` | Teks pendukung, breadcrumb, deskripsi |
| `--text-muted` | `text-ink-muted` | `#787886` | Placeholder, metadata pasif, micro-eyebrow |
| `--accent-cobalt` | `accent-cobalt` | `#6E7BF2` | **Aksen Primer (Periwinkle Indigo)**: Primary CTA, fokus, node terpilih, port aktif |
| `--accent-amber` | `accent-amber` | `#E5A93C` | **Aksen Hangat**: Primary Key (`PK`), Milestone, Approval Required, Favorites |
| `--accent-emerald` | `accent-emerald` | `#22C55E` | Hairline progress bar (`3.5px`), indikator SQLite WAL online, status aktif |
| `--node-selected-bg` | `bg-[var(--node-selected-bg)]` | `#1D1E34` | Isi kartu node terpilih pada Spatial Canvas & DBML Studio |

### 2.2 Pasangan Light Mode — *"Archival Vellum"*

| Token CSS | Hex Value | Peran Visual |
| :--- | :--- | :--- |
| `--bg-canvas-primary` | `#F8F8FA` | Permukaan terang netral bersih |
| `--bg-surface-chrome` | `#F1F1F5` | Sidebar, Titlebar, Status Bar |
| `--bg-surface-elevated` | `#FFFFFF` | Kartu, Node, Popover |
| `--border-hairline` | `#E0E0E8` | Garis pembatas struktural `1px` |
| `--text-primary` | `#141418` | Teks utama kontras tinggi |
| `--accent-cobalt` | `#5B67E8` | Periwinkle Indigo versi terang |

Seluruh preset tema lain (`Graphite Slate`, `Orca Carbon`, `Code.Zone Amber`, `Finns Cosmic Nebula`, `Tokyo Night`, `Catppuccin Mocha`, `Nordic Frost`, `Solarized Studio`) tetap tersedia di **Settings → Appearance & Theme Studio**.

### 2.3 Adaptive Soft-Tinted Pastel Pills (`marker-colors.ts` & `Badge`)

Setiap warna semantik memiliki triplet CSS variables (`--pill-*-bg`, `--pill-*-text`, `--pill-*-border`) sehingga pill terbaca tajam baik di Dark Mode maupun Light Mode:

| Marker | Dark Hex | Dark Pill Text | Light Pill Text | Penggunaan Semantik |
| :--- | :--- | :--- | :--- | :--- |
| `cobalt` | `#6E7BF2` | `#A2ACFA` | `#434EC4` | Default section, Backlog, Foreign Key (`FK`), Active focus |
| `teal` | `#2DD4BF` | `#5EEAD4` | `#0B746A` | In Progress, Completed/Merged, Ready |
| `violet` | `#A78BFA` | `#C4B5FD` | `#6D28D9` | In Review, Research, Graphviz, Approval Gate |
| `amber` | `#E5A93C` | `#F2C46D` | `#9A5F08` | Primary Key (`PK`), Milestone, Approval Required |
| `red` | `#F87171` | `#FCA5A5` | `#B91C1C` | Blocker, Schedule Conflict, Error, Delete |
| `slate` | `#787886` | `#B4B4C2` | `#475569` | Standby, Neutral metadata, Archive |

---

## 3. Sistem Tipografi (Self-Hosted Offline `@fontsource`)

| Peran | Font Family | Ukuran & Weight | Karakter Penggunaan |
| :--- | :--- | :--- | :--- |
| **Display Headings** | `Plus Jakarta Sans`, `Inter` | `22px–26px`, `700`, `-0.02em` | Judul halaman (`SpecHeader`), H1–H3, judul modal |
| **UI & Reading Body** | `Inter`, `Plus Jakarta Sans` | `12px–14.5px`, `400–500` | Navigasi sidebar, tombol, tabel, kartu, paragraf editor |
| **Micro Eyebrow** | `Inter` | `9.5px`, `600`, `+0.08em` uppercase | Label tipe node canvas (`SPEC NOTE`, `TABLE`, `MEMO`) |
| **Code & Tabular Data** | `JetBrains Mono` | `10.5px–12.5px`, `tabular-nums` | Editor DBML/Mermaid/DOT, shortcut (`Ctrl+K`), kode halaman, persentase |

---

## 4. Arsitektur Komponen UI Reusable (`src/renderer/src/components/ui/`)

Seluruh permukaan UI dibangun di atas primitif composable berbasis Tailwind + `class-variance-authority`:

- **`Button`**: Varian `primary` (dengan `.btn-primary-sheen` top specular highlight), `secondary`, `outline`, `ghost`, `subtle`, `danger`.
- **`Badge`**: Pill pastel berbingkai halus dengan opsi `dot` / `pulseDot` dan `whitespace-nowrap`.
- **`SegmentedControl`**: Track cekung (`bg-surface-chrome`, `p-[3px]`, `rounded-[8px]`) dengan segmen aktif terangkat (`bg-surface-hover`) untuk `[Doc | Canvas]`, `[List | Board | Gantt | Calendar | Chart]`, `[Code | Split | Diagram]`, dan filter Mission Control.
- **`ProgressBar`**: Track hairline `3.5px` (`bg-accent-emerald`) dipasangkan dengan persentase `tabular-nums` rata kanan.
- **`Kbd`**: Lencana pintasan keyboard yang konsisten (`Ctrl+K`, `Ctrl+,`, `Esc`).

---

## 5. Pola Utama per Permukaan

1. **Desktop Shell & Dual-State Sidebar (`Titlebar`, `IndexRailSidebar`, `App`, `TelemetryStatusBar`)**:
   - Sidebar **Expanded (`240px`)**: Workspace switcher card + embedded search bar + flat navigation dengan right-aligned count pills + collapsible sections + pinned footer (`Workspace settings`, `Help & docs`).
   - Sidebar **Collapsed (`48px` Icon Rail)**: Saat `Ctrl+\` ditekan, sidebar mengecil menjadi rail ikon vertikal yang tetap memberi akses cepat ke Search, Workbench, AI Chat, Mission Control, Learn & Graph, Browser, Settings, dan Help.
   - **Semantic Primary Menu Icon Palette** (konsisten di mode Expanded & Collapsed, adaptif Dark/Light):
     - **Notes & Specs** (`FileText`): Cobalt (`--marker-cobalt`)
     - **Mission Control** (`Radio`): Amber (`--marker-amber`, beralih ke `accent-emerald` saat agen aktif)
     - **AI Assistant** (`MessageSquare`): Violet (`--marker-violet`)
     - **Learn & Graph** (`GraduationCap`): Teal (`--marker-teal`)
     - **Reference Web** (`Globe`): Emerald (`accent-emerald`)
   - Footer `TelemetryStatusBar` (`28px`): Terminal toggle & active spec di kiri, metrik tenang di tengah, indikator titik hijau SQLite WAL online di kanan.
2. **Project Database Views (`ProjectDatabaseBlock`, `TableView`, `KanbanView`, `GanttView`, `CalendarView`, `ChartView`)**:
   - **List (`TableView`)**: Baris lega (`42px`) dikelompokkan berdasarkan stage (`Backlog`, `In Progress`, `In Review`, `Completed`) dengan total jam per grup, badge pastel, hairline `ProgressBar`, dan summary footer bar.
   - **Board (`KanbanView`)**: Lane gelap terpisah hairline (`rounded-[12px]`), header stage + count + workload hours, kartu lega `rounded-[10px]` (`p-3.5`) dengan pill kategori dan progress bar sejajar.
3. **Spatial Canvas & Diagram Studios (`SpatialCanvas`, `DBMLStudio`, `MermaidStudio`, `GraphvizStudio`)**:
   - Latar **dot-matrix grid** (`20px`, `.bg-dot-canvas`) bebas garis silang bising.
   - Kartu node `rounded-[12px]` dengan tile ikon, eyebrow kategori, dan footer pill. Node terpilih menampilkan isian indigo (`--node-selected-bg`), border glow `#6E7BF2`, konektor bulat Periwinkle, serta **floating quick-action pill toolbar** di atas node.
   - Kontrol melayang: vertical dock kiri, action pill bar bawah-tengah, serta **ReactFlow `<MiniMap />` + custom zoom pill** di kanan bawah.
   - Relasi Foreign Key di `DBMLStudio` dirender sebagai kurva bezier halus yang menyala Periwinkle saat di-hover.
4. **Learn & Graph Workbench (`LearnWorkbenchView`, `LearnMarkdown`, `KnowledgeGraphView`)**:
   - **Tanpa 3-Sidebar Squeeze**: Daftar sesi belajar diletakkan sebagai dropdown **Session Switcher** ringkas di topbar sehingga aliran membaca utama tetap lega (`max-w-3xl mx-auto`).
   - **Rendered Markdown & Live Mermaid SVG**: Pesan tutor dan panel **Dependency Plan** dirender dengan `LearnMarkdown` + `MermaidDiagramPreview` (SVG ter-sanitasi `sanitizeSvg`), bukan teks Markdown/kode mentah.
   - **Transparansi Provider**: Topbar menampilkan **Provider Status Pill** (aktif vs peringatan *Offline Fallback* amber yang terhubung langsung ke Settings → AI providers).
   - **Propositional Knowledge Graph**: Memakai `@xyflow/react` dengan kartu proposisi bergaya konsisten (`--bg-surface-elevated`, `--border-hairline`), edge berlabel penalaran, filter domain, dan panel provenance ke halaman/sesi asal.
