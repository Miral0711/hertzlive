// Feature module: studio (schedule, enquiries, people). Exports page components and dialog components.
import Schedule, { BookSlotDialog } from '../studio/Schedule';
import Enquiries from '../studio/Enquiries';
import People from '../studio/People';
import { EnquiryDialog, LeaveApproveDialog, OrgLeaveApproveDialog, ImportContactsDialog, HolidayDialog, RecognitionDialog, GoalDialog } from '../studio/dialogs';
import MeetingsCard from '../studio/MeetingsCard';

export { MeetingsCard };
export const pages = {
  schedule: Schedule,
  enquiries: Enquiries,
  people: People,
};
export const dialogs = {
  enquiry: EnquiryDialog,
  'leave-approve': LeaveApproveDialog,
  'org-leave-approve': OrgLeaveApproveDialog,
  'import-contacts': ImportContactsDialog,
  'holiday-edit': HolidayDialog,
  'book-slot': BookSlotDialog,
  recognition: RecognitionDialog,
  goal: GoalDialog,
};
