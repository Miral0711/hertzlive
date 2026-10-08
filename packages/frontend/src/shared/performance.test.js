import {
  applyIssueClose, applyMilestone, applyTaskCompletion, applyTaskReopen, applyWeightTable, canSeeReviewScore,
  canSeeTeamPerformance, canViewPerson, currentStreak, ensurePerformance, evaluateBadges,
  goalResult, metricsFor, milestoneCount, performanceAccess, performanceFor, periodById, suggestIncentive,
  taskOnTime, visibleStaff, withinSla,
} from './performance';

const idFn = (() => {
  let n = 0;
  return () => `id${n += 1}`;
})();

function db(extra = {}) {
  return {
    USERS: [
      { id: 'u1', role: 'designer', pts: 10, streak: 40 },
      { id: 'u2', role: 'designer', pts: 0, quiet: true },
    ],
    TASKS: [],
    ISSUES: [],
    PUNCHES: [],
    ATTENDANCE_TODAY: [],
    HOLIDAYS: [],
    ORG_HOLIDAYS: [],
    PROJECTS: [],
    REVIEWS: [],
    POINT_RULES: [
      { id: 'task_on_time', points: 5, enabled: true },
      { id: 'task_high_priority', points: 8, enabled: true },
      { id: 'issue_within_sla', points: 10, enabled: true },
      { id: 'milestone_done', points: 15, enabled: true },
    ],
    BADGES: [
      { id: 'deadline-pro', name: 'Deadline Pro', rule: 'tasks_on_time', threshold: 2, desc: 'two' },
      { id: 'site-resolver', name: 'Site Resolver', rule: 'issues_sla', threshold: 1, desc: 'one' },
    ],
    POINTS_LEDGER: [],
    BADGE_AWARDS: [],
    RECOGNITIONS: [],
    GOALS: [],
    ...extra,
  };
}

const quarter = { start: '2026-10-01', end: '2026-12-31' };

test('task completion records who and when, and on-time points once', () => {
  const store = db();
  const task = { id: 'k1', owner: 'u1', due: '2026-10-10', status: 'open', priority: 'normal' };
  store.TASKS.push(task);
  applyTaskCompletion(store, task, '2026-10-09T16:00', 'u1', idFn);
  applyTaskCompletion(store, task, '2026-10-09T16:05', 'u1', idFn);
  expect(task.completedAt).toBe('2026-10-09T16:00');
  expect(task.completedBy).toBe('u1');
  expect(taskOnTime(task)).toBe(true);
  expect(store.POINTS_LEDGER).toHaveLength(1);
  expect(store.POINTS_LEDGER[0]).toMatchObject({ userId: 'u1', points: 5, sourceType: 'task_on_time', sourceId: 'k1' });
  expect(store.USERS[0].pts).toBe(5);
});

test('a late task does not earn the on-time rule', () => {
  const store = db();
  const task = { id: 'k2', owner: 'u1', due: '2026-10-01', status: 'open' };
  store.TASKS.push(task);
  applyTaskCompletion(store, task, '2026-10-03T09:00', 'u1', idFn);
  expect(taskOnTime(task)).toBe(false);
  expect(store.POINTS_LEDGER).toHaveLength(0);
});

test('high-priority on-time work earns both rules', () => {
  const store = db();
  const task = { id: 'k3', owner: 'u1', due: '2026-10-10', status: 'open', priority: 'high' };
  store.TASKS.push(task);
  applyTaskCompletion(store, task, '2026-10-10T18:00', 'u1', idFn);
  expect(store.POINTS_LEDGER.map((e) => e.sourceType).sort()).toEqual(['task_high_priority', 'task_on_time']);
  expect(store.USERS[0].pts).toBe(13);
});

test('reopening a task removes its points', () => {
  const store = db();
  const task = { id: 'k4', owner: 'u1', due: '2026-10-10', status: 'open' };
  store.TASKS.push(task);
  applyTaskCompletion(store, task, '2026-10-08T09:00', 'u1', idFn);
  applyTaskReopen(store, task, 'todo');
  expect(task.completedAt).toBeUndefined();
  expect(task.status).toBe('open');
  expect(store.POINTS_LEDGER).toHaveLength(0);
  expect(store.USERS[0].pts).toBe(0);
});

