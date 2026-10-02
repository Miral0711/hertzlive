import { state, svc, toast, persist, render } from '../../shared/core.js';
import { seedFilings } from '../../shared/filing.js';
import { SAMPLES, TEMPLATES } from '../data';
import { Btn, Card, DataTable, PageHeader, Select, StatusPill } from '../../ui/ui';
import { P, V, first, role } from '../helpers';
import { FromChat, filedRows } from '../parts';
import { openDialog } from '../session';
import { formData } from '../session';
import { SecHead } from '../studio/common';
import Ph from '../../ui/Ph';

function choose(e, s) {
  e.preventDefault();
  s.chosen = formData(e.currentTarget).o;
  s.clientStatus = 'approved';
  const t = state.db.THREADS.find((x) => x.kind === 'client' && x.projectId === s.projectId);
  if (t && svc.thread(t.id)) {
    svc.addMessage(t.id, { text: `Decision: ${s.item}, ${s.chosen}`, decision: true });
    seedFilings();
  }
  persist();
  toast('Choice saved.');
}

export function SamplesPage() {
  if (role() === 'client') {
    const sel = state.desk.selections.filter((s) => svc.myProjectIds().includes(s.projectId));
    const mats = svc.materials().filter((m) => m.clientVisible);
    return (
      <>
        <PageHeader title="Your selections" sub="Material choices and approvals waiting on you." />
        <Card title="Choose">
          <DataTable
            cols={['Item', 'Options', 'Your choice']}
            rows={sel.map((s) => [
              s.item, s.options.join(' / '),
              s.chosen
                ? <><b>{s.chosen}</b> <StatusPill status={s.clientStatus} /></>
                : (
                  <form onSubmit={(e) => choose(e, s)} className="flex items-center gap-2">
                    <Select name="o" aria-label={`Option for ${s.item}`}>{s.options.map((o) => <option key={o}>{o}</option>)}</Select>
                    <Btn sm kind="primary" type="submit">Choose</Btn>
                  </form>
                ),
            ])}
          />
        </Card>
        <div className="mt-5"><SecHead title="Materials to approve" /></div>
        <Card>
          <DataTable
            cols={['Material', 'Vendor', 'Status', '']}
            rows={mats.map((m) => [
              <span className="inline-flex items-center gap-2"><Ph hue={m.hue} seed={m.seed} ar={1.6} thumb /> {m.name}</span>,
              m.vendor, <StatusPill status={m.status} />,
              m.status === 'client_pending' ? (
                <span className="inline-flex gap-2">
                  <Btn sm kind="primary" onClick={() => { svc.approveMaterial(m.id, true); toast('Material approved.'); }}>Approve</Btn>
                  <Btn sm onClick={() => { svc.approveMaterial(m.id, false); toast('Noted. The studio will offer another option.'); }}>Not this one</Btn>
                </span>
              ) : '',
            ])}
          />
        </Card>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Sample library" sub="Physical samples in the studio, by shelf." />
      <Card>
        <DataTable
          cols={['Sample', 'Material', 'Vendor', 'Shelf', 'Projects', 'Where it is', '']}
          rows={SAMPLES.map((s) => [
            <span className="inline-flex items-center gap-2"><Ph hue={s.hue} seed={s.seed} ar={1.6} thumb /> <b>{s.name}</b></span>,
            s.material, V(s.vendorId).name, s.shelf,
            s.projectIds.map((p) => P(p).name.split(' ')[0]).join(', '),
            <StatusPill status={s.out ? `out · ${s.out}` : 'on shelf'} />,
            s.out
              ? (s.outBy && s.outBy !== state.userId && role() !== 'partner'
                  ? <Btn sm disabled title={`Only ${s.out.replace('With ', '')} or a partner can mark this returned`}>Returned</Btn>
                  : <Btn sm onClick={() => { s.out = null; s.outBy = null; render(); }}>Returned</Btn>)
              : <Btn sm onClick={() => { s.out = `With ${first(state.userId)}`; s.outBy = state.userId; render(); }}>Take out</Btn>,
          ])}
        />
      </Card>
      <div className="mt-5"><SecHead title="Samples talked about in chat" sub="Mentions picked up from project conversations." /></div>
      <Card>
        <DataTable
          cols={['Project', 'Who', 'Message', '']}
          rows={filedRows({ kind: 'sample' }).map((x) => [P(x.projectId)?.name.split(' ')[0] || '?', first(x.m.by), x.m.text, <FromChat msgId={x.m.id} />])}
        />
      </Card>
    </>
  );
}

export function TemplatesPage() {
  return (
    <>
      <PageHeader title="Templates" sub="Start new work from a known-good pattern." />
      <Card>
        <DataTable
          cols={['Kind', 'Template', 'What is inside', 'Items', '']}
          rows={TEMPLATES.map((t) => [t.kind, <b>{t.name}</b>, t.desc, t.items, <Btn sm onClick={() => openDialog({ kind: 'template', name: t.name, tkind: t.kind })}>Use</Btn>])}
        />
      </Card>
    </>
  );
}
