import type { Route } from './platform/router';
import Login from './screens/Login';
import Chats from './screens/Chats';
import Thread from './screens/Thread';
import Today from './screens/Today';
import Projects, { Project, Drawings } from './screens/Projects';
import Updates from './screens/Updates';
import Profile from './screens/Profile';
import { Photos, Photo, Markup, Camera, Portfolio } from './screens/Library';
import { Who, People, Holidays, Punches, Reviews, Notice, Appearance, Language, Book, StandIn } from './screens/People';
import { Materials, Contacts, Attention, Changes, Refs, Intake, DrawingIndex, Drawing, Share } from './screens/ProjectPages';
import { GroupInfo, Voice, MessagePage, Filing, Issue, Assist, Call } from './screens/ChatPages';

// Mirrors the /mobile/* routes in packages/frontend/src/App.js.
export const routes: Route[] = [
  { path: '/mobile/login', component: Login },
  { path: '/mobile/chats', component: Chats },
  { path: '/mobile/chats/:threadId', component: Thread },
  { path: '/mobile/chats/:threadId/info', component: GroupInfo },
  { path: '/mobile/chats/:threadId/voice', component: Voice },
  { path: '/mobile/chats/:threadId/call', component: Call },
  { path: '/mobile/chats/:threadId/messages/:messageId', component: MessagePage },
  { path: '/mobile/chats/:threadId/messages/:messageId/filing', component: Filing },
  { path: '/mobile/today', component: Today },
  { path: '/mobile/projects', component: Projects },
  { path: '/mobile/projects/:projectId', component: Project },
  { path: '/mobile/projects/:projectId/drawings', component: Drawings },
  { path: '/mobile/projects/:projectId/drawings/:drawingNo', component: Drawing },
  { path: '/mobile/projects/:projectId/materials', component: Materials },
  { path: '/mobile/projects/:projectId/people', component: Contacts },
  { path: '/mobile/projects/:projectId/attention', component: Attention },
  { path: '/mobile/projects/:projectId/changes', component: Changes },
  { path: '/mobile/projects/:projectId/refs', component: Refs },
  { path: '/mobile/projects/:projectId/intake', component: Intake },
  { path: '/mobile/projects/:projectId/index', component: DrawingIndex },
  { path: '/mobile/projects/:projectId/share', component: Share },
  { path: '/mobile/projects/:projectId/assist', component: Assist },
  { path: '/mobile/assist', component: Assist },
  { path: '/mobile/book', component: Book },
  { path: '/mobile/standin/:userId', component: StandIn },
  { path: '/mobile/updates', component: Updates },
  { path: '/mobile/profile', component: Profile },
  { path: '/mobile/photos', component: Photos },
  { path: '/mobile/photos/:photoId', component: Photo },
  { path: '/mobile/photos/:photoId/markup', component: Markup },
  { path: '/mobile/camera', component: Camera },
  { path: '/mobile/portfolio', component: Portfolio },
  { path: '/mobile/people', component: People },
  { path: '/mobile/holidays', component: Holidays },
  { path: '/mobile/punches', component: Punches },
  { path: '/mobile/reviews', component: Reviews },
  { path: '/mobile/notice', component: Notice },
  { path: '/mobile/who', component: Who },
  { path: '/mobile/appearance', component: Appearance },
  { path: '/mobile/language', component: Language },
  { path: '/mobile/issues/:issueId', component: Issue },
];
