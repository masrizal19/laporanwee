import React, { useState, useRef, useEffect } from 'react';
import { Task, TaskStatus, PriorityLevel, Project, TaskDocument, TeamMember } from '../types';
import { Icon } from '../components/icons';
import { Modal } from '../components/Modal';
import { taskDocumentsService, validateTaskDocumentFile, formatFileSize } from '../utils/taskDocuments';
import { MediaViewerModal } from '../components/MediaViewerModal';
import { computeTargetProgress, getAbsoluteAvatarUrl } from '../utils/api';

interface TasksViewProps {
  tasks: Task[];
  projects: Project[];
  members?: TeamMember[];
  isAdmin?: boolean;
  onAddTask: (task: Omit<Task, 'id'>) => void;
  onUpdateTask: (task: Task) => Promise<boolean> | boolean | void;
  onDeleteTask: (taskId: string) => void;
  onResetTasks?: () => void;
  onRefreshTasks?: () => void;
  onAddToast: (text: string) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  projects,
  members = [],
  isAdmin = false,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onResetTasks,
  onRefreshTasks,
  onAddToast,
}) => {
  const [filter, setFilter] = useState<'All' | 'High' | 'Done'>('All');
  const [search, setSearch] = useState('');
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [activeDropZone, setActiveDropZone] = useState<TaskStatus | null>(null);
  const isSubmittingDropRef = useRef(false);
  const touchStartRef = useRef<{ id: string; startX: number; startY: number } | null>(null);

  // Modal State for New Task
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [defaultCol, setDefaultCol] = useState<TaskStatus>('todo');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskProj, setNewTaskProj] = useState(projects[0]?.name || 'Creative Sprint');
  const [newTaskPriority, setNewTaskPriority] = useState<PriorityLevel>('High');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('Besok');

  // Modal State for Editing Task
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Task Documentation State
  const [taskDocs, setTaskDocs] = useState<TaskDocument[]>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOverDropzone, setIsDragOverDropzone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Media Viewer / Lightbox State
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Delete Confirmation State
  const [docToDelete, setDocToDelete] = useState<TaskDocument | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Load documents when editing task opens
  useEffect(() => {
    if (editingTask) {
      taskDocumentsService
        .getDocuments(editingTask.id, editingTask.documents || [])
        .then((docs) => {
          setTaskDocs(docs);
        });
    } else {
      setTaskDocs([]);
      setIsUploadingDoc(false);
      setUploadProgress(0);
      setDocToDelete(null);
    }
  }, [editingTask?.id]);

  // Upload Documentation Handler
  const handleUploadFile = async (files: FileList | File[]) => {
    if (!editingTask) return;
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    const file = fileList[0];
    const validation = validateTaskDocumentFile(file);
    if (!validation.valid) {
      onAddToast(validation.error || 'Gagal mengunggah dokumentasi.');
      return;
    }

    const localUrl = URL.createObjectURL(file);
    const isVideo = validation.fileType === 'video';
    const tempId = 'temp-' + Date.now();

    const tempDoc: TaskDocument = {
      id: tempId,
      task_id: String(editingTask.id),
      uploader_name: 'Tim LaporanWee',
      file_name: file.name,
      file_url: localUrl,
      file_type: isVideo ? 'video' : 'image',
      mime_type: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
      file_size: file.size,
      file_size_formatted: formatFileSize(file.size),
      thumbnail_url: isVideo ? undefined : localUrl,
      created_at: new Date().toISOString(),
    };

    // Instant local preview without waiting for API response
    setTaskDocs((prev) => [tempDoc, ...prev]);
    setIsUploadingDoc(true);
    setUploadProgress(20);

    try {
      // Get current logged in user name if available
      let uploaderName = 'Tim LaporanWee';
      try {
        const storedUser = localStorage.getItem('laporanwee_user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          if (parsed?.name || parsed?.full_name) {
            uploaderName = parsed.name || parsed.full_name;
          }
        }
      } catch (_) {}

      const newDoc = await taskDocumentsService.uploadDocument(
        editingTask.id,
        file,
        uploaderName,
        (pct) => setUploadProgress(pct)
      );

      setTaskDocs((prev) => {
        const filtered = prev.filter((d) => d.id !== tempId);
        const updatedDocs = [newDoc, ...filtered];
        taskDocumentsService.saveDocuments(editingTask.id, updatedDocs);

        // Update parent task state immediately so upload is independent of "Simpan Perubahan"
        const updatedTask: Task = {
          ...editingTask,
          documents: updatedDocs,
        };
        setEditingTask(updatedTask);
        onUpdateTask(updatedTask);

        return updatedDocs;
      });

      onAddToast('Dokumentasi berhasil ditambahkan.');
    } catch (err: any) {
      onAddToast(err?.message || 'Gagal mengunggah dokumentasi.');
      // Keep preview even if upload fails as requested
    } finally {
      setIsUploadingDoc(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Confirm and Delete Documentation Handler
  const handleConfirmDeleteDoc = async () => {
    if (!editingTask || !docToDelete) return;

    try {
      await taskDocumentsService.deleteDocument(editingTask.id, docToDelete.id);
      const updatedDocs = taskDocs.filter((d) => d.id !== docToDelete.id);
      setTaskDocs(updatedDocs);
      taskDocumentsService.saveDocuments(editingTask.id, updatedDocs);

      const updatedTask: Task = {
        ...editingTask,
        documents: updatedDocs,
      };
      setEditingTask(updatedTask);
      onUpdateTask(updatedTask);

      onAddToast('Dokumentasi berhasil dihapus.');
    } catch (_) {
      onAddToast('Gagal menghapus dokumentasi.');
    } finally {
      setDocToDelete(null);
    }
  };

  const columns: { col: TaskStatus; label: string; dotColor: string }[] = [
    { col: 'todo', label: 'To Do', dotColor: 'var(--muted)' },
    { col: 'inprogress', label: 'Sedang Dikerjakan', dotColor: 'var(--violet)' },
    { col: 'review', label: 'Dalam Review', dotColor: '#8a5a10' },
    { col: 'done', label: 'Selesai', dotColor: '#1e6e56' },
  ];

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'High' && t.priority !== 'High') return false;
    if (filter === 'Done' && t.col !== 'done') return false;
    if (
      search.trim() &&
      !t.title.toLowerCase().includes(search.toLowerCase()) &&
      !t.proj.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingTaskId(id);
  };

  const handleDragOver = (e: React.DragEvent, col: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (activeDropZone !== col) {
      setActiveDropZone(col);
    }
  };

  const handleDragLeave = (e: React.DragEvent, col: TaskStatus) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (activeDropZone === col) {
        setActiveDropZone(null);
      }
    }
  };

  const handleDragEnd = () => {
    setDraggingTaskId(null);
    setActiveDropZone(null);
  };

  const executeDrop = async (task: Task, targetCol: TaskStatus) => {
    if (task.col === targetCol || isSubmittingDropRef.current) return;

    const targetProgress = computeTargetProgress(task.progress, targetCol);
    const updated: Task = {
      ...task,
      col: targetCol,
      progress: targetProgress,
    };

    const statusLabel =
      targetCol === 'done'
        ? 'Selesai'
        : targetCol === 'inprogress'
        ? 'Sedang Dikerjakan'
        : targetCol === 'review'
        ? 'Dalam Review'
        : 'To Do';

    isSubmittingDropRef.current = true;
    try {
      const ok = await onUpdateTask(updated);
      if (ok !== false) {
        onAddToast(`Status tugas dan laporan kerja berhasil diperbarui ke "${statusLabel}".`);
      }
    } finally {
      isSubmittingDropRef.current = false;
    }
  };

  const handleDrop = async (e: React.DragEvent, colFromProp: TaskStatus) => {
    e.preventDefault();
    e.stopPropagation();

    // Accurately detect target column based on client pointer coordinates
    let targetCol: TaskStatus = colFromProp;
    try {
      const dropEl = document.elementFromPoint(e.clientX, e.clientY);
      const colEl = dropEl?.closest('[data-col-id]') as HTMLElement | null;
      const detected = colEl?.getAttribute('data-col-id') as TaskStatus | null;
      if (detected && ['todo', 'inprogress', 'review', 'done'].includes(detected)) {
        targetCol = detected;
      }
    } catch (_) {}

    const taskId = e.dataTransfer.getData('text/plain') || draggingTaskId;
    setDraggingTaskId(null);
    setActiveDropZone(null);

    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    await executeDrop(task, targetCol);
  };

  // Touch device support (mobile / tablet drag & drop)
  const handleTouchStart = (e: React.TouchEvent, id: string) => {
    const touch = e.touches[0];
    touchStartRef.current = { id, startX: touch.clientX, startY: touch.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    const diffX = Math.abs(touch.clientX - touchStartRef.current.startX);
    const diffY = Math.abs(touch.clientY - touchStartRef.current.startY);

    if (diffX > 12 || diffY > 12) {
      if (draggingTaskId !== touchStartRef.current.id) {
        setDraggingTaskId(touchStartRef.current.id);
      }
      try {
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        const colEl = element?.closest('[data-col-id]') as HTMLElement | null;
        const detected = colEl?.getAttribute('data-col-id') as TaskStatus | null;
        if (detected && ['todo', 'inprogress', 'review', 'done'].includes(detected)) {
          setActiveDropZone(detected);
        }
      } catch (_) {}
    }
  };

  const handleTouchEnd = async (e: React.TouchEvent) => {
    if (!touchStartRef.current || !draggingTaskId) {
      touchStartRef.current = null;
      setDraggingTaskId(null);
      setActiveDropZone(null);
      return;
    }

    const taskId = touchStartRef.current.id;
    touchStartRef.current = null;
    const touch = e.changedTouches[0];
    let targetCol: TaskStatus | null = activeDropZone;
    try {
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      const colEl = element?.closest('[data-col-id]') as HTMLElement | null;
      const detected = colEl?.getAttribute('data-col-id') as TaskStatus | null;
      if (detected && ['todo', 'inprogress', 'review', 'done'].includes(detected)) {
        targetCol = detected;
      }
    } catch (_) {}

    setDraggingTaskId(null);
    setActiveDropZone(null);

    if (!targetCol || !['todo', 'inprogress', 'review', 'done'].includes(targetCol)) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    await executeDrop(task, targetCol);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    onAddTask({
      proj: newTaskProj || (projects[0]?.name || 'Creative Sprint'),
      title: newTaskTitle.trim(),
      priority: newTaskPriority,
      assignee: newTaskAssignee || '',
      due: newTaskDue || 'Besok',
      progress: defaultCol === 'done' ? 100 : 0,
      col: defaultCol,
    });

    setIsAddOpen(false);
    setNewTaskTitle('');
    setNewTaskAssignee('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    const ok = await onUpdateTask(editingTask);
    if (ok !== false) {
      onAddToast(`Tugas "${editingTask.title}" diperbarui!`);
      setEditingTask(null);
    }
  };

  const renderAssigneeAvatar = (assignee?: string) => {
    if (!assignee) {
      return (
        <div
          className="kcard-avatar-fallback"
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: 'var(--violet-bg, #ede9fe)',
            color: 'var(--violet, #7c3aed)',
            fontSize: '10px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(0,0,0,0.06)',
            flexShrink: 0,
          }}
        >
          <Icon name="user" style={{ width: 12, height: 12 }} />
        </div>
      );
    }

    if (
      assignee.startsWith('http://') ||
      assignee.startsWith('https://') ||
      assignee.startsWith('data:') ||
      assignee.startsWith('blob:')
    ) {
      return (
        <img
          src={assignee}
          alt="Assignee"
          style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }}
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
      );
    }

    // Check if assignee matches any team member in members list
    const foundMember = members.find(
      (m) =>
        m.name?.toLowerCase() === assignee.toLowerCase() ||
        m.full_name?.toLowerCase() === assignee.toLowerCase() ||
        m.email?.toLowerCase() === assignee.toLowerCase()
    );

    const memberAvatar = foundMember
      ? (foundMember.img || (foundMember.avatar_url ? getAbsoluteAvatarUrl(foundMember.avatar_url, foundMember.name) : undefined))
      : undefined;

    if (memberAvatar) {
      return (
        <img
          src={memberAvatar}
          alt={assignee}
          style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }}
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
      );
    }

    const initials = (foundMember?.full_name || foundMember?.name || assignee)
      .substring(0, 2)
      .toUpperCase();

    return (
      <div
        className="kcard-avatar-fallback"
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'var(--violet-bg, #ede9fe)',
          color: 'var(--violet, #7c3aed)',
          fontSize: '10px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(0,0,0,0.06)',
          flexShrink: 0,
        }}
        title={assignee}
      >
        {initials}
      </div>
    );
  };

  return (
    <div className="view">
      {/* Page Head */}
      <div className="page-head">
        <div>
          <h1>Papan Tugas (Kanban)</h1>
          <p className="sub">
            Atur dan pindahkan alur kerja tim dari perencanaan hingga selesai dengan drag &amp; drop real-time.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {onRefreshTasks && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onRefreshTasks()}
              title="Refresh daftar tugas dari MySQL database"
            >
              <Icon name="refresh" style={{ width: 14, height: 14 }} />
              <span>Sinkron</span>
            </button>
          )}

          {isAdmin && onResetTasks && (
            <button
              type="button"
              className="btn btn-outline"
              style={{ color: 'var(--danger)', borderColor: 'rgba(225, 75, 75, 0.3)' }}
              onClick={() => setIsResetModalOpen(true)}
              title="Reset seluruh tugas di Kanban (Khusus Admin)"
            >
              <Icon name="trash" style={{ width: 14, height: 14 }} />
              <span>Reset Papan</span>
            </button>
          )}

          <button
            className="btn btn-dark"
            onClick={() => {
              setDefaultCol('todo');
              setIsAddOpen(true);
            }}
          >
            <Icon name="plus" />
            <span>Tambah Tugas Baru</span>
          </button>
        </div>
      </div>

      {/* Head stats */}
      <div className="head-stats" style={{ marginBottom: '20px' }}>
        <div className="stat-chip c-white">
          <div className="ic">
            <Icon name="checksq" />
          </div>
          <div>
            <div className="num">{tasks.length}</div>
            <div className="lbl">Semua Tugas</div>
          </div>
        </div>
        <div className="stat-chip c-cream">
          <div className="ic">
            <Icon name="clock" />
          </div>
          <div>
            <div className="num">{tasks.filter((t) => t.col === 'todo').length}</div>
            <div className="lbl">To Do</div>
          </div>
        </div>
        <div className="stat-chip c-lav">
          <div className="ic">
            <Icon name="target" />
          </div>
          <div>
            <div className="num">{tasks.filter((t) => t.col === 'inprogress').length}</div>
            <div className="lbl">Berjalan</div>
          </div>
        </div>
        <div className="stat-chip c-mint">
          <div className="ic">
            <Icon name="check" />
          </div>
          <div>
            <div className="num">{tasks.filter((t) => t.col === 'done').length}</div>
            <div className="lbl">Selesai</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="tab-row">
          <button
            className={filter === 'All' ? 'active' : ''}
            onClick={() => setFilter('All')}
          >
            Semua ({tasks.length})
          </button>
          <button
            className={filter === 'High' ? 'active' : ''}
            onClick={() => setFilter('High')}
          >
            Prioritas Tinggi
          </button>
          <button
            className={filter === 'Done' ? 'active' : ''}
            onClick={() => setFilter('Done')}
          >
            Selesai
          </button>
        </div>

        <div className="search-box">
          <Icon name="search" />
          <input
            type="text"
            placeholder="Cari tugas atau nama proyek..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* 4-Column Kanban Board */}
      <div className="kanban-wrap" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {columns.map((colDef) => {
          const colTasks = filteredTasks.filter((t) => t.col === colDef.col);
          const isDropActive = activeDropZone === colDef.col;

          return (
            <div
              key={colDef.col}
              data-col-id={colDef.col}
              className={`kcol ${isDropActive ? 'dragover active-drop-zone' : ''}`}
              onDragOver={(e) => handleDragOver(e, colDef.col)}
              onDragLeave={(e) => handleDragLeave(e, colDef.col)}
              onDrop={(e) => handleDrop(e, colDef.col)}
            >
              <div className="kcol-head">
                <span
                  className="kcol-dot"
                  style={{ background: colDef.dotColor }}
                />
                <span>{colDef.label}</span>
                <span className="kcol-count">{colTasks.length}</span>
              </div>

              {colTasks.length === 0 && draggingTaskId && (
                <div className="kcol-drop-target">
                  Lepas di sini untuk pindah ke {colDef.label}
                </div>
              )}

              {colTasks.map((t) => (
                <div
                  key={t.id}
                  className={`kcard ${draggingTaskId === t.id ? 'dragging' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, t.id)}
                  onDragEnd={handleDragEnd}
                  onTouchStart={(e) => handleTouchStart(e, t.id)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onClick={() => setEditingTask(t)}
                >
                  <div className="kcard-top">
                    <span className="kcard-proj">
                      <Icon name="folder" />
                      <span>{t.proj}</span>
                    </span>
                    <span className={`prio ${t.priority}`}>{t.priority}</span>
                  </div>

                  <h5>{t.title}</h5>

                  <div className="kcard-foot">
                    {renderAssigneeAvatar(t.assignee)}
                    <span className="kdate">
                      <Icon name="clock" />
                      <span>{t.due}</span>
                    </span>
                    {t.documents && t.documents.length > 0 && (
                      <span className="kcard-docs-chip" title={`${t.documents.length} Dokumentasi Pekerjaan`}>
                        <Icon name="image" style={{ width: 12, height: 12 }} />
                        <span>{t.documents.length}</span>
                      </span>
                    )}
                  </div>

                  <div className="kmini-track">
                    <div
                      className="kmini-fill"
                      style={{
                        width: `${t.progress}%`,
                        background:
                          t.col === 'done'
                            ? '#1e6e56'
                            : t.col === 'review'
                            ? '#8a5a10'
                            : 'var(--violet)',
                      }}
                    />
                  </div>
                </div>
              ))}

              <button
                className="add-task-mini"
                onClick={() => {
                  setDefaultCol(colDef.col);
                  setIsAddOpen(true);
                }}
              >
                <Icon name="plus" />
                <span>Tambah Tugas</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal: Tambah Tugas Baru */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Tambah Tugas Baru"
      >
        <form onSubmit={handleCreateTask}>
          <div className="field">
            <label htmlFor="task-proj-select">Proyek Terkait</label>
            <select
              id="task-proj-select"
              className="input"
              value={newTaskProj}
              onChange={(e) => setNewTaskProj(e.target.value)}
            >
              {projects.length > 0 ? (
                projects.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))
              ) : (
                <option value="Creative Sprint">Creative Sprint</option>
              )}
            </select>
          </div>

          <div className="field">
            <label htmlFor="task-title-input">Judul Tugas *</label>
            <input
              id="task-title-input"
              type="text"
              placeholder="Contoh: Buat storyboard scene pembuka"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="task-assignee-select">Penanggung Jawab (Opsional)</label>
            {members.length > 0 ? (
              <select
                id="task-assignee-select"
                className="input"
                value={newTaskAssignee}
                onChange={(e) => setNewTaskAssignee(e.target.value)}
              >
                <option value="">-- Pilih Anggota Tim --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.full_name || m.name}>
                    {m.full_name || m.name} ({m.role})
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="task-assignee-input"
                type="text"
                placeholder="Nama penanggung jawab"
                value={newTaskAssignee}
                onChange={(e) => setNewTaskAssignee(e.target.value)}
              />
            )}
          </div>

          <div className="form-2col">
            <div className="field">
              <label htmlFor="task-priority-select">Prioritas</label>
              <select
                id="task-priority-select"
                className="input"
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as PriorityLevel)}
              >
                <option value="High">Tinggi (High)</option>
                <option value="Medium">Sedang (Medium)</option>
                <option value="Low">Rendah (Low)</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="task-due-input">Tenggat Waktu</label>
              <input
                id="task-due-input"
                type="text"
                placeholder="Misal: Hari ini, Besok, 18 Okt"
                value={newTaskDue}
                onChange={(e) => setNewTaskDue(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-foot">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setIsAddOpen(false)}
            >
              Batal
            </button>
            <button type="submit" className="btn btn-dark">
              Simpan Tugas
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Task & Progress */}
      {editingTask && (
        <Modal
          isOpen={true}
          onClose={() => setEditingTask(null)}
          title="Detail & Update Tugas"
        >
          <form onSubmit={handleSaveEdit}>
            <div className="field">
              <label htmlFor="edit-task-title">Judul Tugas</label>
              <input
                id="edit-task-title"
                type="text"
                value={editingTask.title}
                onChange={(e) =>
                  setEditingTask({ ...editingTask, title: e.target.value })
                }
              />
            </div>

            <div className="field">
              <label htmlFor="edit-task-proj">Proyek</label>
              <select
                id="edit-task-proj"
                className="input"
                value={editingTask.proj}
                onChange={(e) =>
                  setEditingTask({ ...editingTask, proj: e.target.value })
                }
              >
                {projects.length > 0 ? (
                  projects.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))
                ) : (
                  <option value={editingTask.proj}>{editingTask.proj}</option>
                )}
              </select>
            </div>

            <div className="form-2col">
              <div className="field">
                <label htmlFor="edit-task-col">Status Kolom</label>
                <select
                  id="edit-task-col"
                  className="input"
                  value={editingTask.col}
                  onChange={(e) => {
                    const col = e.target.value as TaskStatus;
                    setEditingTask({
                      ...editingTask,
                      col,
                      progress: col === 'done' ? 100 : col === 'todo' ? 0 : editingTask.progress,
                    });
                  }}
                >
                  <option value="todo">To Do</option>
                  <option value="inprogress">Sedang Dikerjakan</option>
                  <option value="review">Dalam Review</option>
                  <option value="done">Selesai</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="edit-task-priority">Prioritas</label>
                <select
                  id="edit-task-priority"
                  className="input"
                  value={editingTask.priority}
                  onChange={(e) =>
                    setEditingTask({
                      ...editingTask,
                      priority: e.target.value as PriorityLevel,
                    })
                  }
                >
                  <option value="High">Tinggi (High)</option>
                  <option value="Medium">Sedang (Medium)</option>
                  <option value="Low">Rendah (Low)</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="edit-task-progress">Kemajuan Tugas ({editingTask.progress}%)</label>
              <div className="slider-row">
                <input
                  id="edit-task-progress"
                  type="range"
                  min="0"
                  max="100"
                  value={editingTask.progress}
                  onChange={(e) =>
                    setEditingTask({
                      ...editingTask,
                      progress: Number(e.target.value),
                    })
                  }
                />
                <span className="slider-val">{editingTask.progress}%</span>
              </div>
            </div>

            {/* SECTION DOKUMENTASI PEKERJAAN */}
            <div className="task-docs-section">
              <div className="task-docs-head">
                <div className="task-docs-head-info">
                  <div className="task-docs-title">
                    <Icon name="camera" style={{ width: 16, height: 16 }} />
                    <span>Dokumentasi Pekerjaan</span>
                    {taskDocs.length > 0 && (
                      <span className="task-docs-count-badge">{taskDocs.length}</span>
                    )}
                  </div>
                  <span className="task-docs-sub">
                    Tambahkan gambar atau video sebagai bukti progress, revisi, atau hasil pekerjaan.
                  </span>
                </div>
              </div>

              {/* Hidden native file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.webm,image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleUploadFile(e.target.files);
                  }
                }}
              />

              {/* Compact Upload Dropzone / Button */}
              <div
                className={`task-docs-upload-compact ${isDragOverDropzone ? 'dragging' : ''}`}
                onClick={() => {
                  if (!isUploadingDoc) {
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOverDropzone(true);
                }}
                onDragLeave={() => setIsDragOverDropzone(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOverDropzone(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleUploadFile(e.dataTransfer.files);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="upload-compact-content">
                  <div className="upload-compact-ic">
                    <Icon name="upload" style={{ width: 18, height: 18 }} />
                  </div>
                  <div className="upload-compact-text">
                    <b>+ Tambahkan Dokumentasi</b>
                    <span>JPG, PNG, WEBP, MP4, MOV, WEBM (Maks 25 MB)</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-outline btn-upload-trigger"
                  disabled={isUploadingDoc}
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  <Icon name="plus" style={{ width: 13, height: 13 }} />
                  <span>Pilih File</span>
                </button>
              </div>

              {/* Upload Progress Indicator */}
              {isUploadingDoc && (
                <div className="task-docs-upload-progress">
                  <div className="progress-status-row">
                    <span>
                      <span className="upload-spinner-dot" />
                      Uploading...
                    </span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="task-docs-track">
                    <div
                      className="task-docs-fill"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Documentation Thumbnails Grid */}
              {taskDocs.length > 0 ? (
                <div className="task-docs-grid">
                  {taskDocs.map((doc, idx) => (
                    <div
                      key={doc.id}
                      className="task-doc-item"
                      onClick={() => {
                        setViewerIndex(idx);
                        setViewerOpen(true);
                      }}
                      title={`${doc.file_name} (Klik untuk pratinjau)`}
                    >
                      {/* Media Thumbnail */}
                      <img
                        src={doc.thumbnail_url || doc.file_url}
                        alt={doc.file_name}
                        className="task-doc-thumb-img"
                        loading="lazy"
                        onError={(e) => {
                          // Fallback for broken video thumbnail
                          if (doc.file_type === 'video') {
                            (e.currentTarget as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&auto=format&fit=crop&q=80';
                          }
                        }}
                      />

                      {/* Video Play Indicator */}
                      {doc.file_type === 'video' && (
                        <div className="task-doc-video-badge">
                          <Icon name="play" style={{ width: 14, height: 14 }} />
                        </div>
                      )}

                      {/* Type Badge */}
                      <span className="task-doc-type-pill">
                        <Icon
                          name={doc.file_type === 'video' ? 'video' : 'image'}
                          style={{ width: 11, height: 11 }}
                        />
                        <span>{doc.file_type === 'video' ? 'VIDEO' : 'IMG'}</span>
                      </span>

                      {/* Small Delete Button */}
                      <button
                        type="button"
                        className="task-doc-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDocToDelete(doc);
                        }}
                        title="Hapus dokumentasi ini"
                        aria-label="Hapus dokumentasi"
                      >
                        <Icon name="trash" style={{ width: 14, height: 14 }} />
                      </button>

                      {/* Bottom Info Bar */}
                      <div className="task-doc-meta-overlay">
                        <span className="task-doc-name-cut">{doc.file_name}</span>
                        {doc.file_size_formatted && (
                          <span className="task-doc-size">{doc.file_size_formatted}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                !isUploadingDoc && (
                  <div className="task-docs-empty">
                    <b>Belum ada dokumentasi</b>
                    <span>Unggah bukti progress, mockup, atau video hasil kerja.</span>
                  </div>
                )
              )}
            </div>

            <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn btn-outline"
                style={{ color: 'var(--danger)', borderColor: 'rgba(225, 75, 75, 0.3)' }}
                onClick={() => {
                  onDeleteTask(editingTask.id);
                  setEditingTask(null);
                }}
              >
                Hapus Tugas
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setEditingTask(null)}
                >
                  Batal
                </button>
                <button type="submit" className="btn btn-dark">
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirmation Dialog: Reset All Tasks (Admin Only) */}
      {isResetModalOpen && (
        <div
          className="doc-delete-confirm-overlay"
          onClick={() => setIsResetModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="doc-delete-confirm-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h4>Reset Seluruh Papan Tugas?</h4>
            <p>
              Tindakan ini akan menghapus semua tugas di database MySQL. Data yang direset tidak dapat dipulihkan.
            </p>
            <div className="doc-delete-confirm-actions">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setIsResetModalOpen(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn-confirm-delete"
                onClick={() => {
                  setIsResetModalOpen(false);
                  if (onResetTasks) onResetTasks();
                }}
              >
                Reset Semua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Delete Task Document */}
      {docToDelete && (
        <div
          className="doc-delete-confirm-overlay"
          onClick={() => setDocToDelete(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="doc-delete-confirm-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h4>Hapus dokumentasi ini?</h4>
            <p>
              Dokumentasi yang dihapus tidak dapat dipulihkan.
            </p>
            <div className="doc-delete-confirm-actions">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setDocToDelete(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn-confirm-delete"
                onClick={handleConfirmDeleteDoc}
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Media Viewer (Image & HTML5 Video) */}
      <MediaViewerModal
        isOpen={viewerOpen}
        documents={taskDocs}
        currentIndex={viewerIndex}
        onClose={() => setViewerOpen(false)}
        onNavigate={(newIdx) => setViewerIndex(newIdx)}
      />
    </div>
  );
};
