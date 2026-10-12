# 🗺️ ElseWhere Engineering Roadmap

> Tracking engineering milestones, completed architectural modules, and industrial-grade differentiators for **ElseWhere** — the high-performance, local-first collaborative LaTeX & research authoring suite.

---

## 📊 Milestone Tracker & Progress Overview

| Phase | Milestone | Focus Area | Status | Delivery Target |
| :--- | :--- | :--- | :---: | :---: |
| **Phase 0** | **Foundation & Scaffolding** | Vite 8 + React 19 + Monaco + PDF.js + Virtual VFS | `[COMPLETED]` | Delivered |
| **Phase 1** | **Compilation Engine & Diagnostics** | Node.js Sandboxes + Tectonic/Multi-Engine + Diagnostic Parser | `[COMPLETED]` | Delivered |
| **Phase 2** | **Design Token System** | Tailwind CSS v4 + Semantic `@theme` + Dark Theme | `[COMPLETED]` | Delivered |
| **Phase 3** | **Dual AI Copilot & VS Code Activity Bar** | Groq LPU + Gemini + VS Code Activity Bar + Multi-View Sidebar | `[COMPLETED]` | Delivered |
| **Phase 4** | **Agentic AI & Research Intelligence** | Autonomous Agent + Copilot Chat + Universal Academic Search (250M+ Papers) + Base Paper Reading + Humanizer | `[COMPLETED]` | Delivered |
| **Phase 5** | **Professional IDE Workspace & Navigation** | Application Menu Bar + Editor Tab Pills + Settings Hub + PDF Preview Controls | `[COMPLETED]` | Delivered |
| **Phase 6** | **Overleaf Industrial Differentiators** | AI Doctor, SyncTeX, Smart DOI/BibTeX, TikZ Studio, PDF Diff, Pandoc/Word Export | `[PLANNED]` | Q3 2026 |
| **Phase 7** | **Sandboxing, Decoupled Queue & WASM** | Docker/Firecracker, BullMQ + Redis, Client-side WASM TeX (Offline) | `[PLANNED]` | Q3 2026 |
| **Phase 8** | **Multiplayer CRDTs & Git Sync** | Yjs Real-Time Engine, Track Changes, GitHub Two-Way Sync | `[PLANNED]` | Q4 2026 |
| **Phase 9** | **Enterprise Identity & Production Scale** | PostgreSQL/Drizzle, ORCID/SAML SSO, RBAC, Kubernetes Helm | `[PLANNED]` | Q4 2026 |

---

## 🏗️ System Architecture Overview

```mermaid
flowchart TB
    subgraph Frontend ["Client Workspace (React 19 + Vite 8 + Zustand)"]
        ActivityBar["VS Code Activity Bar (Explorer, Search, AI, Outline)"]
        MenuBar["App Menu Bar (File, Edit, Insert, View, Format, Help)"]
        TabPills["Editor Tab Pills Bar (Multi-File Buffers)"]
        Monaco["Monaco LaTeX Editor Core (Snippets, Markers, Ghost Text, Cmd+K)"]
        PDFViewer["PDF.js Live Preview (Retina Canvas, Zoom, Continuous)"]
        Logs["Diagnostics & Raw Log Drawer"]
        AIAgent["ChatPanel (AiPanel.tsx): Copilot Chat & Autonomous Agent Mode"]
    end

    subgraph Backend ["Compilation & Intelligence Server (Node.js + Express)"]
        API["Express REST API (:4000)"]
        EngineDetect["Host Engine Discovery (tectonic, pdflatex, xelatex, latexmk)"]
        Compiler["Build Orchestrator (/tmp/latexer-builds/<uuid>)"]
        LogParser["TeX Log Diagnostic Parser (Errors, Warns, BadBoxes)"]
        PDFStream["In-Memory PDF Cache & Streamer"]
        AgentSvc["Agent Tool Execution & Literature Reader"]
        AISvc["AI Inference Service (Groq LPU & Gemini SDK)"]
    end

    subgraph Engines ["Host TeX Engines & External Services"]
        Tectonic["Tectonic (Cloudflare Package Auto-Fetch)"]
        TeXLive["TeXLive / MacTeX (latexmk, pdflatex, xelatex)"]
        GroqAPI["Groq LPU (GPT-OSS 120B / Qwen 27B / GPT-OSS 20B)"]
        GeminiAPI["Google Gemini (3.8 Flash / 3.6 Flash / 3.1 Pro)"]
        arXivCrossRef["arXiv & CrossRef Literature APIs"]
    end

    ActivityBar --> Monaco
    MenuBar --> Monaco
    TabPills --> Monaco
    Monaco -->|Trigger Compile| API
    AIAgent -->|Tool Calls & Agent Prompts| AgentSvc
    AgentSvc --> AISvc
    AISvc --> GroqAPI
    AISvc --> GeminiAPI
    AgentSvc --> arXivCrossRef
    API -->|Sandbox Execution| Compiler
    Compiler -->|Execute| Tectonic
    Compiler -->|Execute| TeXLive
    Compiler -->|Raw TeX Log| LogParser
    Compiler -->|Generated PDF| PDFStream
    PDFStream -->|Stream /api/pdf/:id| PDFViewer
    LogParser -->|Structured Diagnostics| Monaco
```

