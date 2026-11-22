# Log v2.3 — Unified AI Providers, Web Workbench & Learn Workbench

Catatan kerja nyata untuk rilis **v2.3**: apa yang dibangun, hambatan nyata saat uji langsung di Electron, dan hasil verifikasi. Ditulis 2026-11-22. Status ringkas ada di [ROADMAP.md](./ROADMAP.md).

## Ringkasan

| Metrik | Akhir v2.2 / ADE | Sekarang (v2.3) |
|---|---|---|
| Test | 380 (32 berkas) | 392 (37 berkas) |
| Typecheck (Node + Web) | Hijau | Hijau (0 error) |
| Gelombang v2.3 selesai | 0 | 4 dari 4 + Polish |
| Fitur baru utama | — | Provider Registry & CLI Bridges, Web Workbench, Learn & Graph |

## Pencapaian

### Gelombang 1 — Unified AI Provider Registry & Headless CLI Bridges
- Menghapus hardcoding model (`gpt-4o-mini`, `claude-3-5-sonnet-latest`, `gemini-2.5-flash`) di `ai.service.ts` dan memindahkan resolusi provider ke `src/main/services/provider.service.ts`.
- Menambahkan tabel SQLite aditif `ai_provider_profiles` dan `app_kv` untuk menyimpan profil **Custom OpenAI-Compatible** (`/v1`), **Custom Anthropic-Compatible** (Messages API), **Custom Headless CLI**, serta **Model Slots** (`primary` untuk Chat/Learn dan `background` untuk ekstraksi Knowledge Graph). Kredensial tetap terenkripsi via `safeStorage` (`secret.service.ts`).
- Membangun **Headless CLI Bridges** (`src/main/services/cli-bridge/cli-bridge.service.ts`) + **Token-Protected Loopback MCP Server** (`mcp-loopback.ts` di `127.0.0.1:0`, Bearer token acak per sesi) terinspirasi dari `reference/learnharness`, sehingga pengguna dapat memanfaatkan autentikasi/langganan CLI lokal (`claude`, `gemini`, `codex`, `agy`) tanpa memasukkan API key terpisah.
- Memperbarui `AiProvidersTab.tsx` dan dropdown model `AIChatView.tsx` untuk memilih CLI Bridge, Custom Endpoint, atau Built-in API secara langsung.
- Menambahkan `reference/` ke `.gitignore` agar repositori riset lokal tidak ikut ter-commit.

### Gelombang 2 — Web Workbench (Upgrade In-App Browser)
- Menambahkan tabel `browser_bookmarks` (`browser.service.ts`) untuk bookmark yang bisa diedit dan disematkan per notebook, serta persistensi tab browser di `ui-state.json`.
- Mengubah `setWindowOpenHandler` `<webview>` di `src/main/index.ts` agar tautan `target="_blank"` terbuka sebagai tab baru di dalam `InAppBrowserView` (bukan memaksa keluar ke browser OS).
- Membangun `src/shared/web-clipper.ts` untuk ekstraksi DOM terstruktur (menjaga heading, paragraf, list, dan blok `<pre><code>` beserta bahasanya) menjadi blok NoteIT nyata, bukan potongan 600 karakter `innerText`.
- Menambahkan **Find-in-Page (`Ctrl+F`)**, kontrol **Zoom** (`Ctrl+=` / `-` / `0`), tombol **Learn** (*Learn This Page*), dan **Localhost Console Inspector** untuk menangkap `console-message` warning/error dan mengirimkannya ke AI Chat.

### Gelombang 3 — Native Learning Workbench & Propositional Knowledge Graph
- Menambahkan tabel SQLite aditif `learn_sessions`, `learn_turns`, `learn_side_threads`, `kg_propositions`, dan `kg_chains`.
- Membangun `src/main/services/learn.service.ts` dengan loop pedagogis 4 fase (**Measure → Plan → Teach → Practice**), field **Think out loud**, skala **Confidence 1–5**, **Side Questions** non-blocking, ekstraktor **Propositional Knowledge Graph** dengan deduplikasi identitas deterministik, serta **Crystallize to NoteIT Page**.
- Membangun `LearnWorkbenchView.tsx`, `LearnMarkdown.tsx`, dan `KnowledgeGraphView.tsx` (`@xyflow/react`) dengan integrasi dua arah dari `SpecHeader.tsx` (tombol `Learn` di setiap halaman), `InAppBrowserView.tsx`, `IndexRailSidebar.tsx`, dan `CommandPalette.tsx`.

