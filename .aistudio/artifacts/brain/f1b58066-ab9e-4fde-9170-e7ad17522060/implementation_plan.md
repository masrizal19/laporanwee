# Implementation Plan — Viewport Render Unblocking & Direct Card Mounting

Disable all viewport render blockers (IntersectionObserver, content-visibility, or virtual listing) on daily report views (`LaporanView.tsx` & `ReportsView.tsx`), ensuring all report items render directly into the DOM on initial page mount with instant fade-in animations and zero scroll-triggered delay.

## Confirmed User Decisions

- **Animation Style**: Smooth instant fade-in animation (`animate-fadeIn`) on mount without scroll delay.
- **Report Limit**: Render all reports directly without virtual list pagination or 30-item slice limits.

---

## 1. Overview & Goal

Prevent Chrome/Edge viewport render suppression where report cards remain transparent/blank until the user scrolls the mouse. All report cards stored in Fast Cache memory will map directly to the DOM in a 3-column grid container with explicit `opacity: 1` CSS state and immediate on-mount keyframe animation.

---

## 2. User Experience & Visual Design

- **Zero-Wait Card Rendering**: Cards render in DOM immediately upon component mount.
- **Instant Fade-In**: Clean CSS `@keyframes cardFadeIn` with `animation-fill-mode: forwards` (no static `opacity: 0` resting state).
- **Glassmorphism & Theme Integrity**: Preserves all floating sidebar, glassmorphism card surfaces, counter chips, dark/light theme tokens, and preview lightbox triggers.

---

## 3. Key Technical Decisions

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Root FastDataContext                         │
│         (0ms Persistent In-Memory Store & localStorage Hydration)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Instant Array Access
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                LaporanView.tsx & ReportsView.tsx                      │
│   • Direct .map() of ALL filtered reports into 3-column grid           │
│   • data-motion="none" + animate-fadeIn (0ms mount trigger)            │
│   • Zero content-visibility or opacity: 0 resting rules                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Flex/Grid Container Layout
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        MainLayout & Parent Shell                       │
│   • Validated flex-1 min-h-0 container overflow geometry              │
│   • Non-zero height calculation on initial render frame                │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Purge Content-Visibility & Observer Blockers**:
   - Verify no `content-visibility: auto` or `[content-visibility:auto]` rules exist in CSS/Tailwind.
   - Set `data-motion="none"` on report card containers so external observer scripts (`laporanwe-motion.js`) never attach `.lw-reveal` (which sets `opacity: 0`).

2. **Direct Unrestricted DOM Mapping**:
   - Render `filteredReports.map()` directly without slicing or virtual list pagination.
   - Use standard CSS grid layout (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`).

3. **Parent Overflow & Container Geometry**:
   - Ensure `MainLayout` and view parent wrapper containers use explicit `min-h-0 flex-1 w-full` styling so flex child scroll containers do not collapse to 0px height prior to scroll.

---

## 4. Execution Steps

1. **CSS Audit**: Confirm `src/index.css` contains `@keyframes cardFadeIn` and `.animate-fadeIn` with `animation-fill-mode: forwards` and zero `content-visibility: auto`.
2. **LaporanView & ReportsView Updates**:
   - Ensure card container renders `filteredReports.map()` directly into DOM.
   - Apply `data-motion="none"` and `className="... animate-fadeIn"`.
   - Dispatch immediate `scroll` and `resize` events in `useEffect` on data mount frame.
3. **Parent Container Geometry Check**:
   - Verify `MainLayout.tsx` and main view containers have explicit flex/grid container dimensions (`min-h-0 flex-1`).
4. **Verification**:
   - Execute `compile_applet` and `lint_applet` to ensure 0 build or lint errors.