---

## 🏁 Phase 0: Foundation & Core Scaffolding `[COMPLETED]`

- [x] **Monorepo Architecture**:
  - Concurrent development workflow orchestrating Vite client (`:3000`) and Express server (`:4000`).
  - Production-ready proxying in `vite.config.ts` routing `/api` traffic seamlessly to the backend.
- [x] **Modern Client Scaffolding**:
  - React 19 (`react: ^19.2.8`), Vite 8 (`vite: ^8.3.0`), TypeScript 6 (`typescript: ~6.0.2`), and Oxlint (`oxlint: ^1.81.0`).
  - Zustand 5 state management store with persistent local storage hydration (`useProjectStore.ts`, `useLayoutStore.ts`, `useAiStore.ts`).
- [x] **Monaco LaTeX Editor Core** (`MonacoLatexEditor.tsx`):
  - Custom LaTeX syntax tokenization with high-contrast theme matching.
  - Native snippet completions: `\begin{equation}`, `\begin{figure}`, `\begin{table}`, `\begin{itemize}`, `\begin{enumerate}`, `\cite`, `\ref`, `\section`, formatting (`\textbf`, `\textit`).
  - Essential editor keybindings: `⌘ + Enter` / `Ctrl + Enter` (Recompile), `⌘ + S` (Save & Compile), `⌘ + K` (AI Inline Prompt), `⌘ + B` (Toggle Sidebar), `⌘ + J` (Toggle Diagnostics).
  - Auto-compilation debounce timer option (1.5s idle recompile).
- [x] **Mozilla PDF.js Hardware-Accelerated Preview** (`PdfViewer.tsx`):
  - Continuous multi-page canvas rendering with high-DPI / Retina display device pixel ratio support.
  - Viewport zoom controls (Zoom In, Zoom Out, Fit to Width) and continuous page indicator.
  - Cache-busting PDF reload streaming and 1-click PDF download action.
- [x] **Overleaf-Style Resizable Layout** (`WorkspaceLayout.tsx`):
  - `react-resizable-panels` implementation featuring multi-view Sidebar, Monaco Editor, and PDF Live Preview with responsive drag handles.
- [x] **Virtual Project File System (VFS)** (`FileTree.tsx`):
  - Multi-file project support (`.tex`, `.bib`, `.sty`, `.cls`, `.json`).
  - Binary image asset upload (PNG, JPG, PDF) with inline image preview.
  - File create, rename, and delete safeguards (`main.tex` protection).
  - 1-click project export to `.zip` via `jszip` and `file-saver`.
- [x] **Starter Template Gallery** (`templates/index.ts`, `TemplateModal.tsx`):
  - **Academic Research Paper**: Standard journal/conference layout with abstract, equations, tables, and BibTeX.
  - **Professional Resume / CV**: ATS-friendly technical resume layout.
  - **Beamer Presentation**: Conference slide deck styling with Metropolis/Madrid structure.
  - **Minimal Starter**: Clean, lightweight scientific note template.

---

## ⚙️ Phase 1: Local & Server Compilation Pipeline `[COMPLETED]`

- [x] **Isolated Workspace Execution Sandbox** (`compiler.ts`):
  - Node.js compilation worker generating ephemeral build directories (`/tmp/latexer-builds/<uuid>`).
  - Path sanitization to prevent directory traversal attacks on uploaded filenames.
  - In-memory PDF streaming buffer cache (`pdfCache`) with automated 1-hour TTL garbage collection.
