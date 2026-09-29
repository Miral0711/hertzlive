// Feature module: projects. Exports page components and dialog components (see registry.js).
import ProjectsPage from '../projects/ProjectPage';
import {
  ProjectDecisionDialog, DrawingViewDialog, FinaliseDrawingDialog, IntakeUploadDialog, IntakeAddDialog, ClientRefAddDialog,
} from '../projects/dialogs';

export const pages = { projects: ProjectsPage };
export const dialogs = {
  'project-decision': ProjectDecisionDialog,
  'drawing-view': DrawingViewDialog,
  'finalise-drawing': FinaliseDrawingDialog,
  'intake-upload': IntakeUploadDialog,
  'intake-add': IntakeAddDialog,
  'client-ref-add': ClientRefAddDialog,
};
