import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { toast } from '../../shared/core.js';
import Icon from '../../ui/Icon';
import {
  Banner, Btn, Dropdown, DropdownItem, IconButton, Input, Tabs,
} from '../../ui/ui';
import { useDesktopNavigate } from '../nav';
import { resultText, runCalculator } from '../../toolkit/calc';
import { calculatorById, defaultMode, fieldsFor } from '../../toolkit/catalog';
import { interpret } from '../../toolkit/intent/interpret';
import { RULES } from '../../toolkit/intent/rules/index';
import { initialValues, normalize } from '../../toolkit/read';
import {
  deleteCalculation, duplicateCalculation, getSnapshot, rememberCalculation, renameCalculation, saveCalculation, subscribe,
  toggleFavorite,
} from '../../toolkit/store';
import { holdDraft, peekDraft, takeDraft } from './draft';
import { FieldList } from './Fields';

function useToolkit() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function formatWhen(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function answerText(result) {
  const head = (result?.headline || []).map((line) => line.value).filter(Boolean);
  const main = result?.lead && head.length ? `${result.lead} = ${head.join(' · ')}` : head.join('\n');
  const facts = (result?.facts || []).map((line) => `${line.label}: ${line.value}`);
  return [main, ...facts].filter(Boolean).join('\n') || resultText(result?.outcome);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied');
  } catch {
    toast('Could not copy');
  }
}

