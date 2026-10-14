import { resetDb, state, svc } from './core';

beforeAll(() => resetDb());

const asUser = (id, role) => {
  state.userId = id;
  state.role = role;
  state.previewAsClient = false;
};
const thread = (id) => state.db.THREADS.find((t) => t.id === id);
const team = (id) => state.db.PROJECTS.find((p) => p.id === id).teamIds;

describe('adding people to a group or project conversation', () => {
  beforeEach(() => asUser('u5', 'designer'));

  test('who may add people', () => {
    expect(svc.canInvite(thread('t2'))).toBe(true); // project office chat, member
    expect(svc.canInvite(thread('t4'))).toBe(false); // not a member and not a partner
    asUser('u1', 'partner');
    expect(svc.canInvite(thread('t4'))).toBe(true); // a partner can add to any
    asUser('u12', 'hr');
    expect(svc.canInvite(thread('t2'))).toBe(false);
    asUser('c1', 'client');
    expect(svc.canInvite(thread('t1'))).toBe(false);
    asUser('u5', 'designer');
    const dm = svc.openDirectChat('u1');
    expect(svc.canInvite(dm)).toBe(false); // direct messages are not groups
  });

  test('a project conversation offers studio staff who are not in it yet', () => {
    const ids = svc.invitablePeople('t2').map((u) => u.id);
    expect(ids).toEqual(expect.arrayContaining(['u2', 'u3']));
    expect(ids).not.toContain('u5'); // yourself
    expect(ids).not.toContain('u1'); // already in
    expect(ids).not.toContain('c1'); // clients are never offered
    expect(svc.inviteHint(thread('t2'))).toMatch(/project team/);
  });

  test('adding to a project conversation joins the thread and the project team', () => {
    expect(team('p1')).not.toContain('u2');
    svc.inviteToGroup('t2', 'u2');
    expect(thread('t2').memberIds).toContain('u2');
    expect(team('p1')).toContain('u2');
    expect(svc.invitablePeople('t2').map((u) => u.id)).not.toContain('u2');
    expect(() => svc.inviteToGroup('t2', 'u2')).toThrow(/already/);
    asUser('u2', 'designer');
    expect(svc.thread('t2')).not.toBeNull(); // they can now open it
  });

  test('clients cannot be added', () => {
    expect(() => svc.inviteToGroup('t2', 'c1')).toThrow(/studio/);
  });

  test('a project work group still only takes people on that project', () => {
    const group = svc.createGroup({ name: 'P2 crew', groupType: 'project', projectId: 'p2', memberIds: ['u2'] });
    expect(svc.inviteHint(group)).toBe('People on this project.');
    const ids = svc.invitablePeople(group.id).map((u) => u.id);
    expect(ids).toEqual(expect.arrayContaining(['u4', 'u7']));
    expect(ids).not.toContain('u1'); // not on project p2
    const before = team('p2').slice();
    expect(() => svc.inviteToGroup(group.id, 'u1')).toThrow(/isn’t on this project/);
    expect(team('p2')).toEqual(before);
    svc.inviteToGroup(group.id, 'u4');
    expect(thread(group.id).memberIds).toContain('u4');
  });

  test('a general group takes any studio staff and leaves project teams alone', () => {
    const group = svc.createGroup({ name: 'Studio lunch', groupType: 'general', memberIds: ['u1'] });
    const before = JSON.stringify(state.db.PROJECTS.map((p) => p.teamIds));
    svc.inviteToGroup(group.id, 'u3');
    expect(thread(group.id).memberIds).toContain('u3');
    expect(JSON.stringify(state.db.PROJECTS.map((p) => p.teamIds))).toBe(before);
  });
});
