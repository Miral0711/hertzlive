import { state, svc, fmtD, uid, persist, toast, render, go, parseWA, AIProvider } from '../../shared/core.js';
import { TODAY } from '../../shared/data.js';
import { IMPORT_GROUPS, IMPORT_SHEET, WA_SAMPLE } from '../../shared/data2.js';
import { Btn, Card, DataTable, Kpi, Kpis, PageHeader, Pill, Select, Textarea, Input } from '../../ui/ui';
import { formData } from '../session';

export function parseImportSheet(text) {
  const lines = text.trim().split('\n').filter(Boolean);
  const header = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const c = line.split(',');
    const row = {};
    header.forEach((h, i) => { row[h] = (c[i] || '').trim(); });
    row.dup = state.db.PROJECTS.some((p) => p.code === row.code);
    return row;
  });
}

const ROLE_OPTS = ['skip', 'client', 'contractor', 'vendor', 'staff'];
const cap = (o) => o[0].toUpperCase() + o.slice(1);

function impResolveRole(imp, g, num) {
  const [phone, , rg] = num;
  if (rg) return rg.split(' ')[0];
  return imp.roles[`${g.file}|${phone}`] || 'skip';
}

const setRole = (imp, file, phone, v) => { imp.roles[`${file}|${phone}`] = v; render(); };
const setProj = (imp, file, v) => { imp.proj[file] = v; render(); };
const setStep = (n) => { state.desk.imp.step = n; render(); };
const RowRight = ({ children }) => <div className="mt-3 flex items-center justify-end gap-2">{children}</div>;

function RoleSelect({ imp, file, phone, upper }) {
  return (
    <Select aria-label={`Role for ${phone}`} value={imp.roles[`${file}|${phone}`] || 'skip'} onChange={(e) => setRole(imp, file, phone, e.target.value)}>
      {ROLE_OPTS.map((o) => <option key={o} value={o}>{upper ? cap(o) : o}</option>)}
    </Select>
  );
}

function ParsedCard({ imp }) {
  const pv = imp.parsed;
  if (!pv) return null;
  const st = pv.stats;
  const known = (who) => state.db.USERS.find((u) => u.name.toLowerCase() === who.toLowerCase()
    || u.name.split(' ')[0].toLowerCase() === who.split(' ')[0].toLowerCase());
  const label = (r) => (r.deleted ? <i>deleted</i>
    : r.system ? <i>{r.who} {r.at.slice(0, 10)} system</i>
      : r.file ? <><Pill kind="soft">{r.kind}</Pill> {r.file}{r.text ? ` · ${r.text}` : ''}</>
        : r.omitted ? <><Pill kind="soft">{r.kind}</Pill> not in export{r.text ? ` · ${r.text}` : ''}</>
          : <>{r.text}{r.edited && <> <i>edited</i></>}</>);
  return (
    <>
      <Kpis>
        {[['Messages', st.messages], ['Photos', st.photos], ['Videos', st.videos], ['Drawings and files', st.drawings], ['Deleted', st.deleted], ['Assignments (@)', st.mentions], ['Duplicate files', pv.dup]]
          .map(([l, v]) => <Kpi key={l} label={l} value={v} />)}
      </Kpis>
      <p className="text-[13px] text-ink-3">Photos and files marked "not in export" come in when you import with media. Bare numbers need a name and role once; the phone never shows a number as a name.</p>
      <DataTable
        cols={['Sender', 'Lines', 'Matches', 'Role']}
        rows={pv.senders.map((who) => {
          const u = known(who);
          const n = pv.rows.filter((r) => r.who === who && !r.system).length;
          return [
            who, n,
            u ? `${u.name} · ${u.role}` : who.startsWith('+') || who === 'Unknown number' ? <i>bare number</i> : '',
            u ? '' : <RoleSelect imp={imp} file="pasted" phone={who} />,
          ];
        })}
      />
      <details className="mt-2">
        <summary className="cursor-pointer">First {Math.min(12, pv.rows.length)} of {pv.rows.length} lines</summary>
        <DataTable
          cols={['When', 'Who', 'What']}
          rows={pv.rows.slice(0, 12).map((r) => [`${fmtD(r.at.slice(0, 10))} ${r.at.slice(11)}`, r.who, label(r)])}
        />
      </details>
    </>
  );
}

const projectOptions = (imp, fallback) => (imp.rows || []).map((r) => <option key={r.code} value={r.code}>{r.name} ({r.code})</option>).concat(
  imp.rows && imp.rows.length ? [] : [<option key="f" value={fallback}>{fallback}</option>]);

