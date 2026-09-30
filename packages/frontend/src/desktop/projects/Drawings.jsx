import { useEffect, useRef } from 'react';
import { state, svc, can, toast, persist, render, fmtD, fmtDT } from '../../shared/core.js';
import { Btn, Card, DataTable, Grid2, StatusPill, Empty } from '../../ui/ui';
import Icon from '../../ui/Icon';
import { filedRows } from '../parts';
import { first, name } from '../helpers';
import { openDialog, openMsg } from '../session';
import {
  role, staff, FromChat, H2, Sub, Mono, Details, desktopDrawingShortcuts,
} from './common';

// ---------- personal shortcuts ----------
export function rememberDesktopDrawing(projectId, no, save = false) {
  const p = svc.project(projectId);
  const d = p?.drawings.find((d) => d.no === no);
  if (!d || !can('drawing', 'r', role())) return false;
  try {
    const key = `archos-desktop-drawings:${state.userId}:${role()}`;
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    const kind = save ? 'saved' : 'recent';
    const old = Array.isArray(data[kind]) ? data[kind] : [];
    const list = old.filter((x) => x && (x.projectId !== projectId || x.no !== no));
    const removing = save && list.length !== old.length;
    data[kind] = removing ? list : [{ projectId, no, rev: d.rev }, ...list];
    if (!save) data[kind] = data[kind].slice(0, 12);
    localStorage.setItem(key, JSON.stringify(data));
    state.desk.drawingSaveError = '';
    return true;
  } catch (_) {
    state.desk.drawingSaveError = 'Drawing shortcut could not be saved on this device. Try again.';
    toast(state.desk.drawingSaveError);
    return false;
  }
}

// ---------- handlers ----------
export function drawingSave(projectId, no) {
  if (rememberDesktopDrawing(projectId, no, true)) {
    toast(desktopDrawingShortcuts(projectId, 'saved').some((x) => x.no === no)
      ? 'Drawing shortcut saved for you on this browser.'
      : 'Drawing shortcut removed.');
  }
  render();
}
export function drawingView(projectId, no) {
  if (!can('drawing', 'r', role()) || !svc.project(projectId)?.drawings.some((d) => d.no === no)) return toast('Drawing unavailable.');
  rememberDesktopDrawing(projectId, no);
  state.desk.zoom = 1;
  openDialog({ kind: 'drawing-view', projectId, no });
}
const scrollToSheet = () =>
  setTimeout(() => document.querySelector('canvas.sheet')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 0);
export function openSheet(no) {
  if (state.desk.sheetNo === no) {
    scrollToSheet();
    return toast(`${no} is already open below.`);
  }
  state.desk.sheetNo = no;
  state.desk.markup = [];
  render();
  scrollToSheet();
}
export function zoomIn() {
  if ((state.desk.zoom || 1) >= 3) return toast('Maximum zoom.');
  state.desk.zoom = Math.min(3, (state.desk.zoom || 1) + 0.25);
  render();
}
export function zoomOut() {
  if ((state.desk.zoom || 1) <= 0.5) return toast('Minimum zoom.');
  state.desk.zoom = Math.max(0.5, (state.desk.zoom || 1) - 0.25);
  render();
}
export function zoomFit() {
  state.desk.zoom = 1;
  render();
}
function markupClear() {
  if (!state.desk.markup.length) return toast('No marks on this sheet yet. Click the sheet to add one.');
  state.desk.markup = [];
  render();
  toast('Marks cleared.');
}
function markupSend(projectId) {
  const ts = svc.threads().filter((x) => x.projectId === projectId);
  const t = ts.find((x) => x.kind === 'site') || ts[0];
  if (!t) return toast('No site chat for this project.');
  const sheetNo = state.desk.sheetNo || 'HA-2401-A-101';
  const id = svc.addMessage(t.id, {
    text: `Markup on ${sheetNo}: ${state.desk.markup.length} cloud${state.desk.markup.length === 1 ? '' : 's'}. Please check before casting.`,
  });
  state.filings[id] = {
    msgId: id, projectId, room: null, kind: 'drawing', drawing: sheetNo, conf: 1, status: 'filed', by: 'user',
  };
  persist();
  state.desk.markup = [];
  openMsg(id);
  toast('Sent to site chat.');
}

