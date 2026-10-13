# Implementation Plan - Disable Kanban Add Task & Fix Drag-and-Drop Stability

## User Review & Critical Decisions

> [!IMPORTANT]
> - **Disable Add Task Buttons on Kanban**: Remove the "+ Tambah Tugas" buttons from all columns in `TasksView`. Tasks are now managed exclusively via Daily Reports.
> - **Fix Drag-and-Drop Jumpiness / Bug**: Refine `handleDragOver`, `handleDrop`, and touch move/end handlers in `TasksView` to accurately determine the drop target column using `e.currentTarget` and validated bounding rects, preventing cards from randomly jumping to 'To Do' or 'Review'.
> - **Hardware-Accelerated CSS & Motion**: Ensure card dragging states and dropzone highlights utilize GPU-accelerated CSS (`transform: translate3d(...)`, `will-change: transform`, `transition: all 0.2s cubic-bezier(...)`).

---

## 1. Overview & Core Concept

- **What It Does**: 
  1. Removes the "+ Tambah Tugas" mini buttons at the bottom of Kanban columns in `TasksView`.
  2. Stabilizes drag-and-drop mechanics to prevent erratic column jumping during drag/drop operations.
  3. Enhances visual fluidity and animation performance using hardware-accelerated CSS properties.

---

## 2. Technical Changes in `TasksView.tsx`

- **Remove Add Task UI**: Delete the `<button className="add-task-mini">...</button>` block inside column rendering.
- **Robust Drop Zone Detection**:
  - In `handleDrop(e, colFromProp)` and touch end handlers, rely strictly on `data-col-id` from `e.currentTarget` or element closest container with bounds checking rather than flawed pointer coordinates.
  - Prevent event bubbling and default behaviors cleanly.
- **Hardware-Accelerated CSS & Motion**:
  - Ensure `.kcard.dragging` and `.kcol.dragover` use GPU acceleration (`will-change: transform`, `transform: translateZ(0)`).

---

## 3. Verification Plan

- Compile with `compile_applet` and test drag-and-drop behavior across columns.
