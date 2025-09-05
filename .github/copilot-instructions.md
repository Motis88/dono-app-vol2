# GitHub Copilot — Project Instructions (dono-app-vol2)

## TL;DR
- After **every** code change you propose, append:
  1) **Windows CMD/PowerShell commands** to run/build/test.
  2) **Git commands** (add + commit + push) using **Conventional Commits** with a clear scope.
- Do **not** rename files, components, storage keys, or change UI/RTL text without explicit request.

---

## Project Overview
- App: **dono-app-vol2** — veterinary blood bank operations (dogs/cats donors, blood types, plasma/packed cells, locations).
- Stack: **React + Vite**, **Capacitor (Android)**. Components in `src/components`, helpers in `src/utils`.
- Persistence: `localStorage` and JSON export/backup via `@capacitor/filesystem`.
- Large tables: **react-window** (virtualized lists).

### Important paths (don’t change unless asked)
- `src/components/TablesByLocation.jsx`
- `src/components/DonorDashboard.jsx`
- `src/components/ExternalCells.jsx`
- `src/utils/storage.js`, `src/utils/donorUtils.js`

### Domain terms / data
- Dogs: DEA 1.1 ± ; Cats: A/B/AB.
- Products: Plasma, Packed RBC (PC), Whole blood.
- Common locations: "Rehovot", "Igud Irim Dan", "Ptahia", "Holon", "External".
- Storage keys: e.g., `"animal_donors"` — **do not rename**.

---

## Coding Guidelines
1) **UI & backward compatibility**
   - Don’t break internal APIs, component names, or JSON formats.
   - New labels must be bilingual where relevant (Heb/Eng); respect RTL/LTR.

2) **React**
   - Functional components + hooks; no side effects in render (use `useEffect`).
   - For big data lists, keep **react-window**; add `memo`, `useMemo`, `useCallback` where helpful.
   - Accessibility: buttons with meaningful `aria-label`.

3) **Capacitor (Android)**
   - Use `@capacitor/filesystem`; handle runtime permissions (Android 13+).
   - If writing to `Documents` fails with EACCES, fall back to **Share Intent**.
   - Keep dependencies light; avoid unnecessary native plugins.

4) **Performance**
   - Virtualize tables; avoid loading huge JSONs into DOM at once.

5) **Errors & Logs**
   - Clear error messages; reduce noisy `console.log` in production.

---

## Required Output Footer after every change
After each code snippet/change, append:

**Windows CMD / PowerShell**
- commands to install, run Vite, build, or test.

**Git (Conventional Commits)**
- `git add -A`
- `git commit -m "type(scope): short message"`
- `git push`

Examples of `type(scope)`: `feat(donors)`, `fix(storage)`, `perf(table)`, `docs(readme)`, `build/android`, `chore(deps)`.

---

## Examples (templates)

### Adding a new util function
**CMD/PowerShell**
```bat
cd C:\dono-app-vol2
npm i
npm run dev