function StarButton({ on, onClick, className = '' }) {
  return (
    <button
      type="button"
      aria-label={on ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={on}
      onClick={onClick}
      className={`inline-grid h-8 w-8 place-items-center rounded-full hover:bg-accent-soft hover:text-accent-text ${on ? 'text-accent-text' : 'text-ink-3'} ${className}`}
    >
      <Icon name="star" small className={on ? 'fill-current' : ''} />
    </button>
  );
}

function Sketch({ sketch }) {
  if (!sketch) return null;
  if (sketch.type === 'stair') return <StairSketch risers={sketch.risers} />;
  if (sketch.type === 'slope' && sketch.rise > 0 && sketch.run > 0) return <SlopeSketch rise={sketch.rise} run={sketch.run} />;
  return null;
}

function StairSketch({ risers }) {
  const steps = Math.max(1, Math.min(12, risers));
  const W = 280;
  const H = 120;
  const pad = 8;
  const tw = (W - pad * 2) / steps;
  const rh = (H - pad * 2) / steps;
  let d = `M ${pad} ${H - pad}`;
  for (let i = 0; i < steps; i += 1) {
    const x = pad + i * tw;
    const y = H - pad - i * rh;
    d += ` V ${y - rh} H ${x + tw}`;
  }
  return (
    <figure className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full text-accent-text" role="img" aria-label="Stair section">
        <path d={d} fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2" />
      </svg>
      {risers > steps && <figcaption className="text-xs text-ink-3">Showing {steps} of {risers} risers</figcaption>}
    </figure>
  );
}

function SlopeSketch({ rise, run }) {
  const W = 280;
  const H = 120;
  const pad = 16;
  const scale = Math.min((W - pad * 2) / run, (H - pad * 2) / rise);
  const rw = run * scale;
  const rh = rise * scale;
  const x = pad;
  const y = H - pad;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-28 w-full text-accent-text" role="img" aria-label="Slope diagram">
      <path d={`M ${x} ${y} H ${x + rw} V ${y - rh} Z`} fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function answerLines(calc, mode, outcome) {
  const rule = RULES.find((item) => item.id === calc.id && (item.mode || null) === (mode || null) && item.answer);
  const wanted = [].concat(rule?.answer || outcome.lines[0]?.label || []);
  const headline = outcome.lines.filter((line) => wanted.includes(line.label));
  return headline.length ? headline : outcome.lines.slice(0, 1);
}

function LiveResult({ calc, mode, outcome, onCopy }) {
  if (!outcome?.ok) return null;
  const headline = answerLines(calc, mode, outcome);
  const view = hero({ headline, title: calc.title });
  const rest = outcome.lines.filter((line) => !headline.some((item) => item.label === line.label));
  return (
    <div className="mb-4 border-b border-line pb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">Result</div>
          <div className="mt-1 text-stat font-semibold leading-none tracking-tight text-accent-text [overflow-wrap:anywhere]">{view.value}</div>
          {view.hint && <div className="mt-1.5 text-[13px] text-ink-2">{view.hint}</div>}
        </div>
        <IconButton sm icon="clip" label="Copy result" onClick={onCopy} />
      </div>
      {rest.length > 0 && (
        <dl className="mt-3 flex flex-col">
          {rest.map((line) => (
            <div key={line.label} className="flex items-baseline justify-between gap-4 py-1">
              <dt className="text-[13px] text-ink-3">{line.label}</dt>
              <dd className="m-0 min-w-0 text-right text-[13px] font-medium [overflow-wrap:anywhere]">{line.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <Sketch sketch={outcome.sketch} />
      {outcome.note && <p className="mt-2 mb-0 text-[13px] leading-relaxed text-ink-3">{outcome.note}</p>}
    </div>
  );
}

function Calculator({ calc, saved, modeHint, onBack, favoriteOn, onFavorite }) {
  const formRef = useRef(null);
  const draft = peekDraft(calc.id);
  const initialMode = [saved?.mode, draft?.mode, modeHint].find((id) => !calc.modes || calc.modes.some((item) => item.id === id)) || defaultMode(calc);
  const [mode, setMode] = useState(initialMode);
  const [values, setValues] = useState(() => ({ ...initialValues(fieldsFor(calc, initialMode)), ...(draft?.inputs || {}), ...(saved?.inputs || {}) }));
  const [name, setName] = useState(saved?.name || '');
  const [phrase] = useState(saved?.phrase || draft?.phrase || '');
  const [currentId, setCurrentId] = useState(saved?.id || null);
  useEffect(() => { takeDraft(calc.id); }, [calc.id]);
  useEffect(() => {
    formRef.current?.querySelector('input, select, textarea')?.focus();
  }, [calc.id, mode]);
  const fields = fieldsFor(calc, mode);
  const norm = normalize(fields, values);
  const outcome = norm.errors.length
    ? { ok: false, error: `Could not read ${[...new Set(norm.errors)].join(', ')}. Use 12'-6" or 3.6 m.` }
    : runCalculator(calc.id, mode, norm.values);

  const persist = (id) => {
    if (!outcome.ok) return;
    const row = saveCalculation({
      id,
      calculatorId: calc.id,
      mode,
      name: name.trim(),
      phrase,
      inputs: values,
      result: outcome,
    });
    if (!row) toast('Could not save on this device.');
    else {
      setCurrentId(row.id);
      toast('Saved');
    }
  };

  return (
    <div ref={formRef} className="px-4 py-3">
      <div className="mb-3 flex items-center gap-2">
        <button type="button" onClick={onBack} className="rounded-r1 px-1.5 py-1 text-[12px] font-semibold text-ink-3 hover:bg-surface-2 hover:text-ink">Esc</button>
        <h2 className="m-0 min-w-0 flex-1 truncate text-base font-semibold">{calc.title}</h2>
        <StarButton on={favoriteOn} onClick={onFavorite} />
      </div>
      <LiveResult calc={calc} mode={mode} outcome={outcome} onCopy={() => copyText(resultText(outcome))} />
      {calc.note && <Banner>{calc.note}</Banner>}
      {calc.modes && (
        <Tabs
          current={mode}
          list={calc.modes.map((item) => [item.id, item.label])}
          onSelect={(id) => {
            setMode(id);
            setValues((current) => ({ ...initialValues(fieldsFor(calc, id)), ...current }));
          }}
        />
      )}
      <FieldList fields={fields} values={values} onChange={setValues} />
      {outcome.error && <p className="mb-2 text-[13px] text-crit">{outcome.error}</p>}
      <div className="mt-1 flex flex-col gap-2 border-t border-line pt-3 sm:flex-row sm:items-center">
        <Input
          aria-label="Calculation name"
          placeholder="Name this calculation"
          value={name}
          autoComplete="off"
          className="sm:max-w-xs"
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {currentId && <Btn sm disabled={!outcome.ok} onClick={() => persist(null)}>Save a copy</Btn>}
          <Btn sm kind="primary" icon="check" disabled={!outcome.ok} onClick={() => persist(currentId)}>{currentId ? 'Update' : 'Save'}</Btn>
        </div>
      </div>
    </div>
  );
}

function History({ rows, onOpen, onCopy }) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const [armed, setArmed] = useState(null);
  if (!rows.length) {
    return (
      <div className="px-3 py-3">
        <div className="text-[13px] font-semibold">No saved calculations yet.</div>
        <p className="mb-0 mt-0.5 text-[13px] text-ink-3">Save a result to keep it here.</p>
      </div>
    );
  }
  return (
    <div>
      {rows.map((row) => {
        const calc = calculatorById(row.calculatorId);
        const close = (e) => { e.currentTarget.closest('details').open = false; };
        return (
          <div key={row.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface-2">
            {editing === row.id ? (
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 px-1">
                <Input aria-label="Calculation name" value={draft} autoComplete="off" onChange={(e) => setDraft(e.target.value)} />
                <Btn sm kind="primary" onClick={() => { renameCalculation(row.id, draft.trim()); setEditing(null); }}>Save</Btn>
              </span>
            ) : (
              <button type="button" onClick={() => onOpen(row)} className="min-w-0 flex-1 border-0 bg-transparent px-1 py-1 text-left">
                <span className="flex items-baseline justify-between gap-3">
                  <b className="truncate">{row.name || calc?.title || 'Calculation'}</b>
                  <span className="shrink-0 text-[13px] font-semibold text-accent-text">{row.result?.ok && calc ? hero({ headline: answerLines(calc, row.mode, row.result), title: calc.title }).value : ''}</span>
                </span>
                <small className="block truncate text-ink-3">{calc?.title || row.calculatorId}{row.phrase ? ` · ${row.phrase}` : ''}</small>
              </button>
            )}
            <span className="hidden shrink-0 text-[11px] text-ink-3 sm:block">{formatWhen(row.updatedAt)}</span>
            <IconButton sm icon="clip" label="Copy result" onClick={() => onCopy(row)} />
            <Dropdown trigger={<><Icon name="more" small /><span className="sr-only">Actions</span></>} align="right" panelClassName="min-w-[180px]">
              <DropdownItem icon="edit" onClick={(e) => { close(e); setEditing(row.id); setDraft(row.name || ''); }}>Rename</DropdownItem>
              <DropdownItem icon="plus" onClick={(e) => { close(e); duplicateCalculation(row.id); toast('Duplicated'); }}>Duplicate</DropdownItem>
              <DropdownItem icon="trash" className="text-crit" onClick={(e) => {
                if (armed === row.id) { close(e); deleteCalculation(row.id); }
                else setArmed(row.id);
              }}
              >
                {armed === row.id ? 'Confirm delete' : 'Delete'}
              </DropdownItem>
            </Dropdown>
          </div>
        );
      })}
    </div>
  );
}

const EXAMPLES = [
  '12\'-6" × 15\'-4"',
  '850 sq.ft 600×600 tiles 7% wastage',
  '45mm at 1:100',
  '10\'-0" floor height, 7.5" riser',
];

const BROWSE = [
  { id: 'measure', label: 'Measurements', tools: ['units', 'area', 'volume'] },
  { id: 'materials', label: 'Materials', tools: ['concrete', 'brick', 'block', 'plaster', 'flooring', 'tile', 'paint', 'waterproof'] },
  { id: 'design', label: 'Building Design', tools: ['stair', 'ramp', 'roof', 'slope', 'parking', 'far', 'solar', 'opening', 'structural'] },
  { id: 'drawing', label: 'Drawing', tools: ['scale'] },
  { id: 'cost', label: 'Cost', tools: ['cost'] },
];

function Section({ title, prompt = false, onTitle, children }) {
  return (
    <section className="py-1">
      {title && prompt ? <p className="mb-0.5 mt-1 px-3 text-[13px] text-ink-2">{title}</p> : null}
      {title && !prompt && onTitle ? (
        <button type="button" onClick={onTitle} className="mb-0.5 mt-1 w-full border-0 bg-transparent px-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 hover:text-accent-text">{title}</button>
      ) : null}
      {title && !prompt && !onTitle ? <h2 className="mb-0.5 mt-1 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{title}</h2> : null}
      {children}
    </section>
  );
}

function Row({ id, active, title, detail, aside, mark, onClick, onHover }) {
  return (
    <button
      id={id}
      type="button"
      role="option"
      aria-selected={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      onMouseEnter={onHover}
      className={`flex w-full items-center gap-3 px-3 py-2 text-left ${active ? 'bg-accent-soft' : 'hover:bg-surface-2'}`}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 truncate font-semibold">
            {mark && <Icon name="star" small className="fill-current text-accent-text" />}
            <span className="truncate">{title}</span>
          </span>
          {aside && <span className="max-w-[46%] shrink-0 truncate text-right text-[13px] font-semibold text-accent-text">{aside}</span>}
        </span>
        {detail && <span className="mt-0.5 block truncate text-[13px] text-ink-3">{detail}</span>}
      </span>
    </button>
  );
}

function hero(result) {
  const lines = result?.headline || [];
  if (!lines.length) return { value: '', hint: '' };
  if (lines.length > 1) return { value: lines.map((line) => line.value).join(' · '), hint: '' };
  const line = lines[0];
  const ordered = line.value.match(/\(order (\d+)\)/);
  if (line.label === 'Tiles to order' && ordered) return { value: `${ordered[1]} tiles`, hint: 'estimated order quantity' };
  const nos = line.value.match(/^(\d+) nos$/);
  if (line.label === 'Tiles to order' && nos) return { value: `${nos[1]} tiles`, hint: 'estimated order quantity' };
  const area = line.value.match(/^(.*) · ([\d.,]+ sq\.ft)$/);
  if (line.label === 'Area' && area) return { value: area[2], hint: area[1] };
  if (line.label && line.label !== result.title) return { value: line.value, hint: line.label };
  return { value: line.value, hint: '' };
}

function recentView(row) {
  const found = row.phrase ? interpret(row.phrase) : null;
  if (found?.kind === 'result') {
    return { title: found.result.title, detail: row.phrase, aside: hero(found.result).value };
  }
  return { title: row.phrase, detail: row.result?.summary || '', aside: '' };
}

export default function ToolkitPage({ q = {} }) {
  const data = useToolkit();
  const goTo = useDesktopNavigate();
  const field = useRef(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [browse, setBrowse] = useState(null);
  const [showSaved, setShowSaved] = useState(false);
  const [tool, setTool] = useState(() => (q.calc ? { id: q.calc, mode: q.mode || null, savedId: q.h || null } : null));
  const calc = calculatorById(tool?.id);
  const saved = data.saved.find((row) => row.id === tool?.savedId) || null;
  const phrase = query.trim();
  const recentWords = /^recent\b/i.test(phrase) ? phrase.replace(/^recent\s*/i, '').toLowerCase().split(/\s+/).filter(Boolean) : null;
  const reading = phrase && !calc && !recentWords ? interpret(phrase) : null;
  const group = BROWSE.find((item) => item.id === browse) || null;

  const closeTool = () => {
    setTool(null);
    if (q.calc) goTo('#/toolkit', { replace: true });
    field.current?.focus();
  };
  const layer = useRef({});
  layer.current = { phrase, browse, calc: Boolean(calc), saved: showSaved };

  useEffect(() => {
    if (!calc) field.current?.focus();
  }, [calc]);

  useEffect(() => {
    const onEscape = (event) => {
      if (event.key !== 'Escape' || event.repeat) return;
      if (event.target?.closest?.('details[open]')) return;
      const here = layer.current;
      if (here.calc) {
        layer.current = { ...here, calc: false };
        closeTool();
      } else if (here.browse && here.browse !== 'menu') {
        layer.current = { ...here, browse: 'menu' };
        setActive(0);
        setBrowse('menu');
      } else if (here.browse === 'menu') {
        layer.current = { ...here, browse: null };
        setBrowse(null);
      } else if (here.saved) {
        layer.current = { ...here, saved: false };
        setShowSaved(false);
      } else if (here.phrase) {
        layer.current = { ...here, phrase: '' };
        setQuery('');
      } else return;
      event.preventDefault();
      field.current?.focus();
    };
    const onCopy = (event) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== 'c') return;
      if (reading?.kind !== 'result' || document.activeElement !== field.current) return;
      if (document.getSelection?.()?.toString()) return;
      event.preventDefault();
      copyText(answerText(reading.result));
    };
    window.addEventListener('keydown', onEscape, true);
    window.addEventListener('keydown', onCopy);
    return () => {
      window.removeEventListener('keydown', onEscape, true);
      window.removeEventListener('keydown', onCopy);
    };
  });

  useEffect(() => {
    if (!phrase || calc || recentWords) return;
    const found = interpret(phrase);
    if (found.kind !== 'result') return;
    rememberCalculation({
      phrase,
      calculatorId: found.result.id,
      mode: found.result.mode,
      inputs: found.result.inputs,
      result: found.result.outcome,
      assumption: found.result.assumption,
    });
  }, [phrase, calc, recentWords]);

  const openTool = (id, mode, inputs, sourcePhrase) => {
    holdDraft({ calculatorId: id, mode: mode || null, inputs: inputs || {}, phrase: sourcePhrase || '' });
    setActive(0);
    setTool({ id, mode: mode || null, savedId: null });
  };
  const openSaved = (row) => {
    holdDraft({ calculatorId: row.calculatorId, mode: row.mode, inputs: row.inputs, phrase: row.phrase || '' });
    setQuery(row.phrase || '');
    setTool({ id: row.calculatorId, mode: row.mode || null, savedId: row.id });
  };
  const favorite = (id) => {
    if (!toggleFavorite(id)) toast('Could not save on this device.');
  };
  const saveQuick = (result) => {
    const row = saveCalculation({
      calculatorId: result.id,
      mode: result.mode,
      name: phrase,
      phrase,
      inputs: result.inputs,
      result: result.outcome,
    });
    toast(row ? 'Saved' : 'Could not save on this device.');
  };

  const items = [];
  const pushTool = (section, sectionId, id) => {
    const entry = calculatorById(id);
    if (!entry) return;
    items.push({
      section,
      sectionId,
      title: entry.title,
      detail: entry.blurb,
      run: () => openTool(id, null, null, phrase),
    });
  };
  if (calc) {
    // The calculator replaces the list. The command stays above it.
  } else if (recentWords) {
    (data.recentCalcs || []).filter((row) => {
      const view = recentView(row);
      const hay = `${view.title} ${view.detail}`.toLowerCase();
      return recentWords.every((word) => hay.includes(word));
    }).forEach((row) => {
      const view = recentView(row);
      items.push({ section: 'Recent', ...view, run: () => { setActive(0); setQuery(row.phrase); } });
    });
  } else if (phrase && reading?.kind === 'result') {
    items.push({ title: 'Copy', run: () => copyText(answerText(reading.result)) });
    if (calculatorById(reading.result.id)) {
      items.push(
        { title: 'Save', run: () => saveQuick(reading.result) },
        { title: 'Open calculator', run: () => openTool(reading.result.id, reading.result.mode, reading.result.inputs, phrase) },
      );
    }
  } else if (phrase && reading?.kind === 'choices') {
    reading.choices.forEach((choice) => items.push({
      section: reading.prompt || '',
      prompt: Boolean(reading.prompt),
      title: choice.title,
      detail: choice.blurb,
      run: () => openTool(choice.id, choice.mode, choice.values, phrase),
    }));
  } else if (!phrase && group) {
    group.tools.forEach((id) => pushTool(group.label, group.id, id));
  } else if (!phrase && browse === 'menu') {
    BROWSE.forEach((item) => item.tools.forEach((id) => pushTool(item.label, item.id, id)));
  } else if (!phrase && !showSaved) {
    (data.recentCalcs || []).forEach((row) => {
      const view = recentView(row);
      items.push({ section: 'Recent', ...view, run: () => { setActive(0); setQuery(row.phrase); } });
    });
    data.favorites.forEach((id) => {
      const entry = calculatorById(id);
      if (entry) items.push({ section: 'Favorites', title: entry.title, mark: true, run: () => openTool(id, null, null, '') });
    });
    EXAMPLES.forEach((example) => items.push({
      section: 'Try',
      title: example,
      run: () => { setActive(0); setQuery(example); },
    }));
    items.push({ footer: true, title: 'Browse all tools →', run: () => { setActive(0); setBrowse('menu'); } });
    items.push({ footer: true, title: 'Saved calculations', run: () => setShowSaved(true) });
  }
  const index = items.length ? Math.min(active, items.length - 1) : 0;

  const onKey = (event) => {
    if (calc) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, Math.max(items.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      items[index]?.run();
    }
  };

  const answered = reading?.kind === 'result';
  const listItems = answered ? [] : items.filter((item) => !item.footer);
  const footer = items.filter((item) => item.footer);
  const sections = [];
  listItems.forEach((item, at) => {
    const title = item.section || '';
    const last = sections[sections.length - 1];
    if (!last || last.title !== title) sections.push({ title, prompt: Boolean(item.prompt), sectionId: item.sectionId, rows: [] });
    sections[sections.length - 1].rows.push({ ...item, at });
  });
  const view = answered ? hero(reading.result) : null;
  const facts = reading?.result?.facts || [];

  return (
    <div className="mx-auto flex w-full max-w-[840px] flex-col max-md:min-h-0 max-md:flex-1">
      <header className="mb-2 shrink-0 md:mb-3">
        <h1 className="m-0 text-base font-semibold leading-tight tracking-tight md:text-lg">Architect's Toolkit</h1>
        <p className="m-0 mt-0.5 text-[13px] text-ink-3">Calculate, convert, estimate, or check anything.</p>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-r3 border border-line bg-surface shadow-s2 focus-within:border-accent md:block md:flex-none">
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 sm:gap-3 sm:px-4">
          <Icon name="search" className="text-accent-text" />
          <input
            ref={field}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={!calc && items.length > 0}
            aria-controls="toolkit-list"
            aria-activedescendant={!calc && items.length ? `toolkit-opt-${index}` : undefined}
            aria-label="What do you want to calculate?"
            placeholder="What do you want to calculate?"
            value={query}
            autoComplete="off"
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
              setBrowse(null);
              setShowSaved(false);
              setTool(null);
            }}
            onKeyDown={onKey}
            className="min-h-[52px] w-full min-w-0 border-0 bg-transparent py-3 text-base text-ink placeholder:text-ink-3 focus:outline-none focus:ring-0 sm:min-h-[56px]"
          />
          {(phrase || browse || showSaved) && !calc && <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-ink-3">esc</span>}
        </div>

        <div className="min-h-0 flex-1 overflow-auto max-md:overscroll-contain md:max-h-[min(36rem,calc(100dvh-12rem))] md:flex-none">
          {calc && (
            <Calculator
              key={`${calc.id}:${saved?.id || 'new'}:${tool?.mode || ''}`}
              calc={calc}
              saved={saved}
              modeHint={tool?.mode}
              favoriteOn={data.favorites.includes(calc.id)}
              onFavorite={() => favorite(calc.id)}
              onBack={closeTool}
            />
          )}

          {!calc && answered && (
            <div className="px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">{reading.result.title}</div>
                  {reading.result.lead && (
                    <>
                      <div className="mt-2 text-base text-ink-2">{reading.result.lead}</div>
                      <div className="my-1 text-[13px] text-ink-3" aria-hidden="true">↓</div>
                    </>
                  )}
                  <div className={`${reading.result.lead ? '' : 'mt-1 '}text-hero font-semibold leading-tight tracking-tight text-ink [overflow-wrap:anywhere]`}>{view.value}</div>
                  {view.hint && <div className="mt-1.5 text-[13px] text-ink-2">{view.hint}</div>}
                  {reading.result.note && <div className="mt-1.5 text-[13px] text-ink-3">{reading.result.note}</div>}
                </div>
                {calculatorById(reading.result.id) && (
                  <StarButton on={data.favorites.includes(reading.result.id)} onClick={() => favorite(reading.result.id)} />
                )}
              </div>
              {reading.result.assumption && <p className="mb-0 mt-3 text-[13px] text-ink-2">{reading.result.assumption}</p>}
              {facts.length > 0 && (
                <ul className="mb-0 mt-3 list-none p-0">
                  {facts.map((line) => (
                    <li key={line.label} className="py-0.5 text-[13px] text-ink-2">
                      <span className="font-medium text-ink">{line.value}</span>
                      {' '}
                      <span className="text-ink-3">{String(line.label).toLowerCase()}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div id="toolkit-list" role="listbox" aria-label="Result actions" className="mt-4 flex flex-wrap gap-1 border-t border-line pt-3">
                {items.map((item, at) => (
                  <button
                    key={item.title}
                    id={`toolkit-opt-${at}`}
                    type="button"
                    role="option"
                    aria-selected={index === at}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActive(at)}
                    onClick={item.run}
                    className={`rounded-r1 px-2.5 py-1.5 text-[13px] font-semibold ${index === at ? 'bg-accent-soft text-accent-text' : 'text-ink-2 hover:bg-surface-2'}`}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!calc && reading?.kind === 'incomplete' && !reading.quiet && (
            <p className="m-0 px-4 py-4 text-[13px] text-ink-3">{reading.hint || 'Keep typing…'}</p>
          )}

          {!calc && !answered && (reading?.kind === 'empty' || (recentWords && !items.length)) && (
            <p className="m-0 px-4 py-4 text-[13px] text-ink-3">{recentWords ? 'No recent calculations match.' : 'No matching tool'}</p>
          )}

          {!calc && !answered && sections.length > 0 && (
            <div id="toolkit-list" role="listbox" aria-label="Toolkit suggestions" className="py-1">
              {sections.map((section) => (
                <Section
                  key={section.title || 'list'}
                  title={section.title}
                  prompt={section.prompt}
                  onTitle={section.sectionId && browse === 'menu' ? () => { setActive(0); setBrowse(section.sectionId); } : null}
                >
                  {section.rows.map((row) => (
                    <Row
                      key={`${row.title}:${row.at}`}
                      id={`toolkit-opt-${row.at}`}
                      active={index === row.at}
                      title={row.title}
                      detail={row.detail}
                      aside={row.aside}
                      mark={row.mark}
                      onHover={() => setActive(row.at)}
                      onClick={row.run}
                    />
                  ))}
                </Section>
              ))}
            </div>
          )}

          {!calc && !phrase && showSaved && (
            <div className="py-1">
              <h2 className="mb-0.5 mt-1 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Saved</h2>
              <History
                rows={[...data.saved].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))}
                onOpen={openSaved}
                onCopy={(row) => copyText(resultText(row.result))}
              />
            </div>
          )}

          {!calc && footer.length > 0 && (
            <div className="border-t border-line py-1">
              {footer.map((item) => {
                const at = items.indexOf(item);
                return (
                  <Row
                    key={item.title}
                    id={`toolkit-opt-${at}`}
                    active={index === at}
                    title={item.title}
                    onHover={() => setActive(at)}
                    onClick={item.run}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