test('issue closed before due earns SLA points; after due does not', () => {
  const store = db();
  const early = { id: 'i1', assignee: 'u1', due: '2026-10-10T18:00', status: 'open' };
  const late = { id: 'i2', assignee: 'u1', due: '2026-10-10T18:00', status: 'open' };
  applyIssueClose(store, early, '2026-10-10T12:00', 'u9', idFn);
  applyIssueClose(store, late, '2026-10-11T09:00', 'u9', idFn);
  expect(withinSla(early)).toBe(true);
  expect(withinSla(late)).toBe(false);
  expect(store.POINTS_LEDGER).toHaveLength(1);
  expect(store.POINTS_LEDGER[0]).toMatchObject({ sourceType: 'issue_within_sla', sourceId: 'i1', points: 10 });
});

test('badge is awarded from records, not a static list', () => {
  const store = db();
  const taskA = { id: 'a', owner: 'u1', due: '2026-10-02', status: 'open' };
  const taskB = { id: 'b', owner: 'u1', due: '2026-10-04', status: 'open' };
  store.TASKS.push(taskA, taskB);
  applyTaskCompletion(store, taskA, '2026-10-02T09:00', 'u1', idFn);
  evaluateBadges(store, 'u1', '2026-10-02', idFn);
  expect(store.BADGE_AWARDS).toHaveLength(0);
  applyTaskCompletion(store, taskB, '2026-10-03T09:00', 'u1', idFn);
  evaluateBadges(store, 'u1', '2026-10-03', idFn);
  expect(store.BADGE_AWARDS.map((a) => a.badgeId)).toEqual(['deadline-pro']);
  evaluateBadges(store, 'u1', '2026-10-04', idFn);
  expect(store.BADGE_AWARDS).toHaveLength(1);
});

test('streak comes from check-ins, not the seeded number', () => {
  const store = db();
  store.PUNCHES = [
    { userId: 'u1', date: '2026-10-05', in: '09:00', late: false },
    { userId: 'u1', date: '2026-10-06', in: '09:05', late: false },
    { userId: 'u1', date: '2026-10-07', in: '09:10', late: false },
  ];
  expect(currentStreak(store, 'u1', '2026-10-07')).toBe(3);
  expect(currentStreak(store, 'u1', '2026-10-07')).not.toBe(40);
});

test('opt-out keeps the ledger and seeded totals are not an opening balance', () => {
  const store = db();
  store.POINTS_LEDGER.push({ userId: 'u1', points: 10, sourceType: 'opening', sourceId: 'u1', at: '2026-10-01T00:00' });
  ensurePerformance(store, '2026-10-08', idFn);
  expect(store.USERS[1].ptsOptOut).toBe(true);
  expect(store.POINTS_LEDGER.some((e) => e.sourceType === 'opening')).toBe(false);
  expect(store.USERS[0].pts).toBe(0);
  const task = { id: 'now', owner: 'u1', due: '2026-10-08', status: 'open' };
  store.TASKS.push(task);
  applyTaskCompletion(store, task, '2026-10-08T11:00', 'u1', idFn);
  const metrics = metricsFor(store, 'u1', quarter, '2026-10-08');
  expect(metrics.points).toBe(5);
  expect(metrics.totalPoints).toBe(5);
});

