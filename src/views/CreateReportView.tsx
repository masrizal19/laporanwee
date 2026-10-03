import React from 'react';
import { Project, Report, ViewType } from '../types';
import { DailyReportForm } from '../components/DailyReportForm';

interface CreateReportViewProps {
  projects: Project[];
  userName?: string;
  userEmail?: string;
  onNavigate: (view: ViewType) => void;
  onAddReport: (report: Omit<Report, 'id'>) => Promise<string> | string;
  onSelectReport: (reportId: string) => void;
  onAddToast: (text: string) => void;
}

export const CreateReportView: React.FC<CreateReportViewProps> = (props) => {
  return (
    <div className="view">
      <DailyReportForm mode="create" {...props} />
    </div>
  );
};
