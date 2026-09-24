export type ViewType =
  | 'dashboard'
  | 'projects'
  | 'project-detail'
  | 'tasks'
  | 'team'
  | 'calendar'
  | 'reports'
  | 'report-detail'
  | 'create-report'
  | 'profile'
  | 'analytics';

export type TaskStatus = 'todo' | 'inprogress' | 'review' | 'done';
export type PriorityLevel = 'High' | 'Medium' | 'Low';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  img: string;
  status: 'working' | 'break' | 'offline';
}

export interface Project {
  id: string;
  name: string;
  cat: string;
  catLabel: string;
  desc: string;
  progress: number;
  team: string[];
  due: string;
  status: 'Active' | 'In Review' | 'Completed';
  illus: string;
}

export interface Task {
  id: string;
  proj: string;
  title: string;
  priority: PriorityLevel;
  assignee: string;
  due: string;
  progress: number;
  col: TaskStatus;
}

export interface Report {
  id: string;
  person: string;
  date: string;
  project: string;
  task: string;
  category: string;
  desc: string;
  progress: number;
  time: string;
  status: 'Completed' | 'In Review' | 'In Progress' | 'To Do';
  challenges?: string;
  next?: string;
}

export interface Activity {
  id: string;
  person: string;
  action: string;
  quote: string;
  time: string;
  project: string;
  kind: 'Reports' | 'Tasks' | 'Files' | 'Comments';
  icon: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string;
  cat: string;
}

export interface ToastMessage {
  id: string;
  text: string;
}