test('performance score uses role weights and leaves out empty dimensions', () => {
  const make = (id, role) => db({
    USERS: [{ id, role, pts: 500, streak: 40 }],
    TASKS: [{ id: 't1', owner: id, due: '2026-10-02', status: 'done', completedAt: '2026-10-02T09:00' }],
    PUNCHES: [
      { userId: id, date: '2026-10-05', in: '09:00', late: false },
      { userId: id, date: '2026-10-06', in: '10:30', late: true },
    ],
    POINTS_LEDGER: [{ id: 'p', userId: id, points: 500, reason: 'seed', sourceType: 'manual', sourceId: 'seed', createdAt: '2026-10-01T00:00' }],
    GOALS: [],
  });
  const designer = metricsFor(make('u1', 'designer'), 'u1', quarter, '2026-10-08').performance;
  const manager = metricsFor(make('u3', 'site_manager'), 'u3', quarter, '2026-10-08').performance;
  expect(designer.dimensions.find((d) => d.id === 'quality').score).toBeNull();
  expect(designer.score).toBe(85);
  expect(manager.score).toBe(81);
  const attendanceOnly = metricsFor(db({
    USERS: [{ id: 'u1', role: 'designer' }],
    PUNCHES: [{ userId: 'u1', date: '2026-10-05', in: '09:00', late: false }],
    GOALS: [],
  }), 'u1', quarter, '2026-10-08').performance;
  expect(attendanceOnly.dimensions.find((d) => d.id === 'reliability').score).toBe(100);
  expect(attendanceOnly.score).toBeNull();
  expect(suggestIncentive({ bands: [{ id: 'strong', label: 'Strong', minIndex: 85, suggested: 75000 }] }, attendanceOnly).suggested).toBeNull();
  expect(designer.score).not.toBe(manager.score);
  expect(designer.formula).toMatch(/Points are not part of this score/);
});

test('a badge below its rule is removed', () => {
  const store = db({
    BADGE_AWARDS: [{ id: 'old', badgeId: 'deadline-pro', userId: 'u1', earnedAt: '2026-10-01', reason: 'two', source: 'tasks_on_time' }],
  });
  evaluateBadges(store, 'u1', '2026-10-08', idFn);
  expect(store.BADGE_AWARDS).toHaveLength(0);
});

test('incentive suggestion uses the performance score and ignores points', () => {
  const rules = { bands: [{ id: 'strong', label: 'Strong', minIndex: 85, suggested: 75000 }, { id: 'attention', label: 'Needs attention', minIndex: 0, suggested: 0 }] };
  expect(suggestIncentive(rules, { score: 90, points: 10 }).suggested).toBe(75000);
  expect(suggestIncentive(rules, { score: 90, points: 9999 }).suggested).toBe(75000);
  expect(suggestIncentive(rules, { score: 90 }).label).toBe('Strong');
  expect(suggestIncentive(rules, { score: null, points: 9999 }).suggested).toBeNull();
  expect(suggestIncentive(rules, { score: null }).label).toBe('Not enough evidence');
});

test('goal progress follows the underlying issues', () => {
  const store = db({
    GOALS: [{ id: 'g', name: 'SLA', scope: 'team', metric: 'issue_sla_pct', target: 90, start: '2026-10-01', end: '2026-12-31' }],
    ISSUES: [
      { id: 'i1', assignee: 'u1', due: '2026-10-05T18:00', status: 'closed', closedAt: '2026-10-05T10:00' },
      { id: 'i2', assignee: 'u1', due: '2026-10-06T18:00', status: 'open' },
    ],
  });
  expect(goalResult(store, store.GOALS[0], '2026-10-08').current).toBe(50);
  store.ISSUES[1].status = 'closed';
  store.ISSUES[1].closedAt = '2026-10-06T09:00';
  expect(goalResult(store, store.GOALS[0], '2026-10-08').current).toBe(100);
  expect(goalResult(store, store.GOALS[0], '2026-10-08').status).toBe('met');
});

test('period helper resolves a quarter and a financial year', () => {
  expect(periodById('2026-Q4', '2026-10-08').label).toBe('Q4 2026');
  expect(periodById('FY2026', '2026-10-08')).toMatchObject({ start: '2026-04-01', end: '2027-03-31' });
});

test('one dimension does not produce an overall score', () => {
  const store = db({
    USERS: [{ id: 'u1', role: 'designer' }],
    PUNCHES: [{ userId: 'u1', date: '2026-10-05', in: '09:00', late: false }],
    GOALS: [],
  });
  const result = performanceFor(store, 'u1', quarter, '2026-10-08');
  expect(result.dimensions.find((d) => d.id === 'reliability').score).toBe(100);
  expect(result.score).toBeNull();
  expect(result.coverage).toBe('Based on 1 of 5 dimensions.');
  expect(result.formula).toMatch(/not a complete evaluation/);
});

