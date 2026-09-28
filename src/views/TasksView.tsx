import React, { useState, useRef, useEffect } from 'react';
import { Task, TaskStatus, PriorityLevel, Project, TaskDocument } from '../types';
import { Icon } from '../components/icons';
import { Modal } from '../components/Modal';
import { taskDocumentsService, validateTaskDocumentFile } from '../utils/taskDocuments';
import { MediaViewerModal } from '../components/MediaViewerModal';

interface TasksViewProps {
  tasks: Task[];
  projects: Project[];
  onAddTask: (task: Omit<Task, 'id'>) => void;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onAddToast: (text: string) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  projects,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onAddToast,
}) => {
  const [filter, setFilter] = useState<'All' | 'Mine' | 'High' | 'Done'>('All');
  const [search, setSearch] = useState('');
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);

  // Modal State for New Task
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [defaultCol, setDefaultCol] = useState<TaskStatus>('todo');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskProj, setNewTaskProj] = useState(projects[0]?.name || 'Website Redesign');
  const [newTaskPriority, setNewTaskPriority] = useState<PriorityLevel>('High');
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

    setIsUploadingDoc(true);
    setUploadProgress(10);

    try {
      // Get current logged in user name if available
      let uploaderName = 'Rangga Arya';
      try {
        const storedUser = localStorage.getItem('laporanwee_user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          if (parsed?.full_name) uploaderName = parsed.full_name;
        }
      } catch (_) {}

      const newDoc = await taskDocumentsService.uploadDocument(
        editingTask.id,
        file,
        uploaderName,
        (pct) => setUploadProgress(pct)
      );

      const updatedDocs = [newDoc, ...taskDocs];
      setTaskDocs(updatedDocs);
      taskDocumentsService.saveDocuments(editingTask.id, updatedDocs);

      // Update parent task state immediately so upload is independent of "Simpan Perubahan"
      const updatedTask: Task = {
        ...editingTask,
        documents: updatedDocs,
      };
      setEditingTask(updatedTask);
      onUpdateTask(updatedTask);

      onAddToast('Dokumentasi berhasil ditambahkan.');
    } catch (err: any) {
      onAddToast(err?.message || 'Gagal mengunggah dokumentasi.');
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
    setDraggingTaskId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetCol: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggingTaskId;
    setDraggingTaskId(null);

    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.col !== targetCol) {
      const updated = {
        ...task,
        col: targetCol,
        progress: targetCol === 'done' ? 100 : targetCol === 'todo' ? 0 : task.progress,
      };
      onUpdateTask(updated);
      onAddToast(`Tugas dipindahkan ke "${targetCol}".`);
    }
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    onAddTask({
      proj: newTaskProj,
      title: newTaskTitle.trim(),
      priority: newTaskPriority,
      assignee: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      due: newTaskDue || 'Besok',
      progress: defaultCol === 'done' ? 100 : 0,
      col: defaultCol,
    });

    onAddToast(`Tugas "${newTaskTitle}" berhasil ditambahkan!`);
    setIsAddOpen(false);
    setNewTaskTitle('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    onUpdateTask(editingTask);
    onAddToast(`Tugas "${editingTask.title}" diperbarui!`);
    setEditingTask(null);
  };

  return (
    <div className="view">
      {/* Page Head */}
      <div className="page-head">
        <div>
          <h1>Papan Tugas (Kanban)</h1>
          <p className="sub">
            Atur dan pindahkan alur kerja tim dari perencanaan hingga selesai dengan drag &amp; drop.
          </p>
        </div>
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

          return (
            <div
              key={colDef.col}
              className="kcol"
              onDragOver={handleDragOver}
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

              {colTasks.map((t) => (
                <div
                  key={t.id}
                  className={`kcard ${draggingTaskId === t.id ? 'dragging' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, t.id)}
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
                    <img src={t.assignee} alt="Assignee" />
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
              {projects.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
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
                placeholder="Misal: Hari ini, 18 Okt"
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
                      progress: col === 'done' ? 100 : editingTask.progress,
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
                  onAddToast(`Tugas "${editingTask.title}" dihapus.`);
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
