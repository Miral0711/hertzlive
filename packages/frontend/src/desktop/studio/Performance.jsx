import { state, svc, can, fmtD, fmtDT, go, inr, me, render, toast } from '../../shared/core.js';
import { TODAY } from '../../shared/data.js';
import { periodChoices, fyOf } from '../../shared/performance.js';
import {
  Avatar, Bar, Btn, Card, DataTable, Empty, Input, Pill, Select, Switch, Tabs,
} from '../../ui/ui';
import { name, first } from '../helpers';
import { openDialog } from '../session';
import { SecHead, Stat } from './common';

const statusKind = (s) => (s === 'met' ? 'ok' : s === 'missed' ? 'crit' : 'soft');
const periodQuery = (q, period) => {
  const who = q.who ? `&who=${encodeURIComponent(q.who)}` : '';
  const section = q.section ? `&section=${encodeURIComponent(q.section)}` : '';
  return `#/people?tab=performance&period=${encodeURIComponent(period)}${who}${section}`;
};
const whenOf = (e) => e.createdAt || e.at;

function PeriodSelect({ q }) {
  const choices = periodChoices(TODAY);
  return (
    <Select aria-label="Period" value={choices.some((p) => p.id === q.period) ? q.period : periodChoices(TODAY).find((p) => p.kind === 'quarter').id} onChange={(e) => go(periodQuery({ ...q, who: q.who }, e.target.value))}>
      {choices.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
    </Select>
  );
}

function Goals({ goals }) {
  if (!goals?.length) return <Empty>No goals for this period.</Empty>;
  return goals.map((g) => (
    <div key={g.id} className="border-t border-line py-3 first:border-t-0 first:pt-0">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <b>{g.name}</b>
        <Pill kind={statusKind(g.status)}>{g.current == null ? 'Not enough evidence' : g.status === 'met' ? 'Met' : g.status === 'missed' ? 'Missed' : 'In progress'}</Pill>
      </div>
      {g.description && <p className="mb-2 mt-0 text-[13px] text-ink-3">{g.description}</p>}
      {g.current != null && <Bar value={!g.target ? 0 : Math.min(100, Math.round((g.current / g.target) * 100))} />}
      <p className="mb-0 mt-1.5 text-[13px] text-ink-3">
        {g.current == null ? 'Not enough evidence yet' : <><b className="text-ink">{g.current}%</b> of {g.target}% target</>}
        {' · '}{g.scope === 'team' ? 'Team' : name(g.userId)} · {fmtD(g.start)} – {fmtD(g.end)}
      </p>
      {g.formula && <p className="mb-0 mt-1 text-[13px] text-ink-3">{g.formula}</p>}
    </div>
  ));
}

function scoreLabel(performance) {
  if (!performance || performance.score == null) return 'Not enough evidence';
  return performance.partial ? `${performance.score} · partial` : String(performance.score);
}

function evidenceValue(n) {
  return n == null ? 'Not enough evidence' : `${n}%`;
}

function HowCalculated({ performance, period }) {
  if (!performance) return null;
  return (
    <Card title={period ? period.label : 'Performance'}>
      <p className="mt-0 text-ink-2">
        {performance.score == null
          ? <b>Not enough evidence</b>
          : <><b className="text-2xl text-accent-text">{performance.score}</b> {performance.partial ? 'partial score' : 'performance'}</>}
      </p>
      {performance.coverage && <p className="mb-1 text-[13px] text-ink-2">{performance.coverage}</p>}
      {performance.partial && performance.score != null && <p className="mb-1 text-[13px] text-ink-2">This is a partial score, not a complete evaluation.</p>}
      <details className="mt-2 border-t border-line pt-2">
        <summary className="cursor-pointer text-[13px] font-semibold text-accent-text">How calculated?</summary>
        <p className="text-[13px] text-ink-3">{performance.formula}</p>
        {performance.dimensions.map((d) => (
          <div key={d.id} className="border-t border-line py-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <b>{d.label}</b>
              <span>{d.score == null ? 'Not enough evidence' : d.score} · weight {d.weight}</span>
            </div>
            <p className="mb-0 mt-1 text-[13px] text-ink-3">{d.formula}</p>
            {d.records?.length ? (
              <ul className="mb-0 mt-1 pl-4 text-[13px] text-ink-2">
                {d.records.slice(0, 12).map((r) => <li key={`${d.id}-${r.id}-${r.title}`}>{r.title} · {r.outcome}</li>)}
              </ul>
            ) : <p className="mb-0 mt-1 text-[13px] text-ink-3">No records in this period.</p>}
          </div>
        ))}
      </details>
    </Card>
  );
}

function RecognitionList({ rows }) {
  if (!rows.length) return <Empty>No recognition in this period.</Empty>;
  return rows.map((r) => (
    <div key={r.id} className="border-t border-line py-2.5 first:border-t-0 first:pt-0">
      <b className="block">{r.message}</b>
      <small className="text-ink-3">{name(r.userId)} · {first(r.by)} · {fmtDT(r.at)}{r.projectId ? ` · ${state.db.PROJECTS.find((p) => p.id === r.projectId)?.name || ''}` : ''}</small>
    </div>
  ));
}

function Achievements({ rows }) {
  if (!rows.length) return <Empty>No achievements yet. A badge appears only when its rule is met. It is not a rating or a bonus.</Empty>;
  return (
    <>
      <p className="mt-0 text-[13px] text-ink-3">A badge records that a rule was met. It is not a performance score and it is not pay.</p>
      {rows.map((a) => (
        <div key={a.id} className="border-t border-line py-2.5">
          <div className="flex items-baseline justify-between gap-3"><b>{a.badge.name}</b><small className="text-ink-3">{fmtD(a.earnedAt)}</small></div>
          <p className="mb-0 mt-1 text-[13px] text-ink-2">{a.badge.desc}</p>
          <p className="mb-0 mt-1 text-[13px] text-ink-3">{a.reason}</p>
        </div>
      ))}
    </>
  );
}

function PointsHistory({ userId, periodId }) {
  const history = svc.pointsHistory(userId, periodId);
  const meUser = me();
  return (
    <>
      {history.length === 0 ? <Empty>No points in this period. Points are a record of specific actions, separate from the performance score.</Empty> : (
        <DataTable cols={['When', 'Points', 'Reason', 'Source']} rows={history.map((e) => [fmtDT(whenOf(e)), `+${e.points}`, e.reason, (e.sourceType || '').replace(/_/g, ' ')])} />
      )}
      {userId === state.userId && (
        <div className="mt-3.5">
          <Switch
            on={!!meUser?.ptsOptOut}
            onClick={() => { svc.setOptOut(!meUser?.ptsOptOut); toast(meUser?.ptsOptOut ? 'You are back on the optional points list.' : 'You are hidden from the optional points list.'); render(); }}
            label="Hide me from the optional points list"
            sub="Your tasks, attendance and points are still recorded. This does not change your performance score."
          />
        </div>
      )}
    </>
  );
}

function Rules() {
  if (!can('achievement', 'w')) return null;
  const save = (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    svc.savePointRules((state.db.POINT_RULES || []).map((r) => ({ id: r.id, points: data.get(r.id), enabled: data.get(`${r.id}-on`) === 'on' })));
    (state.db.BADGES || []).forEach((b) => svc.saveBadgeThreshold(b.id, data.get(`badge-${b.id}`)));
    const weights = {};
    ['designer', 'site_manager', 'hr', 'partner'].forEach((role) => {
      weights[role] = {};
      ['delivery', 'reliability', 'quality', 'contribution', 'goals'].forEach((key) => {
        weights[role][key] = data.get(`w-${role}-${key}`);
      });
    });
    svc.savePerformanceWeights(weights);
    toast('Rules saved.');
    render();
  };
  return (
    <Card title="Point and achievement rules" className="mt-3.5">
      <p className="mt-0 text-[13px] text-ink-3">These values apply the next time the work happens. They are not connected to salary.</p>
      <form onSubmit={save} className="flex flex-col gap-2">
        {(state.db.POINT_RULES || []).map((r) => (
          <label key={r.id} className="flex flex-wrap items-center gap-2 text-[13px]">
            <input type="checkbox" name={`${r.id}-on`} value="on" defaultChecked={r.enabled !== false && r.points > 0} />
            <span className="min-w-[220px] flex-1">{r.label}</span>
            <Input name={r.id} type="number" min="0" defaultValue={r.points} className="w-24" aria-label={`${r.label} points`} />
          </label>
        ))}
        <p className="mb-0 mt-2 text-[13px] font-semibold text-ink-2">Achievement thresholds</p>
        {(state.db.BADGES || []).map((b) => (
          <label key={b.id} className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="min-w-[220px] flex-1">{b.icon} {b.name}</span>
            <Input name={`badge-${b.id}`} type="number" min="1" defaultValue={b.threshold} className="w-24" aria-label={`${b.name} threshold`} />
          </label>
        ))}
        <p className="mb-0 mt-2 text-[13px] font-semibold text-ink-2">Role weights</p>
        <p className="mb-0 text-[13px] text-ink-3">Open periods use these weights. A closed period keeps the weights it was locked with.</p>
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
          <span className="min-w-[120px]">Role</span>
          {['Delivery', 'Reliability', 'Quality', 'Contribution', 'Goals'].map((label) => <span key={label} className="w-20">{label}</span>)}
        </div>
        {['designer', 'site_manager', 'hr', 'partner'].map((role) => (
          <div key={role} className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="min-w-[120px]">{role === 'site_manager' ? 'Site manager' : role[0].toUpperCase() + role.slice(1)}</span>
            {['delivery', 'reliability', 'quality', 'contribution', 'goals'].map((key) => (
              <Input key={key} name={`w-${role}-${key}`} type="number" min="0" defaultValue={state.db.PERFORMANCE_WEIGHTS?.[role]?.[key] ?? 0} className="w-20" aria-label={`${role} ${key} weight`} />
            ))}
          </div>
        ))}
        <div><Btn kind="primary" type="submit">Save rules</Btn></div>
      </form>
    </Card>
  );
}

function needsAttention(people) {
  return people.flatMap(({ user, metrics }) => {
    const notes = [];
    if (metrics.tasks.onTimePct != null && metrics.tasks.onTimePct < 70) notes.push(`Delivery ${metrics.tasks.onTimePct}%`);
    if (metrics.issues.slaPct != null && metrics.issues.slaPct < 70) notes.push(`SLA ${metrics.issues.slaPct}%`);
    if (metrics.attendancePct != null && metrics.attendancePct < 70) notes.push(`Reliability ${metrics.attendancePct}%`);
    if ((metrics.goals || []).some((g) => g.scope === 'individual' && g.status === 'missed')) notes.push('A goal was missed');
    return notes.length ? [{ user, notes }] : [];
  });
}

export function Performance({ q }) {
  if (!can('performance', 'r')) return <Empty>Performance isn’t available for this login.</Empty>;
  const choices = periodChoices(TODAY);
  const period = choices.find((p) => p.id === q.period) || choices.find((p) => p.kind === 'quarter');
  const studio = state.role === 'partner' || state.role === 'hr';
  const teamView = studio || state.role === 'site_manager';
  const sections = teamView
    ? [
      ['team', 'Team performance'],
      ['goals', 'Goals'],
      ['evidence', 'Evidence'],
      ['recognition', 'Recognition'],
      ...(studio ? [['trends', 'Trends']] : []),
    ]
    : [['performance', 'My performance'], ['goals', 'Goals'], ['recognition', 'Recognition'], ['achievements', 'Achievements'], ['points', 'Points history']];
  const section = sections.some(([k]) => k === q.section) ? q.section : sections[0][0];
  const snapshot = teamView ? svc.teamPerformance(period.id) : null;
  const allowed = new Set((snapshot?.people || []).map((p) => p.user.id));
  const focus = teamView && allowed.has(q.who) ? q.who : state.userId;
  const metrics = svc.personMetrics(focus, period.id);
  const focusUser = state.db.USERS.find((u) => u.id === focus);
  const openPerson = (id) => go(periodQuery({ period: period.id, who: id, section: 'evidence' }, period.id));
  const teamRecognitions = (snapshot?.people || []).flatMap(({ metrics: m }) => m.recognitions || []);
  const attention = snapshot ? needsAttention(snapshot.people) : [];
  const showQuality = studio;
  return (
    <>
      <SecHead
        title={teamView ? 'Team performance' : 'My performance'}
        sub={`${period.label} · ${fmtD(period.start)} – ${fmtD(period.end)}. The score is the work in this period. Points are a separate record.`}
      >
        <PeriodSelect q={{ ...q, period: period.id, section }} />
        {can('goal', 'w') && <Btn onClick={() => openDialog({ kind: 'goal', periodId: period.id })}>Add goal</Btn>}
        {can('recognition', 'w') && <Btn kind="primary" onClick={() => openDialog({ kind: 'recognition', userId: focus !== state.userId ? focus : undefined })}>Recognize</Btn>}
        {can('incentive', 'r') && <Btn onClick={() => go('#/people?tab=incentives')}>Incentive planning</Btn>}
      </SecHead>
      <Tabs current={section} onSelect={(k) => go(periodQuery({ period: period.id, who: q.who, section: k }, period.id))} list={sections} />
      {section === 'team' && snapshot && (
        <>
          <div className="mb-3.5 grid grid-cols-2 gap-gap lg:grid-cols-4">
            <Stat label="Delivery" value={evidenceValue(snapshot.onTimePct)} sub={snapshot.onTimePct == null ? 'No tasks due' : `${snapshot.tasksCompleted} completed`} />
            <Stat label="Issue SLA" value={evidenceValue(snapshot.slaPct)} sub={snapshot.slaPct == null ? 'No issues due' : `${snapshot.issuesResolved} resolved`} />
            <Stat label="Goals" value={evidenceValue(snapshot.goalPct)} sub={snapshot.goals.length ? `${snapshot.goals.filter((g) => g.status === 'met').length} met` : 'No goal this period'} />
            <Stat label="Reliability" value={evidenceValue(snapshot.attendancePct)} sub={snapshot.attendancePct == null ? 'No check-ins recorded' : 'On-time check-ins'} />
          </div>
          {!!attention.length && (
            <Card title="Needs attention" className="mb-3.5">
              {attention.map(({ user, notes }) => (
                <button key={user.id} type="button" className="flex w-full items-baseline justify-between gap-3 border-t border-line bg-transparent px-0 py-2.5 text-left first:border-t-0 first:pt-0" onClick={() => openPerson(user.id)}>
                  <b className="text-accent-text">{user.name}</b>
                  <span className="text-[13px] text-ink-3">{notes.join(' · ')}</span>
                </button>
              ))}
            </Card>
          )}
          <Card title="People">
            <DataTable
              cols={['Employee', 'Performance', 'Delivery', 'SLA', 'Goals', 'Reliability', ...(showQuality ? ['Quality'] : []), 'Recognition']}
              rows={snapshot.people.map(({ user: u, metrics: m }) => [
                <button key={u.id} type="button" className="inline-flex items-center gap-2 bg-transparent p-0 font-semibold text-accent-text" onClick={() => openPerson(u.id)}>
                  <Avatar accent sm>{u.ini || u.name.slice(0, 1)}</Avatar>{u.name}
                </button>,
                scoreLabel(m.performance),
                evidenceValue(m.tasks.onTimePct),
                evidenceValue(m.issues.slaPct),
                evidenceValue(m.goalPct),
                evidenceValue(m.attendancePct),
                ...(showQuality ? [m.performance?.dimensions?.find((d) => d.id === 'quality')?.score == null ? 'Not enough evidence' : String(m.performance.dimensions.find((d) => d.id === 'quality').score)] : []),
                m.recognitions.length ? String(m.recognitions.length) : 'None',
              ])}
            />
          </Card>
          {can('achievement', 'w') && (
            <details className="mt-3.5">
              <summary className="cursor-pointer text-[13px] font-semibold text-ink-2">Point, badge and weight rules</summary>
              <Rules />
            </details>
          )}
          {state.role === 'partner' && (
            <details className="mt-3.5">
              <summary className="cursor-pointer text-[13px] font-semibold text-ink-2">Optional points list</summary>
              <p className="text-[13px] text-ink-3">Points earned in {period.label}. This is not the performance score. People who opt out are left off.</p>
              <Switch
                on={state.db.LEADERBOARD?.on !== false}
                onClick={() => { svc.setLeaderboard(state.db.LEADERBOARD?.on === false); render(); }}
                label="Include this list for partners"
                sub="Hiding it does not stop recording work."
              />
              {state.db.LEADERBOARD?.on !== false && (
                <DataTable
                  cols={['Person', 'Points this period', 'On-time streak']}
                  rows={svc.leaderboard(period.id).map((row) => [row.user.name, row.points.toLocaleString('en-IN'), row.streak ? `${row.streak} days` : 'Not enough evidence'])}
                />
              )}
            </details>
          )}
        </>
      )}
      {section === 'performance' && (
        metrics ? <HowCalculated performance={metrics.performance} period={period} /> : <Empty>This performance record isn’t available for your login.</Empty>
      )}
      {section === 'evidence' && (
        <>
          <p className="mt-0 text-[13px] text-ink-3">{focusUser?.name || 'Employee'} · {period.label}. Review text stays on the Reviews tab. {state.role === 'site_manager' ? 'Review scores stay with the person, HR and partners.' : ''}</p>
          {metrics ? <HowCalculated performance={metrics.performance} period={period} /> : <Empty>Choose someone from Team performance.</Empty>}
        </>
      )}
      {section === 'goals' && (
        <Card title="Goals">
          <Goals goals={teamView ? (snapshot?.goals || []) : (metrics?.goals || []).filter((g) => g.scope === 'individual')} />
        </Card>
      )}
      {section === 'recognition' && (
        <Card title="Recognition">
          <p className="mt-0 text-[13px] text-ink-3">A note about someone’s work. It is not converted into points or into the performance score.</p>
          <RecognitionList rows={teamView ? teamRecognitions : (metrics?.recognitions || [])} />
        </Card>
      )}
      {section === 'achievements' && <Card title="Achievements"><Achievements rows={metrics?.achievements || []} /></Card>}
      {section === 'points' && (
        <Card title="Points history">
          <p className="mt-0 text-[13px] text-ink-3">Each row is one recorded action. The total is not the performance score.</p>
          <PointsHistory userId={focus} periodId={period.id} />
        </Card>
      )}
      {section === 'trends' && (
        <Card title="Reliability">
          <p className="mt-0 text-[13px] text-ink-3">On-time check-ins divided by recorded working-day check-ins. A month with no punches is not shown as zero.</p>
          {svc.attendanceTrend().map((m) => (
            <div key={m.id} className="mb-2.5">
              <div className="mb-1 flex justify-between text-[13px]"><span>{m.label}</span><b>{m.pct == null ? 'Not enough evidence' : `${m.pct}%`}</b></div>
              {m.pct != null && <Bar value={m.pct} />}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

export function Incentives({ q }) {
  if (!can('incentive', 'r')) return <Empty>Incentive planning is for partners and HR.</Empty>;
  const years = periodChoices(TODAY).filter((p) => p.kind === 'year');
  const current = fyOf(TODAY);
  const period = years.find((p) => p.id === q.fy) || current;
  const loaded = svc.incentivePlan(period.id);
  if (!loaded) return null;
  const { plan } = loaded;
  const people = svc.people();
  const saveRules = (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    svc.saveIncentiveRules((state.db.INCENTIVE_RULES?.bands || []).map((b) => ({ ...b, minIndex: data.get(`${b.id}-min`), suggested: data.get(b.id) })));
    toast('Incentive bands saved.');
    render();
  };
  return (
    <>
      <SecHead title="Incentive planning" sub={`${period.label}. A recommendation from the performance score. It is not added to salary or payroll until a partner approves a final amount.`}>
        <Select aria-label="Financial year" value={period.id} onChange={(e) => go(`#/people?tab=incentives&fy=${encodeURIComponent(e.target.value)}`)}>
          {years.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </Select>
      </SecHead>
      <p className="mt-0 text-[13px] text-ink-3">Performance summary → Evidence → Suggested incentive → Review → Partner adjustment → Approval. Recommendation based on complete performance evidence.</p>
      {people.map((u) => {
        const row = svc.suggestFor(u.id, period.id);
        if (!row) return null;
        const line = plan.lines?.[u.id] || { adjustment: null, status: 'draft', reason: '' };
        const final = line.adjustment != null ? line.adjustment : row.suggestion.suggested;
        const performance = row.metrics.performance;
        const used = (performance?.dimensions || []).filter((d) => d.score != null);
        const missing = (performance?.dimensions || []).filter((d) => d.score == null).map((d) => d.label);
        return (
          <Card key={u.id} className="mb-3.5" title={u.name}>
            <p className="mt-0 text-[13px] text-ink-2"><b>Performance summary.</b> {scoreLabel(performance)}{performance?.coverage ? ` · ${performance.coverage}` : ''}</p>
            <p className="text-[13px] text-ink-2"><b>Evidence.</b> {used.length ? used.map((d) => `${d.label} ${d.score}`).join(' · ') : 'Not enough evidence'}{missing.length ? `. No records for ${missing.join(', ')}.` : ''}</p>
            <p className="text-[13px] text-ink-2"><b>Suggested incentive.</b> {row.suggestion.suggested == null ? 'Incentive: Not enough evidence' : <>{inr(row.suggestion.suggested)}. This is a recommendation, not an automatic bonus.</>}</p>
            {row.suggestion.reason && <p className="text-[13px] text-ink-3">{row.suggestion.reason}</p>}
            {can('incentive', 'w') && line.status !== 'approved' && (
              <div className="mb-2 flex flex-wrap items-end gap-3">
                <label className="text-[13px] font-semibold text-ink-2">
                  {can('incentive', 'a') ? 'Partner adjustment' : 'Proposed adjustment'}
                  <Input
                    type="number"
                    min="0"
                    className="mt-1 w-32"
                    aria-label={`Adjustment for ${u.name}`}
                    defaultValue={line.adjustment == null ? '' : line.adjustment}
                    placeholder={row.suggestion.suggested == null ? '' : String(row.suggestion.suggested)}
                    onBlur={(e) => { svc.saveIncentiveLine(period.id, u.id, { adjustment: e.target.value }); render(); }}
                  />
                </label>
                <label className="min-w-[220px] flex-1 text-[13px] font-semibold text-ink-2">
                  Reason
                  <Input
                    className="mt-1"
                    aria-label={`Reason for ${u.name}`}
                    defaultValue={line.reason || ''}
                    onBlur={(e) => { svc.saveIncentiveLine(period.id, u.id, { reason: e.target.value }); render(); }}
                  />
                </label>
              </div>
            )}
            <p className="text-[13px] text-ink-2"><b>Final.</b> {final == null ? 'Not enough evidence' : inr(final)}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Pill kind={line.status === 'approved' ? 'ok' : ''}>{line.status === 'approved' ? 'Approved' : 'Draft'}</Pill>
              {line.status === 'approved' && line.approvedBy && <span className="text-[13px] text-ink-3">{name(line.approvedBy)} · {fmtDT(line.approvedAt)}</span>}
              {can('incentive', 'a') && line.status !== 'approved' && (
                <Btn sm onClick={() => { svc.saveIncentiveLine(period.id, u.id, { status: 'approved' }); toast('Incentive approved.'); render(); }}>Approve</Btn>
              )}
              {!can('incentive', 'a') && line.status !== 'approved' && <span className="text-[13px] text-ink-3">A partner approves the final amount.</span>}
            </div>
          </Card>
        );
      })}
      {can('incentive', 'w') && (
        <Card title="Suggestion bands">
          <p className="mt-0 text-[13px] text-ink-3">These are the stored incentive rules. The first number is the score a band starts at. The second is the suggested amount. Defaults are only a sample until you save.</p>
          <form onSubmit={saveRules} className="flex flex-col gap-2">
            {(state.db.INCENTIVE_RULES?.bands || []).map((b) => (
              <label key={b.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="min-w-[140px] flex-1">{b.label}</span>
                <Input name={`${b.id}-min`} type="number" min="0" defaultValue={b.minIndex} className="w-24" aria-label={`${b.label} from score`} />
                <Input name={b.id} type="number" min="0" defaultValue={b.suggested} className="w-32" aria-label={`${b.label} amount`} />
              </label>
            ))}
            <div><Btn type="submit">Save bands</Btn></div>
          </form>
        </Card>
      )}
    </>
  );
}
