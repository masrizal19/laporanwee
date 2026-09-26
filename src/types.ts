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
  | 'analytics'
  | 'ui-settings';

export interface UISettings {
  id?: number;
  primary_color: string;
  secondary_color: string;
  text_color: string;
  background_color: string;
  font_family: string;
  heading_font: string;
  menu_icon_size: number;
  menu_icon_stroke: number;
  signout_icon_size: number;
  logo_url?: string | null;
  menu_icon_url?: string | null;
  signout_icon_url?: string | null;
  updated_at?: string;
}

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
