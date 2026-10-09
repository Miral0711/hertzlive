import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import DesktopApp from './desktop/DesktopApp';
import MobileApp from './mobile/MobileApp';
import MobileLogin, { MobileRequireAuth } from './mobile/Login';
import Login from './auth/Login';
import RequireAuth from './auth/RequireAuth';
import Chats from './mobile/Chats';
import Thread from './mobile/Thread';
import Today from './mobile/Today';
import Projects, { Project, Drawings } from './mobile/Projects';
import Updates from './mobile/Updates';
import Profile from './mobile/Profile';
import { Photos, Photo, Markup, Camera, Portfolio } from './mobile/Library';
import { Who, People, Holidays, Punches, Reviews, Notice, Appearance, Language, Book, StandIn, MyPerformance } from './mobile/People';
import { Materials, Contacts, Attention, Changes, Refs, Intake, DrawingIndex, Drawing, Share } from './mobile/ProjectPages';
import { GroupInfo, Voice, MessagePage, Filing, Issue, Assist, Call } from './mobile/ChatPages';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/mobile/login" element={<MobileLogin />} />
        <Route path="/" element={<Navigate to="/desktop/dashboard" replace />} />
        <Route
          path="/mobile"
          element={(
            <MobileRequireAuth>
              <MobileApp />
            </MobileRequireAuth>
          )}
        >
          <Route index element={<Navigate to="chats" replace />} />
          <Route path="chats" element={<Chats />} />
          <Route path="chats/:threadId" element={<Thread />} />
          <Route path="chats/:threadId/info" element={<GroupInfo />} />
          <Route path="chats/:threadId/voice" element={<Voice />} />
          <Route path="chats/:threadId/call" element={<Call />} />
          <Route path="chats/:threadId/messages/:messageId" element={<MessagePage />} />
          <Route path="chats/:threadId/messages/:messageId/filing" element={<Filing />} />
          <Route path="today" element={<Today />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:projectId" element={<Project />} />
          <Route path="projects/:projectId/drawings" element={<Drawings />} />
          <Route path="projects/:projectId/drawings/:drawingNo" element={<Drawing />} />
          <Route path="projects/:projectId/materials" element={<Materials />} />
          <Route path="projects/:projectId/people" element={<Contacts />} />
          <Route path="projects/:projectId/attention" element={<Attention />} />
          <Route path="projects/:projectId/changes" element={<Changes />} />
          <Route path="projects/:projectId/refs" element={<Refs />} />
          <Route path="projects/:projectId/intake" element={<Intake />} />
          <Route path="projects/:projectId/index" element={<DrawingIndex />} />
          <Route path="projects/:projectId/share" element={<Share />} />
          <Route path="projects/:projectId/assist" element={<Assist />} />
          <Route path="assist" element={<Assist />} />
          <Route path="book" element={<Book />} />
          <Route path="standin/:userId" element={<StandIn />} />
          <Route path="updates" element={<Updates />} />
          <Route path="profile" element={<Profile />} />
          <Route path="photos" element={<Photos />} />
          <Route path="photos/:photoId" element={<Photo />} />
          <Route path="photos/:photoId/markup" element={<Markup />} />
          <Route path="camera" element={<Camera />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="people" element={<People />} />
          <Route path="holidays" element={<Holidays />} />
          <Route path="punches" element={<Punches />} />
          <Route path="performance" element={<MyPerformance />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="notice" element={<Notice />} />
          <Route path="who" element={<Who />} />
          <Route path="appearance" element={<Appearance />} />
          <Route path="language" element={<Language />} />
          <Route path="issues/:issueId" element={<Issue />} />
        </Route>
        <Route
          path="/desktop/*"
          element={(
            <RequireAuth>
              <DesktopApp />
            </RequireAuth>
          )}
        />
        <Route path="*" element={<Navigate to="/desktop/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