- [x] **Native Engine Auto-Discovery & Multi-Engine Dispatcher** (`compiler.ts`):
  - Host executable probing across system `$PATH` and macOS distribution paths (`/Library/TeX/texbin`, `/opt/homebrew/bin`, `/usr/local/texlive`).
  - Native runtime dispatching: **Tectonic**, **latexmk**, **pdflatex**, and **xelatex**.
  - Tectonic Cloudflare bundle caching for instant on-demand LaTeX package resolution.
  - Host engine setup guide modal (`HostSetupModal.tsx`) with Homebrew / MacTeX installation commands.
- [x] **Zero-Dependency Fallback PDF Generator** (`fallbackPdf.ts`):
  - Generates lightweight PDF document if no host compiler is installed, guiding the user to install Tectonic.
- [x] **Structured TeX Log Diagnostic Parser** (`logParser.ts`):
  - Parses raw terminal logs into structured errors, warnings, and bad box (`\hbox` / `\vbox`) records.
  - Extracts exact file context, line numbers (`l.<num>`), and code snippets.
- [x] **Monaco Diagnostic Marker Synchronization**:
  - Maps parser errors directly into Monaco squiggly underlines (`monaco.editor.setModelMarkers`).
  - Synchronized bottom diagnostic drawer (`LogsDrawer.tsx`) with category filtering (All, Errors, Warnings) and raw console view.
  - 1-Click **"Jump to Line"** action navigating Monaco directly to the offending line.

---

## 🎨 Phase 2: Design Token System & Tailwind CSS v4 `[COMPLETED]`

- [x] **Tailwind CSS v4 Integration**:
  - Configured `@tailwindcss/vite` v4 plugin with zero-runtime overhead.
  - Unified `@theme` design tokens in `index.css`:
    - Semantic brand accents: `--color-brand` (`#00b875`), `--color-brand-glow`, `--color-accent-blue`.
    - Surface elevations: `--color-app` (`#0b0f17`), `--color-sidebar`, `--color-editor`, `--color-preview`, `--color-card`.
    - Modern typography tokens: Google Fonts Inter (UI) & JetBrains Mono / Fira Code (Editor & Snippets).
- [x] **Modular Component Architecture**:
  - Replaced monolithic styling with atomic utility classes and scoped CSS modules.
  - Enterprise `cn()` utility in `client/src/lib/utils.ts` combining `clsx` and `tailwind-merge`.
  - Polished micro-interactions: smooth transitions, custom dark scrollbars, glowing status pills, and backdrop blur.

---

## 🤖 Phase 3: Dual AI Copilot, VS Code Activity Bar & Multi-View Sidebar `[COMPLETED]`

- [x] **Dual AI Engine Architecture (Groq LPU & Google Gemini)** (`aiService.ts`, `aiApi.ts`, `useAiStore.ts`):
  - **Groq LPU Ultra-Fast Acceleration**: Sub-300ms completion speeds (~250+ tokens/sec) for publication-grade grammar, academic writing, and LaTeX equations via **GPT-OSS 120B** (`openai/gpt-oss-120b`), **Qwen 3.8 27B** (`qwen/qwen3.8-27b`), and **GPT-OSS 20B** (`openai/gpt-oss-20b`).
  - **Google Gemini Engine**: Native support for **Gemini 3.8 Flash**, **Gemini 3.6 Flash**, and **Gemini 3.1 Pro**.
  - Clean API key management: untracked `.env` backend keys with client override capability in `localStorage`.
- [x] **VS Code-Style Activity Bar Rail** (`ActivityBar.tsx`):
  - 46px leftmost vertical navigation rail.
  - Quick-switch view icons:
    - 📁 **File Explorer** (`⌘⇧E` / `Ctrl+Shift+E`) with live project file-count badge.
    - 🔍 **Search in Project** (`⌘⇧F` / `Ctrl+Shift+F`) with global search and replace across virtual files.
    - ✨ **AI Copilot** with active model indicator pill.
    - 📑 **Document Outline** (`ListTree`) with structural LaTeX element parser.
    - ⚙️ **Settings Gear** at the bottom rail opening the engine & AI settings dialog.
- [x] **Multi-View Sidebar Panels**:
  - `SearchPanel.tsx`: Full-text search and replace across all project files with case-sensitivity, file match grouping, and click-to-jump to editor line.
  - `OutlinePanel.tsx`: Parsed LaTeX outline (`\section`, `\subsection`, `table`, `figure`, `equation`) with line jump navigation.
  - `AiPanel.tsx`: Dedicated sidebar AI view with quick action chips (*Fix Errors*, *Academic Polish*, *Add Comments*) and 1-click Monaco insertion.