### Gelombang 4 & Polish (Pasca Uji Langsung `npm run dev`)
- Memverifikasi Quick Capture (`Ctrl+Shift+Space`), Daily Notes (`Ctrl+Alt+D`), Mermaid dynamic import + `sanitizeSvg`, drag-and-drop Kanban/Gantt, dan `ui-state.json` sudah aktif.
- Menerapkan warna ikon semantik adaptif (Dark/Light) pada 5 menu utama sidebar (`Notes & Specs` Cobalt, `Mission Control` Amber/Emerald, `AI Assistant` Violet, `Learn & Graph` Teal, `Reference Web` Emerald).

## Obstacle & Perbaikan Nyata Saat Uji Langsung

### 1. Loop `GUEST_VIEW_MANAGER_CALL` `ERR_ABORTED (-3)` pada `<webview>`
Saat `npm run dev` dijalankan dan pengguna menavigasi di **Reference Web**, `<webview>` membombardir terminal dengan `ERR_ABORTED (-3)` berulang kali. Penyebabnya: `handleNavigate` memutasi `wv.src = url` sekaligus memperbarui `tab.url` yang terikat ke prop `<webview src={tab.url} />`, sehingga setiap re-render atau redirect (misal MDN ke `/en-US/`) membatalkan navigasi yang sedang berjalan dan memuat ulang.
- **Perbaikan**: Memisahkan `initialUrl` (immutabel untuk mount `<webview>`) dari `url` (state tampilan), memindahkan navigasi ke `wv.loadURL(url).catch(...)`, menyinkronkan URL lewat `did-navigate`/`did-navigate-in-page`, dan menambahkan overlay error untuk `did-fail-load` (sambil mengabaikan `-3`).

### 2. Timeout Pencarian DuckDuckGo (`ERR_CONNECTION_TIMED_OUT -118`)
Kueri teks biasa di omnibox sebelumnya diarahkan ke DuckDuckGo yang terblokir/timeout di sebagian ISP lokal.
- **Perbaikan**: Mengubah mesin pencari default ke **Google** dengan opsi pilihan di **Settings → Browser** (`Google`, `Bing`, `Brave`, `DuckDuckGo`).

### 3. Teks Markdown & Mermaid Mentah + 3 Sidebar Berdempetan di Learn Workbench
Pada prototipe awal Gelombang 3, pesan tutor masih menampilkan `**bold**` dan blok ```` ```mermaid ```` mentah, panel Dependency Plan hanya `<pre>`, dan adanya rail kiri sesi membuat 3 sidebar berdempetan. Selain itu, Learn Mode memakai `Model Slots` default yang kosong sehingga jatuh ke fallback offline.
- **Perbaikan**: Membuat `LearnMarkdown.tsx` (Markdown + `<MermaidDiagramPreview />` SVG ter-sanitasi), mengganti rail sesi kiri dengan dropdown **Session Switcher** di topbar agar kolom baca lega (`max-w-3xl`), meneruskan provider aktif pengguna (`providerOverride`/`profileIdOverride`/`modelIdOverride`), menampilkan **Provider Status Pill** di topbar, dan menambahkan CTA kontekstual (*Approve Plan & Start Step N1*).

## Verifikasi
- `npm run typecheck` (`typecheck:node` + `typecheck:web`): **0 error**.
- `npm test`: **37 berkas test, 392 test hijau** (termasuk `provider.service.test.ts`, `cli-bridge.service.test.ts`, `browser.service.test.ts`, `web-clipper.test.ts`, `learn.service.test.ts`).
- `npm run build`: **hijau** (`out/main`, `out/preload`, `out/renderer`).