function Step1({ imp }) {
  const parse = (e) => {
    e.preventDefault();
    const p = formData(e.currentTarget);
    imp.sheet = p.sheet;
    imp.rows = parseImportSheet(p.sheet);
    render();
  };
  return (
    <Card title="Projects sheet">
      <form onSubmit={parse}>
        <Textarea name="sheet" rows={6} defaultValue={imp.sheet} className="w-full" aria-label="Projects sheet" />
        <RowRight><Btn kind="primary" type="submit">Parse</Btn></RowRight>
      </form>
      {imp.rows && (
        <DataTable
          cols={['Code', 'Name', 'Client', 'City', 'Status', 'Start', 'Handover', 'Note']}
          rows={imp.rows.map((r) => [<span className="font-mono">{r.code}</span>, r.name, r.client, r.city, r.status, r.start, r.handover, r.dup ? 'Duplicate, code exists' : ''])}
        />
      )}
      <RowRight><Btn kind="primary" onClick={() => setStep(2)}>Next</Btn></RowRight>
    </Card>
  );
}

function Step2({ imp }) {
  const parse = (e) => {
    e.preventDefault();
    imp.wa = formData(e.currentTarget).wa;
    imp.parsed = parseWA(imp.wa);
    render();
  };
  return (
    <Card title="WhatsApp exports">
      <p className="text-[13px] text-ink-3">Paste one exported group (iPhone or Android, without media is fine). Sample below is a real export, redacted.</p>
      <form onSubmit={parse}>
        <Textarea name="wa" rows={7} defaultValue={imp.wa} aria-label="WhatsApp export" className="w-full font-mono text-xs" />
        <RowRight>
          <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">Into project
            <Select value={imp.proj.pasted || (imp.rows || [])[0]?.code || ''} onChange={(e) => setProj(imp, 'pasted', e.target.value)}>
              {(imp.rows || []).map((r) => <option key={r.code} value={r.code}>{r.name} ({r.code})</option>)}
            </Select>
          </label>
          <Btn kind="primary" type="submit">Parse export</Btn>
        </RowRight>
      </form>
      <ParsedCard imp={imp} />
      <h3 className="mb-1 mt-4 text-base font-semibold">Files found on this Mac</h3>
      {IMPORT_GROUPS.map((g) => {
        const proj = imp.proj[g.file] || g.guess;
        return (
          <div key={g.file} className="border-b border-line py-2">
            <b>{g.file}</b> — {g.msgs} messages, {g.photos} photos, {g.dup} duplicates to skip
            <div className="mt-1.5 max-w-sm">
              <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink-2">Project
                <Select value={proj} onChange={(e) => setProj(imp, g.file, e.target.value)}>{projectOptions(imp, proj)}</Select>
              </label>
            </div>
            <DataTable
              cols={['Phone', 'Name', 'Role']}
              rows={g.numbers.map(([phone, nm, rg]) => [phone, nm, rg || <RoleSelect imp={imp} file={g.file} phone={phone} upper />])}
            />
          </div>
        );
      })}
      <RowRight><Btn onClick={() => setStep(1)}>Back</Btn><Btn kind="primary" onClick={() => setStep(3)}>Next</Btn></RowRight>
    </Card>
  );
}

async function getFacts(imp, file) {
  const g = IMPORT_GROUPS.find((x) => x.file === file);
  imp.facts[file] = 'Thinking…';
  render();
  imp.facts[file] = await AIProvider.projectFacts(g);
  render();
}