- [x] **Inline AI Command Palette (`⌘ + K`)** (`InlineCommandPalette.tsx`):
  - Floating Monaco overlay triggered anywhere in the document.
  - Selection-aware prompt execution: replaces selected code with refined LaTeX or generates new sections at the cursor in <250ms via Groq.
- [x] **Streamlined Top Title Bar** (`TopNav.tsx`):
  - Cleaned up duplicate and redundant buttons for a sleek, uncluttered header experience.

---

## 🧠 Phase 4: Agentic Intelligence, Research Synthesis & Writing Humanization `[COMPLETED]`

### 4.1 ChatPanel Architecture & Activity Bar Rail Navigation (`ActivityBar.tsx`, `AiPanel.tsx`) `[COMPLETED]`
- [x] **Activity Bar Rail First-Class Navigation**:
  - Reorganized AI and research tools into dedicated top-level icons on the leftmost vertical Activity Bar rail:
    - 🤖 **Autonomous Agent** (`agent`): Goal composer, multi-step tool calls, execution diffs.
    - 💬 **Copilot Chat** (`chat`): Multi-turn conversational AI with active model indicator.
    - 📖 **Reference Papers** (`papers`): Universal academic web search, download redirection, literature synthesis.
    - 🛡️ **AI Detector & Humanizer** (`humanizer`): Sentence perplexity scanner & academic rhythm rewriter.
  - Removed internal pill switcher buttons from `AiPanel`, giving each panel full height and clean standard headers.
- [x] **Copilot Chat Interface & Formatting**:
  - [x] Multi-turn conversational history maintaining author-copilot dialogue.
  - [x] Interactive LaTeX code cards with syntax badges, copy button, and 1-click Monaco cursor insertion (`insertAtCursor`).
  - [x] 4 one-click starter quick action chips (*Polish Academic Tone*, *Add Math Equation*, *Create Table*, *Fix LaTeX Errors*).
  - [x] **Rich Markdown Message Renderer**: Render bold, italics, bullet lists, numbered lists, headings, and inline math/code instead of raw markdown characters.
  - [x] **Auto-Resizing Composer Textarea**: Dynamic height expansion up to 160px with `Enter` (send) and `Shift + Enter` (newline) handling.
  - [x] **Dynamic Provider Placeholders & Sender Metadata**: Contextual placeholders matching active engine and immutable provider branding on message bubbles.
  - [x] **Document Context & Selection Toggle**: Toggle switch for `[x] Include Document Context` and active selection line-count badge.
  - [x] **Thread Persistence**: Store recent conversation history in `localStorage` so chats survive browser refreshes.
- [x] **Autonomous Agent Workspace UI**:
  - [x] Goal composer with pre-configured task chips (*Fix Errors*, *Booktabs Tables*, *BibTeX Citations*, *Math Appendix*).
  - [x] Clean user message box and direct agent response card (no redundant headers or emoji clutter).
  - [x] Interactive tool call cards displaying tool icon, execution state badges (`running`, `success`, `error`), and error diagnostics.
  - [x] Live syntax diff cards showing surgical file modifications (`- target` / `+ replacement`).
  - [x] Step progress counter (`Step X/10`) with live execution footer.
  - [x] **Execution Cancellation & Status Badges**: `AbortController` integration with responsive `Stopped` / `Aborted` state indicators.
  - [x] **Expandable Tool Data Inspector**: Collapsible drawer revealing returned search results, line numbers, and raw compiler diagnostic logs.

### 4.2 Autonomous Agent Mode & Prompt Architecture (`prompts.ts`) `[COMPLETED]`
- [x] **Modular Prompt Architecture (`prompts.ts`)**:
  - Domain-specific prompt generators inspired by modern AI IDE architectures (`buildAgentSystemPrompt`, `buildChatSystemPrompt`, `buildInlineEditPrompt`).
  - Dynamic `<workspace_context>` injection (active file, open files list, compiler engine).
  - **Fast-Path Intent Detection**: Zero tool calls for greetings (*"hi"*, *"who are you"*) and conceptual/academic queries; direct friendly responses without over-inspecting the workspace.
  - **Anti-Narration Rule**: Prohibits routine narration ("I will now call read_file") to keep agent execution clean and direct.
  - **Reasoning Isolation**: Internal model reasoning (`choice.message.reasoning`) is decoupled from user-facing `content`, preventing monologue leaks into chat bubbles.