test('two dimensions produce a partial score with an explanation', () => {
  const store = db({
    USERS: [{ id: 'u1', role: 'designer' }],
    TASKS: [{ id: 't1', owner: 'u1', due: '2026-10-02', status: 'done', completedAt: '2026-10-02T09:00' }],
    PUNCHES: [
      { userId: 'u1', date: '2026-10-05', in: '09:00', late: false },
      { userId: 'u1', date: '2026-10-06', in: '10:30', late: true },
    ],
    GOALS: [],
  });
  const result = performanceFor(store, 'u1', quarter, '2026-10-08');
  expect(result.score).toBe(85);
  expect(result.partial).toBe(true);
  expect(result.coverage).toBe('Based on 2 of 5 dimensions.');
  expect(result.formula).toMatch(/partial score, not a complete evaluation/);
});

test('changing weights does not alter a closed period', () => {
  const row = (delivery, reliability) => ({ delivery, reliability, quality: 0, contribution: 0, goals: 0 });
  const store = db({
    USERS: [{ id: 'u1', role: 'designer' }],
    TASKS: [{ id: 't1', owner: 'u1', due: '2026-08-10', status: 'done', completedAt: '2026-08-10T09:00' }],
    PUNCHES: [
      { userId: 'u1', date: '2026-08-03', in: '09:00', late: false },
      { userId: 'u1', date: '2026-08-04', in: '10:30', late: true },
    ],
    GOALS: [],
    PERFORMANCE_WEIGHTS: {
      designer: row(35, 15),
      site_manager: row(40, 25),
      hr: row(10, 30),
      partner: row(20, 10),
    },
  });
  const closed = periodById('2026-Q3', '2026-10-08');
  applyWeightTable(store, {
    designer: row(10, 90),
    site_manager: row(40, 25),
    hr: row(10, 30),
    partner: row(20, 10),
  }, '2026-10-08');
  const historical = performanceFor(store, 'u1', closed, '2026-10-08');
  expect(historical.weightsLocked).toBe(true);
  expect(historical.weights.delivery).toBe(35);
  expect(historical.score).toBe(85);
  store.PERFORMANCE_WEIGHTS.designer.delivery = 1;
  expect(performanceFor(store, 'u1', closed, '2026-10-08').score).toBe(85);
  expect(performanceFor(store, 'u1', quarter, '2026-10-08').weights.delivery).toBe(1);
});

test('a badge is awarded only when the count crosses its threshold', () => {
  const milestones = (n) => Array.from({ length: n }, (_, i) => ({
    id: `m${i}`, name: `M${i}`, date: '2026-08-01', done: true, doneAt: '2026-08-01T10:00', doneBy: 'u1',
  }));
  const store = db({
    BADGES: [{ id: 'project-finisher', name: 'Project Finisher', rule: 'milestones', threshold: 5, desc: 'five' }],
    PROJECTS: [{ id: 'p', name: 'House', milestones: milestones(4) }],
  });
  evaluateBadges(store, 'u1', '2026-10-08', idFn);
  expect(store.BADGE_AWARDS).toHaveLength(0);
  store.PROJECTS[0].milestones.push(milestones(1)[0]);
  store.PROJECTS[0].milestones[4].id = 'm4';
  evaluateBadges(store, 'u1', '2026-10-08', idFn);
  expect(store.BADGE_AWARDS.map((a) => a.badgeId)).toEqual(['project-finisher']);
});

test('a badge is removed when the person no longer meets the rule', () => {
  const store = db({
    BADGES: [{ id: 'studio-contributor', name: 'Studio Contributor', rule: 'recognitions', threshold: 3, desc: 'three' }],
    RECOGNITIONS: [
      { id: 'r1', userId: 'u1' },
      { id: 'r2', userId: 'u1' },
      { id: 'r3', userId: 'u1' },
    ],
    BADGE_AWARDS: [{ id: 'aw', badgeId: 'studio-contributor', userId: 'u1', earnedAt: '2026-10-01', reason: 'three', source: 'recognitions' }],
  });
  store.RECOGNITIONS.pop();
  evaluateBadges(store, 'u1', '2026-10-08', idFn);
  expect(store.BADGE_AWARDS).toHaveLength(0);
});