// ---------- demonstration sheet ----------
// Intentional exception: this simulates a printed drawing sheet — white paper, black linework,
// red markup ink — which stays fixed regardless of the app's theme, the same way a real drawing
// print would.
function paintSheet(c) {
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = '#dde6eb';
  x.lineWidth = 1;
  for (let i = 0; i < c.width; i += 40) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i, c.height); x.stroke();
  }
  for (let i = 0; i < c.height; i += 40) {
    x.beginPath(); x.moveTo(0, i); x.lineTo(c.width, i); x.stroke();
  }
  x.strokeStyle = '#333';
  x.lineWidth = 2;
  x.strokeRect(80, 60, 600, 400);
  x.strokeRect(80, 60, 260, 180);
  x.strokeRect(340, 60, 340, 180);
  x.strokeRect(80, 240, 400, 220);
  x.fillStyle = '#333';
  x.font = '13px Anek Latin, sans-serif';
  x.fillText('KITCHEN', 96, 84);
  x.fillText('LIVING', 356, 84);
  x.fillText('MASTER BEDROOM', 96, 264);
  x.fillText('BATH', 500, 264);
  x.font = '11px ui-monospace, monospace';
  x.fillText((state.desk.sheetNo || 'HA-2401-A-101') + '  R4  1:100', 84, 500);
  x.strokeStyle = '#d33';
  x.lineWidth = 2;
  state.desk.markup.forEach(([mx, my], i) => {
    x.beginPath();
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      x.arc(mx + Math.cos(a) * 28, my + Math.sin(a) * 20, 8, a + Math.PI, a + 2 * Math.PI);
    }
    x.stroke();
    x.fillStyle = '#d33';
    x.font = 'bold 12px Anek Latin, sans-serif';
    x.fillText(String(i + 1), mx - 4, my + 4);
  });
}

function SheetCanvas() {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) paintSheet(ref.current);
  });
  const onClick = (e) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    state.desk.markup.push([((e.clientX - r.left) / r.width) * el.width, ((e.clientY - r.top) / r.height) * el.height]);
    paintSheet(el);
    render();
  };
  return (
    <canvas
      ref={ref}
      className="sheet block w-full max-w-[760px] cursor-crosshair rounded-r1 border border-line-2 bg-white"
      width={760}
      height={520}
      onClick={onClick}
      aria-label="Drawing sheet with redline marks"
    />
  );
}

// ---------- shortcut list ----------
function ShortcutRows({ rows, projectId }) {
  return rows.map((x) => (
    <button
      key={x.no}
      type="button"
      className="flex w-full items-center justify-between gap-4 border-0 border-t border-line bg-transparent py-3 text-left text-ink"
      onClick={() => drawingView(projectId, x.no)}
    >
      <span>
        <b>{x.d.name}</b>
        <small className="mt-1 block text-ink-2">{x.no} · {x.d.rev} · {x.d.status}</small>
        {x.rev !== x.d.rev && <small className="font-semibold text-accent-text">Register changed since {x.rev}. Review before use.</small>}
      </span>
      <Icon name="chev" />
    </button>
  ));
}
function DrawingQuickList({ p }) {
  const saved = desktopDrawingShortcuts(p.id, 'saved');
  const recent = desktopDrawingShortcuts(p.id, 'recent').filter((x) => !saved.some((y) => y.no === x.no)).slice(0, 3);
  if (!saved.length && !recent.length) return null;
  return (
    <section className="mb-6 rounded-r3 border border-line bg-surface px-[22px] py-[18px]" aria-label="Personal drawing shortcuts">
      <p className="mt-0 text-ink-3">Personal shortcuts on this browser. No original files are downloaded.</p>
      {saved.length > 0 && (
        <>
          <h3 className="mb-1 mt-4 text-base font-semibold">Saved by you</h3>
          <ShortcutRows rows={saved.slice(0, 3)} projectId={p.id} />
          {saved.length > 3 && (
            <details>
              <summary className="cursor-pointer py-2.5 text-accent-text">All saved · {saved.length}</summary>
              <ShortcutRows rows={saved.slice(3)} projectId={p.id} />
            </details>
          )}
        </>
      )}
      {recent.length > 0 && (
        <>
          <h3 className="mb-1 mt-4 text-base font-semibold">Recently opened</h3>
          <ShortcutRows rows={recent} projectId={p.id} />
        </>
      )}
    </section>
  );
}

