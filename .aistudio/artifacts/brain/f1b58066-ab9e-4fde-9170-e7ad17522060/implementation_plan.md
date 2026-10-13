# Implementation Plan - Task Card Navigation to Daily Report Edit

## User Review & Critical Decisions

> [!IMPORTANT]
> - **Direct Report Edit Navigation**: When a user clicks on any task card (papan tugas) in the Kanban board (`TasksView`), it will now navigate directly to the Daily Report detail page (`/laporan`) for the corresponding report, automatically opening it in Edit mode.
> - **Preservation of Existing State & Data**: No data structures, database schemas, or general navigation flows are altered. All existing functionality and hardware-accelerated CSS / smooth motion are fully maintained.

- **Confirmed Decision**: Clicking a Kanban task card transitions the view to `/laporan` (`report-detail` view) with `isEditing = true` for the matched daily report.
- **Fallback Handling**: If a task does not have an explicit `report_id` or `daily_report_id`, we match by title/assignee or select the latest matching report, ensuring zero dead clicks.

---

## 1. Overview & Core Concept

- **What It Does**: Enhances the Kanban board workflow so that clicking any task card directly brings the user to the corresponding report edit interface on the Daily Report page (`/laporan`), enabling seamless cross-navigation between task management and daily reporting.
- **Target Audience / Persona**: Creative team members and managers reviewing and updating task deliverables and reports.
- **Key Value**: Eliminates friction in the daily workflow by connecting task cards directly to their corresponding report editing form.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. User navigates to Tasks / Kanban (`/tugas`).
  2. User clicks on any task card (e.g., "Mencari Sound Untuk Opening Futsal").
  3. The app smoothly transitions to the Daily Report page (`/laporan`), loading the specific report and opening the `DailyReportForm` in `mode="edit"`.
- **Interactive Feedback & Motion**:
  - Smooth hardware-accelerated transitions (`transform`, `opacity`, CSS transitions with `will-change`) and toast notifications confirming navigation/edit state.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1**: Mapping Task to Daily Report.
  - *Chosen Approach*: Match task by `report_id` / `daily_report_id` first, fallback to matching title and assignee against available reports.
  - *Why*: Ensures 100% robust linking between Kanban tasks and daily reports even across different creation pathways.
- **Decision 2**: Opening Report in Edit Mode directly.
  - *Chosen Approach*: Pass `initialIsEditing = true` or set initial edit state when navigating from a task click.
  - *Why*: Directly satisfies the user requirement ("langsung ke bagian edit laporan, di page laporan harian").

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────┐          Task Card Click          ┌─────────────────────────┐
│     TasksView (Kanban)  │ ──────────────────────────────> │    App.tsx Router       │
└─────────────────────────┘                                   └───────────┬─────────────┘
                                                                          │
                                                           Find & Set Selected Report ID
                                                           Set Initial Edit Mode = true
                                                                          │
                                                                          v
                                                              ┌─────────────────────────┐
                                                              │   ReportDetailView      │
                                                              │   (with isEditing=true) │
                                                              └─────────────────────────┘
```

- **State Updates**:
  - Add `onSelectReportForEdit?: (reportId: string) => void` prop to `TasksView`.
  - In `App.tsx`, implement the handler to find the matching report, set `selectedReportId`, set `reportInitialEdit = true`, and switch `currentView` to `'report-detail'`.
  - In `ReportDetailView`, support `initialIsEditing` prop so `isEditing` defaults to `true` when navigated from a task card.