test('an employee cannot see team performance or another person\'s review score', () => {
  const store = db({
    USERS: [
      { id: 'u1', role: 'designer' },
      { id: 'u2', role: 'designer' },
    ],
  });
  const viewer = store.USERS[0];
  expect(canSeeTeamPerformance(viewer)).toBe(false);
  expect(visibleStaff(store, viewer).map((u) => u.id)).toEqual(['u1']);
  expect(canViewPerson(store, viewer, 'u2')).toBe(false);
  expect(canSeeReviewScore(viewer, 'u2')).toBe(false);
  expect(canSeeReviewScore(viewer, 'u1')).toBe(true);
  expect(performanceAccess('designer').incentiveRead).toBe(false);
});

test('a site manager sees only the people on their projects and sites', () => {
  const store = db({
    USERS: [
      { id: 'sm', role: 'site_manager' },
      { id: 'a', role: 'designer' },
      { id: 'b', role: 'designer' },
      { id: 'outsider', role: 'designer' },
    ],
    PROJECTS: [
      { id: 'p1', teamIds: ['sm', 'a'] },
      { id: 'p2', teamIds: ['b'] },
      { id: 'p3', teamIds: ['outsider'] },
    ],
    SITES: [
      { id: 's1', projectId: 'p1', managerId: 'sm' },
      { id: 's2', projectId: 'p2', managerId: 'sm' },
    ],
  });
  const viewer = store.USERS[0];
  expect(visibleStaff(store, viewer).map((u) => u.id).sort()).toEqual(['a', 'b', 'sm']);
  expect(canViewPerson(store, viewer, 'outsider')).toBe(false);
  expect(canSeeReviewScore(viewer, 'a')).toBe(false);
});

test('HR can plan incentives and a partner approves them', () => {
  expect(performanceAccess('hr').incentiveEdit).toBe(true);
  expect(performanceAccess('hr').incentiveApprove).toBe(false);
  expect(performanceAccess('partner').incentiveApprove).toBe(true);
});

test('clients and contractors cannot access performance', () => {
  const store = db({
    USERS: [
      { id: 'c', role: 'client' },
      { id: 'x', role: 'contractor' },
      { id: 'u1', role: 'designer' },
    ],
  });
  expect(visibleStaff(store, store.USERS[0])).toEqual([]);
  expect(visibleStaff(store, store.USERS[1])).toEqual([]);
  expect(performanceAccess('client').own).toBe(false);
  expect(performanceAccess('contractor').own).toBe(false);
  expect(canSeeTeamPerformance(store.USERS[0])).toBe(false);
  expect(canSeeReviewScore(store.USERS[1], 'u1')).toBe(false);
});

test('incentive bands come from the stored rules', () => {
  const rules = { bands: [{ id: 'custom', label: 'Custom', minIndex: 80, suggested: 12000 }] };
  expect(suggestIncentive(rules, { score: 90 }).suggested).toBe(12000);
  expect(suggestIncentive(rules, { score: 90 }).label).toBe('Custom');
});