function Step3({ imp }) {
  return (
    <Card title="AI project facts">
      <p className="rounded-r1 bg-accent-soft px-3 py-2 text-accent-text">AI suggestion, edit before confirming</p>
      {IMPORT_GROUPS.map((g) => {
        const f = imp.facts[g.file];
        if (!f) {
          return (
            <div key={g.file} className="flex items-center gap-2.5 border-b border-line py-2">
              <span className="flex-1">{g.file}</span><Btn sm onClick={() => getFacts(imp, g.file)}>Get AI facts</Btn>
            </div>
          );
        }
        if (typeof f === 'string') return <div key={g.file} className="border-b border-line py-2"><b>{g.file}</b><p role="status" className="text-ink-3">{f}</p></div>;
        const field = (label, name, extra = {}) => (
          <div className="mb-2.5 flex flex-col gap-1"><label className="flex flex-col gap-1 text-[13px] font-semibold text-ink-2">{label}<Input name={name} defaultValue={f[name]} {...extra} /></label></div>
        );
        return (
          <form key={g.file} className="border-b border-line py-2" onSubmit={(e) => { e.preventDefault(); imp.confirmed[g.file] = true; render(); }}>
            <b>{g.file}</b>
            {field('Client', 'client')}
            {field('Address', 'address')}
            {field('Phase', 'phase', { type: 'number' })}
            {field('Money', 'money')}
            <div>{(f.decisions || []).map((d, i) => <label key={i} className="block"><input type="checkbox" name={`d${i}`} defaultChecked /> {d}</label>)}</div>
            <RowRight><Btn kind="primary" type="submit">{imp.confirmed[g.file] ? 'Confirmed' : 'Confirm'}</Btn></RowRight>
          </form>
        );
      })}
      <RowRight><Btn onClick={() => setStep(2)}>Back</Btn><Btn kind="primary" onClick={() => setStep(4)}>Next</Btn></RowRight>
    </Card>
  );
}

function dryRun(imp) {
  const n = (imp.rows || []).filter((r) => !r.dup).length;
  imp.dry = `Dry run: would create ${n} project${n === 1 ? '' : 's'}, add people, and file messages and photos. Nothing was written.`;
  render();
}

function runImport(imp) {
  (imp.rows || []).filter((r) => !r.dup).forEach((r) => {
    state.db.PROJECTS.push({
      ...JSON.parse(JSON.stringify(state.db.PROJECTS[0])),
      id: uid(), code: r.code, name: r.name, status: r.status || 'active', start: r.start, handover: r.handover, imported: TODAY,
      ...(r.status === 'finished' ? { finishedAt: r.handover, finishedBy: state.userId } : {}),
    });
  });
  persist();
  toast('Import complete.');
  state.desk.imp = null;
  go('#/projects?status=all');
}

function Step4({ imp }) {
  const newRows = (imp.rows || []).filter((r) => !r.dup);
  const pv = imp.parsed?.stats || { messages: 0, photos: 0 };
  const sum = (k) => IMPORT_GROUPS.reduce((a, g) => a + g[k], 0);
  const people = IMPORT_GROUPS.reduce((a, g) => a + g.numbers.filter((num) => impResolveRole(imp, g, num) !== 'skip').length, 0);
  return (
    <Card title="Preview & import">
      <ul className="list-disc pl-5">
        <li>Projects to create: {newRows.length}</li>
        <li>Messages: {sum('msgs') + pv.messages}</li>
        <li>Photos with EXIF dates: {sum('photos') + pv.photos}</li>
        <li>Duplicates skipped: {sum('dup') + (imp.parsed?.dup || 0)}</li>
        <li>People to add: {people}</li>
      </ul>
      <p>Active projects will appear on phones immediately with all messages and photos. Finished ones stay on desktop.</p>
      {imp.dry && <div role="status" className="rounded-r1 bg-accent-soft px-3 py-2 text-accent-text">{imp.dry}</div>}
      <RowRight>
        <Btn onClick={() => setStep(3)}>Back</Btn>
        <Btn onClick={() => dryRun(imp)}>Dry run</Btn>
        <Btn kind="primary" onClick={() => runImport(imp)}>Import</Btn>
      </RowRight>
    </Card>
  );
}

const STEPS = { 1: Step1, 2: Step2, 3: Step3, 4: Step4 };
const LABELS = ['Projects sheet', 'WhatsApp exports', 'AI project facts', 'Preview & import'];

export default function ImportPage() {
  const imp = (state.desk.imp = state.desk.imp || {
    step: 1, sheet: IMPORT_SHEET, wa: WA_SAMPLE, parsed: null, rows: null, proj: {}, roles: {}, facts: {}, confirmed: {}, dry: '',
  });
  const Step = STEPS[imp.step];
  void svc;
  return (
    <>
      <PageHeader title="Import from WhatsApp" />
      <div className="mb-4 flex flex-wrap gap-2">
        {LABELS.map((l, i) => (
          <Btn key={l} sm kind={imp.step === i + 1 ? 'primary' : 'default'} aria-current={imp.step === i + 1 ? 'step' : undefined} onClick={() => setStep(i + 1)}>{i + 1}. {l}</Btn>
        ))}
      </div>
      <Step key={imp.step} imp={imp} />
    </>
  );
}