- [x] **Autonomous Goal Execution**:
  - Autonomous Agent mode capable of breaking down high-level manuscript and coding goals across the workspace.
  - Iterative `Plan ➔ Act ➔ Observe ➔ Reflect ➔ Verify` execution cycle (up to 10 sequential steps).
- [x] **Interactive Execution Plan Preview** (`ExecutionPlanModal.tsx`):
  - Displays proposed step-by-step roadmap of file edits before modifying workspace files.
  - Allows user approval, step rejection, or single-step execution checkpoints via "Plan First".
- [x] **Automated Test-Compile & Self-Correction**:
  - Automatically triggers compilation via `compile_and_diagnose` after writing code.
  - Inspects compiler diagnostic logs; if syntax errors or missing packages occur, autonomously patches files until the project compiles with 0 errors.

### 4.3 Agent Tool Calling Suite for Workspace File Manipulation `[COMPLETED]`
- [x] Standardized structured Tool Calling API (Groq function calling & Gemini tool declarations):
  - `list_files`: Scan virtual project tree and asset metadata.
  - `read_file(path, start_line?, end_line?)`: Read file contents or line slices.
  - `write_file(path, content)`: Create new files or overwrite existing files.
  - `edit_file(path, target_snippet, replacement_snippet)`: Surgical diff/replacement edits.
  - `delete_file(path)`: Safe file deletion (`main.tex` protected).
  - `search_files(query, case_sensitive?)`: Project-wide grep search across all text files.
  - `compile_and_diagnose(engine?)`: Trigger build and return structured diagnostics to the agent.
- [x] Interactive tool execution badges in the AI sidebar with status chips, result messages, and live diff previews.

### 4.4 Deep Reasoning & Extended Thinking Capacity `[COMPLETED]`
- [x] Support for flagship reasoning models:
  - **DeepSeek-R1 Distill 70B**, **DeepSeek-R1 Distill 32B**, **Gemini 2.0 Flash Thinking**, and Groq reasoning endpoints.
- [x] **Collapsible Thinking Trace UI Component** (`ThinkingTrace.tsx`):
  - Render thought processes inside an expandable `<ThinkingTrace>` component with real-time streaming pulses.
  - Separates internal reasoning (mathematical derivations, proof strategies, structural planning) from the final generated LaTeX code.
- [x] Configurable reasoning effort (Low / Medium / High / Deep) in the AI settings modal and settings store.

### 4.5 Literature Understanding: Universal Academic Search & Base Paper Ingestion `[COMPLETED]`
- [x] **Universal Academic Paper Search Engine Across the Web** (`paperSearch.ts`, `ReferencePapersView.tsx`):
  - Concurrently queries **OpenAlex** (indexing 250M+ scholarly works) and **arXiv** with real-time deduplication.
  - Global academic coverage across **IEEE, Nature, ACM, Springer, Elsevier, ScienceDirect, PubMed, and arXiv**.
  - **Direct Download & Publisher Page Redirection**: Direct external links to official publisher download pages (IEEE Xplore, ScienceDirect, Nature, etc.).
  - **Google Scholar Redirection**: 1-click links opening Google Scholar for institutional library access, proxy downloads, and citation trees.
  - **Scope Filters**: Quick filters for `🌐 All Web`, `⚡ arXiv Direct`, and `🏛️ Journals & IEEE`.
  - **Rich Metadata Badges**: Live citation count indicators (`★ X cites`), publisher badges, and publication years.
  - **1-Click Workspace Ingestion**: Imports paper title, authors, year, and abstract directly into the project library with 0 manual downloads required.
  - **1-Click BibTeX Citation**: Formatted `@article{...}` copying and instant appending to `references.bib`.
- [x] **Multi-Modal Research Paper Ingestion** (`ReferencePapersView.tsx`):
  - Dedicated "My Papers" view: upload base research PDFs (e.g., arXiv downloads, conference papers).
  - Client-side hardware-accelerated PDF extraction parsing text, equations, tables, and references from uploaded base papers via `pdfjs-dist`.
- [x] **Literature Review & Grounded Manuscript Writing**:
  - Ground AI responses on uploaded papers to draft Literature Reviews and Related Work sections with zero hallucinations.
  - Automatic extraction of baseline data to build comparative benchmark tables (`booktabs`).
  - Extract and format cited papers directly into clean BibTeX entries appended to `references.bib`.