test('fewer than 3 measured dimensions do not recommend an incentive', () => {
  const rules = {
    bands: [
      { id: 'strong', label: 'Strong', minIndex: 85, suggested: 75000 },
      { id: 'solid', label: 'Solid', minIndex: 70, suggested: 40000 },
    ],
  };
  const two = db({
    USERS: [{ id: 'u1', role: 'designer' }],
    TASKS: [{ id: 't1', owner: 'u1', due: '2026-10-02', status: 'done', completedAt: '2026-10-02T09:00' }],
    PUNCHES: [
      { userId: 'u1', date: '2026-10-05', in: '09:00', late: false },
      { userId: 'u1', date: '2026-10-06', in: '10:30', late: true },
    ],
    GOALS: [],
  });
  const partial = performanceFor(two, 'u1', quarter, '2026-10-08');
  expect(partial.score).toBe(85);
  expect(partial.coverage).toBe('Based on 2 of 5 dimensions.');
  const blocked = suggestIncentive(rules, partial);
  expect(blocked.suggested).toBeNull();
  expect(blocked.label).toBe('Not enough evidence');
  expect(blocked.reason).toMatch(/Incentive: Not enough evidence/);

  const three = db({
    USERS: [{ id: 'u1', role: 'designer' }],
    TASKS: [{ id: 't1', owner: 'u1', due: '2026-10-02', status: 'done', completedAt: '2026-10-02T09:00' }],
    PUNCHES: [
      { userId: 'u1', date: '2026-10-05', in: '09:00', late: false },
      { userId: 'u1', date: '2026-10-06', in: '10:30', late: true },
    ],
    REVIEWS: [{ id: 'rv', userId: 'u1', month: '2026-10', score: 4 }],
    GOALS: [],
  });
  const eligible = performanceFor(three, 'u1', quarter, '2026-10-08');
  expect(eligible.dimensions.filter((d) => d.score != null).length).toBe(3);
  const recommended = suggestIncentive(rules, eligible);
  expect(recommended.suggested).toBe(40000);
  expect(recommended.label).toBe('Solid');
  expect(recommended.reason).toMatch(/Recommendation based on complete performance evidence/);
});

test('contribution records do not invent a contribution score', () => {
  const store = db({
    USERS: [{ id: 'u1', role: 'designer' }],
    CONTRIBUTIONS: [{ id: 'c1', userId: 'u1', kind: 'mentoring', title: 'Reviewed a junior set', at: '2026-10-07T10:00' }],
    GOALS: [],
  });
  const result = performanceFor(store, 'u1', quarter, '2026-10-08');
  const contribution = result.dimensions.find((d) => d.id === 'contribution');
  expect(contribution.score).toBeNull();
  expect(contribution.records[0].title).toBe('Reviewed a junior set');
  expect(contribution.formula).toMatch(/no contribution percentage/);
  expect(result.coverage).toBe('Based on 0 of 5 dimensions.');
  expect(result.score).toBeNull();
});

test('a milestone counts for one accountable person', () => {
  const assigned = { id: 'm1', name: 'Slab', date: '2026-10-02', done: false, ownerId: 'u1' };
  const open = { id: 'm2', name: 'Roof', date: '2026-10-03', done: false };
  const store = db({
    PROJECTS: [{
      id: 'p',
      name: 'House',
      milestones: [
        assigned,
        open,
        { id: 'm3', name: 'Late', date: '2026-10-01', done: true, doneAt: '2026-10-04T10:00', ownerId: 'u1', doneBy: 'u2' },
      ],
    }],
    BADGES: [{ id: 'project-finisher', name: 'Project Finisher', rule: 'milestones', threshold: 1, desc: 'one' }],
  });
  expect(milestoneCount(store, 'u1')).toBe(0);
  expect(milestoneCount(store, 'u2')).toBe(0);
  applyMilestone(store, assigned, '2026-10-02T10:00', 'u2', idFn);
  applyMilestone(store, open, '2026-10-03T10:00', 'u2', idFn);
  expect(store.POINTS_LEDGER.map((e) => e.userId)).toEqual(['u2', 'u1']);
  expect(store.POINTS_LEDGER.filter((e) => e.sourceId === 'm1')).toEqual([
    expect.objectContaining({ userId: 'u1', points: 15, sourceType: 'milestone_done' }),
  ]);
  expect(store.POINTS_LEDGER.filter((e) => e.sourceId === 'm2')).toEqual([
    expect.objectContaining({ userId: 'u2', points: 15, sourceType: 'milestone_done' }),
  ]);
  expect(milestoneCount(store, 'u1')).toBe(1);
  expect(milestoneCount(store, 'u2')).toBe(1);
  evaluateBadges(store, 'u1', '2026-10-08', idFn);
  evaluateBadges(store, 'u2', '2026-10-08', idFn);
  expect(store.BADGE_AWARDS.map((a) => a.userId).sort()).toEqual(['u1', 'u2']);
  expect(store.BADGE_AWARDS.filter((a) => a.userId === 'u1')).toHaveLength(1);
  expect(store.BADGE_AWARDS.filter((a) => a.userId === 'u2')).toHaveLength(1);
});