// ---------- tab ----------
export function DrawingsTab({ p }) {
  const drs = p.drawings;
  const sel = state.desk.sheetNo || drs[0]?.no;
  const filedDr = filedRows({ projectId: p.id, kind: 'drawing' });
  const marks = state.desk.markup.length;
  return (
    <>
      <DrawingQuickList p={p} />
      <Grid2>
        <Card>
          <H2>Drawing register</H2>
          <Sub>Check the stated revision and purpose before use.</Sub>
          <div className="grid gap-2.5">
            {drs.map((d) => (
              <article key={d.no} className={`flex items-start gap-3.5 rounded-r2 border p-4 ${d.no === sel ? 'border-accent bg-accent-soft' : 'border-line'}`}>
                <span className="mt-0.5 text-accent-text"><Icon name="drawing" /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="mb-1.5 mt-0 text-[17px] font-semibold">{d.name}</h3>
                  <p className="my-1 text-sm text-ink-2">{d.no} · <b>{d.rev}</b></p>
                  <StatusPill status={d.status} />
                  <p className="my-1 text-sm text-ink-2">{fmtD(d.date)} · {name(d.by)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn sm onClick={() => openSheet(d.no)}>Open markup</Btn>
                    <Btn sm onClick={() => drawingView(p.id, d.no)}>View record</Btn>
                  </div>
                </div>
              </article>
            ))}
            {!drs.length && <Empty>No drawings shared yet.</Empty>}
          </div>
          <Details summary="Compare drawing records">
            <DataTable
              cols={['Drawing', 'Name', 'Rev', 'Date', 'Status', 'By']}
              rows={drs.map((d) => [d.no, d.name, d.rev, fmtD(d.date), <StatusPill status={d.status} />, name(d.by)])}
            />
          </Details>
          <H2>Drawing index</H2>
          <Sub>Planned sheets per stage. Struck through once issued, approved or finalised.</Sub>
          <DataTable
            cols={['Stage', 'No', 'Name', 'Status', '']}
            rows={svc.drawingIndex(p.id).map((r) => [
              r.stage,
              <Mono>{r.no}</Mono>,
              r.done ? <s>{r.name}</s> : r.name,
              r.done ? `Done · ${r.how || ''} · ${name(r.doneBy)}` : 'Pending',
              <>
                {r.dwg && staff() && svc.connection('autocad') && (
                  <a className="mr-1 inline-flex min-h-8 items-center rounded-r1 border border-line-2 px-2.5 text-[13px] font-semibold no-underline" href={r.dwg} target="_blank" rel="noopener noreferrer">Open in AutoCAD Web</a>
                )}
                {!r.done && staff() && <Btn sm onClick={() => openDialog({ kind: 'finalise-drawing', id: r.id })}>Finalise</Btn>}
              </>,
            ])}
          />
          {staff() && (
            <>
              <H2>Issued to site</H2>
              <DataTable
                cols={['Drawing', 'Rev', 'To', 'When', 'By']}
                rows={state.db.TRANSMITTALS.filter((t) => t.projectId === p.id).map((t) => [
                  <Mono>{t.no}</Mono>, t.rev, name(t.to), fmtDT(t.at), first(t.by),
                ])}
              />
            </>
          )}
        </Card>
        <Card>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h2 className="m-0 text-lg font-semibold">Markup · <Mono>{sel || ''}</Mono></h2>
            <div className="flex gap-2">
              <Btn sm onClick={markupClear}>Clear marks</Btn>
              {staff() && can('thread', 'w') && <Btn sm kind="primary" onClick={() => markupSend(p.id)}>Send markup to site</Btn>}
            </div>
          </div>
          <Sub>Demonstration sheet; the original drawing file is not attached. Click to add a red cloud. {marks} mark{marks === 1 ? '' : 's'}.</Sub>
          <SheetCanvas />
          <H2>Drawings mentioned in chat</H2>
          <DataTable
            cols={['Who', 'Message', 'Drawing', '']}
            rows={filedDr.map((x) => [
              first(x.m.by), (x.m.text || '').slice(0, 70), <Mono>{x.drawing || ''}</Mono>, <FromChat msgId={x.m.id} />,
            ])}
          />
        </Card>
      </Grid2>
    </>
  );
}