### 4.6 Ghost Text AI Inline Code Completions `[COMPLETED]`
- [x] Monaco `InlineCompletionsProvider` delivering real-time gray phantom text as the author types.
- [x] Ultra-fast debounced generation (~150ms via Groq LPU fast inference / Google Gemini).
- [x] Predicts equation completions, math symbols, `\item` enumerations, and academic sentence continuations.
- [x] Standard editor shortcuts: `Tab` to accept ghost text, `Esc` to dismiss, `⌥\` / `Alt+\` to trigger. Copilot toggle badge in editor toolbar.

### 4.7 AI Writing Detection Analysis & Academic Humanizer Engine `[COMPLETED]`
- [x] **AI Writing Detection Scanner** (`HumanizerDetectorView.tsx`):
  - Real-time sentence-level perplexity and burstiness evaluator.
  - Visual heatmap overlay highlighting robotic, repetitive, or formulaic sentences.
  - Overall originality / human-writing score indicator.
- [x] **Academic Humanizer Engine** (`HumanizerDetectorView.tsx`):
  - 1-Click **"Humanize Selection"** and document action.
  - Strips synthetic AI clichés (*"delve into"*, *"testament to"*, *"pivotal role"*, *"moreover"*, *"furthermore"*, *"in conclusion"*).
  - Rewrites text with authentic academic rhythm, varied sentence lengths, natural signposting, and field-appropriate scientific vocabulary while strictly preserving technical accuracy and LaTeX math environments.

---

## 🖥️ Phase 5: Professional IDE Workspace, Application Menu & Settings Hub `[COMPLETED]`

### 5.1 Desktop Application Menu Bar (`File`, `Edit`, `Insert`, `View`, `Format`, `Help`) `[COMPLETED]`
- [x] Desktop-grade application menu bar with interactive dropdown menus, keyboard accelerators, and Monaco event dispatcher:
  - **File**: New File (`.tex`), Upload File, Templates Picker, Download PDF, Export Project ZIP, Settings (`⌘,`).
  - **Edit**: Undo (`⌘Z`), Redo (`⌘⇧Z`), AI Inline Assistant (`⌘K`), Toggle AI Sidebar, Clear AI Chat.
  - **Insert**: Section, Subsection, Figure environment (`graphicx`), Table environment (`tabular`), Equation environment (`equation`), Citation (`\cite`), Footnote (`\footnote`).
  - **View**: Split View, Code Focus (Editor Only), Reading Focus (PDF Only), Toggle Logs & Diagnostics (`⌘J`), Reset Layout Proportions.
  - **Format**: Bold (`\textbf`), Italic (`\textit`), Monospace Code (`\texttt`), Itemize (Bullet list), Enumerate (Numbered list).
  - **Help**: Interactive Keyboard Shortcuts, LaTeX Quick Reference & Cheatsheet modal, Local TeX Engine Setup dialog, About ElseWhere modal.
- [x] **Dynamic Title Bar & Full Document Name**:
  - Center-positioned, adaptive-width document name input (`min-w-[320px]` to `540px`) preventing truncation and showing the complete project title.
  - Streamlined `h-10 min-h-[40px]` navbar height saving vertical screen real-estate for the editor and preview.

### 5.2 Opened File Tab Pills Bar (Multi-File Editor Tabs) `[COMPLETED]`
- [x] Multi-file tab bar positioned above the Monaco LaTeX editor (`EditorTabs.tsx` / `MonacoLatexEditor.tsx`):
  - Displays file pill tabs for all open virtual files (`main.tex`, `references.bib`, `custom.sty`).
  - Active tab highlight with distinct border and background tokens.
  - Close tab (`×`) action button on each tab pill.
  - Context menu on tabs: Close, Close Others, Close All.
  - Shortcuts: `⌘W` to close active tab, `⌘1`–`⌘9` for instant tab switching.

### 5.3 PDF Viewer Toolbar & Smart File Downloads `[COMPLETED]`
- [x] **Top Preview Toolbar Reorganization** (`PdfViewer.tsx`):
  - Recompile button relocated directly to the PDF preview toolbar with compilation spinner and status color transitions.
  - Compact icon-based diagnostics badge (`AlertCircle` for errors, `AlertTriangle` for warnings, `CheckCircle2` for compiled, `Terminal` for ready) with count badges. Clicking toggles compilation logs drawer.
  - Zoom controls (Zoom In, Zoom Out, Fit to Width) and continuous page navigation controls.
- [x] **Project-Named PDF Downloads**:
  - Client-side blob fetching using `saveAs(blob, `${cleanName}.pdf`)` guaranteeing that the browser uses the project name (e.g., `academic_research_manuscript.pdf`) without server `main.pdf` header overrides.
  - Backend `/api/pdf/:buildId` endpoint supporting `?filename=` query parameter and dynamic `Content-Disposition: attachment`.

### 5.4 Hierarchical Folders & Directory Creation in VFS `[IN PROGRESS]`
- [ ] Support nested directory hierarchies in the Virtual File System (e.g., `chapters/intro.tex`, `figures/diagram.png`, `styles/macros.sty`).
- [ ] **Folder Operations**:
  - "New Folder" icon and context menu option in the File Explorer panel.
  - Collapsible tree view with persistent expansion states.
  - Drag-and-drop file organization (move files into folders).
- [ ] **Compiler Sandbox Path Preservation**:
  - Compiler worker preserves relative folder structures so `\input{chapters/intro}` and `\includegraphics{figures/diagram}` compile seamlessly without path errors.

### 5.5 Comprehensive Multi-Category Settings Hub (`SettingsModal.tsx`) `[COMPLETED]`
- [x] Unified, tabbed Settings dialog with deep customization categories:
  - **Appearance**: Editor Theme (Dark / Light / Warm Parchment), Dark Mode PDF toggle, Font Size slider, Font Family (Inter, JetBrains Mono, Fira Code), Line Height slider, Custom PDF background color picker.
  - **Editor**: Word Wrap toggle, Line Numbers mode (`on` / `off`), Bracket Pair Colorization, Code Snippets toggle.
  - **Compiler**: Default engine selection (Auto, Tectonic, LaTeXmk, pdfLaTeX, XeLaTeX), Auto-compile toggle with debouncing.
  - **Spelling & Language**: Spell check toggle, Language selector (en-US, en-GB, fr, de, es).
  - **References**: BibTeX citation management, auto-formatting keys.
  - **Notifications**: Notify on compile error, notify on compilation success.
  - **AI Models & Intelligence**: Provider toggle (Groq LPU vs. Google Gemini), API key management, active model selector.
- [x] **Advanced Document Outline & Section Tree Navigator** (`OutlinePanel.tsx`):
  - Hierarchical LaTeX element parsing (`\section`, `\subsection`, `figure`, `table`, `equation`) with 1-click line jumping.

---

## 🚀 Phase 6: Overleaf Industrial Differentiators `[PLANNED]`

### 6.1 AI Error Doctor (1-Click Auto-Patching) `[TODO]`
- [ ] Add a **"✨ Fix with AI"** button on every diagnostic card in `LogsDrawer.tsx`.
- [ ] Send compiler diagnostic, error snippet, faulty line number, and surrounding 30 lines of code to the AI.
- [ ] Compute minimal replacement hunk and display an interactive diff modal (Before vs. After).
- [ ] 1-Click **"Apply Fix & Recompile"** updating Monaco buffer and triggering an immediate test build.

### 6.2 SyncTeX Bi-Directional Forward & Inverse Navigation `[TODO]`
- [ ] **Build Pipeline Flag**: Enable `--synctex=1` across compilation runs and parse generated `.synctex.gz`.
- [ ] **Forward Search (Editor ➔ PDF)**: `⌘ + Click` on any line in Monaco editor scrolls PDF.js and highlights the target paragraph.
- [ ] **Inverse Search (PDF ➔ Editor)**: `⌘ + Click` on the rendered PDF preview switches Monaco to the source file and scrolls to line.

### 6.3 Smart Bibliography & DOI / arXiv Auto-Fetcher `[TODO]`
- [ ] Quick fetch modal accepting DOI, arXiv ID/URL, or ISBN.
- [ ] Queries CrossRef REST API and arXiv API; transforms response into clean BibTeX entries appended to `references.bib`.
- [ ] Rich citation autocomplete in Monaco: dropdown displays paper title, first author, publication year, and abstract preview.

### 6.4 Isolated Live TikZ & PGFPlots Studio `[TODO]`
- [ ] Dedicated playground isolating `\begin{tikzpicture}` blocks into lightweight standalone templates.
- [ ] Micro-compilation (<100ms) directly to standalone vector SVG or PDF preview.
- [ ] Export diagram directly as standalone `.svg`, `.pdf`, or high-resolution `.png`.

### 6.5 Visual Rendered PDF Diffing `[TODO]`
- [ ] Compare rendered PDF pages between compilation builds, saved checkpoints, or git commits.
- [ ] Visual overlay: highlights added paragraphs/equations in emerald green and deleted items in crimson red directly on the PDF pages.
- [ ] Toggle between split side-by-side mode and opacity slider overlay mode.

### 6.6 Multi-Format Publishing Engine (Pandoc / Quarto) `[TODO]`
- [ ] Export project to Microsoft Word (`.docx`) for non-LaTeX co-authors and journal reviewers.
- [ ] Export to clean GitHub Flavored Markdown (`.md`) and interactive HTML5 research article with KaTeX math rendering.
- [ ] Import from Markdown / Docx into native LaTeX workspace.

---

## 🛡️ Phase 7: Sandboxing, Decoupled Queue & WebAssembly `[PLANNED]`

### 7.1 Rootless Compute Sandboxing
- [ ] Ephemeral rootless Docker containers or Firecracker MicroVMs for untrusted user code compilation.
- [ ] Strict isolation flags: `--net=none`, memory limit (512MB), CPU quota (1 core), strict timeout (30s).
- [ ] Enforce `--untrusted` / `-no-shell-escape` preventing unauthorized host process execution.
- [ ] In-memory `tmpfs` mounts ensuring zero persistent artifact leakage.

### 7.2 WebAssembly (WASM) Zero-Server In-Browser Compilation
- [ ] Integrate WebAssembly TeX engine (e.g. Wasm Tectonic / SwiftLaTeX) running inside a Web Worker.
- [ ] Enables **100% offline, zero-server, private compilation** directly inside the user's browser without requiring any local backend or CLI installation.

### 7.3 Decoupled Job Queue & Content-Addressable Storage (CAS)
- [ ] **BullMQ + Redis**: Asynchronous job queue decoupling user-facing HTTP servers from TeX worker pools.
- [ ] **CAS Caching**: Compute SHA-256 hashes of source files; if hash matches prior build, return cached PDF instantly in 0ms.
- [ ] Cloudflare R2 / AWS S3 object storage for persistent PDF artifacts, project bundles, and figure assets.

---

## 👥 Phase 8: Multiplayer Real-Time Collaboration & Git Sync `[PLANNED]`

### 8.1 Yjs CRDT Synchronization Engine
- [ ] Integrate **Yjs** CRDTs with `y-monaco` and WebSocket / WebRTC signaling server.
- [ ] Real-time multi-user typing with sub-50ms latency.
- [ ] Colored live user cursors, presence avatars, and selection highlights in Monaco editor.

### 8.2 Track Changes & Review Mode
- [ ] Suggestion mode: visual inline additions (green) and deletions (red strike-through).
- [ ] Author Accept / Reject diff controls per hunk.
- [ ] Threaded inline comments anchored to specific lines with `@mention` notifications.

### 8.3 Bi-Directional Git Synchronization
- [ ] Virtualized Git repository per project with commit history graph.
- [ ] Two-way GitHub and GitLab repository synchronization (push, pull, conflict resolution).

---

## 🏢 Phase 9: Enterprise Identity, Governance & Cloud Scale `[PLANNED]`

### 9.1 Database & Persistence
- [ ] PostgreSQL database with Drizzle ORM managing Users, Organizations, Workspaces, and Projects.
- [ ] Comprehensive audit logging and project version snapshots.

### 9.2 Identity & Role-Based Access Control (RBAC)
- [ ] Granular workspace permissions: **Owner**, **Maintainer**, **Author**, **Reviewer**, **Viewer**.
- [ ] Academic Single Sign-On (SSO): ORCID OAuth, Google Workspace, and Shibboleth / SAML / EduGAIN.

### 9.3 Production Orchestration & Observability
- [ ] Production deployment orchestration:
  - `docker-compose.prod.yml` (Nginx, API server, TeX workers, PostgreSQL, Redis, MinIO).
  - Production Kubernetes Helm charts with horizontal pod autoscaling (HPA) for TeX workers.
- [ ] Full-stack observability: Prometheus metrics, Grafana dashboards, OpenTelemetry distributed tracing, and Sentry error monitoring.
