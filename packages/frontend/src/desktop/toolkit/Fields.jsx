import { Btn, Field, Input, Select } from '../../ui/ui';
import { AREA_UNIT_OPTIONS, LENGTH_UNIT_OPTIONS, MASS_UNIT_OPTIONS, VOLUME_UNIT_OPTIONS } from '../../toolkit/units';
import { emptyItem, isVisible } from '../../toolkit/read';

const UNITS = {
  length: LENGTH_UNIT_OPTIONS,
  area: AREA_UNIT_OPTIONS,
  volume: VOLUME_UNIT_OPTIONS,
  mass: MASS_UNIT_OPTIONS,
};

function UnitSelect({ label, value, options, onChange }) {
  return (
    <Select aria-label={`${label} unit`} value={value} onChange={(e) => onChange(e.target.value)} className="w-[6.5rem] shrink-0 [&_button]:min-w-0 [&_button]:px-2">
      {options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
    </Select>
  );
}

function MeasureField({ field, values, onChange }) {
  const options = UNITS[field.type];
  const unitKey = `${field.key}Unit`;
  return (
    <Field label={field.label} hint={field.hint}>
      <span className="flex gap-2">
        <Input
          value={values[field.key] ?? ''}
          inputMode="decimal"
          autoComplete="off"
          placeholder={field.placeholder || (field.type === 'length' ? '12\'-6" or 3.6' : '')}
          aria-label={field.label}
          className="min-w-0 flex-1"
          onChange={(e) => onChange(field.key, e.target.value)}
        />
        <UnitSelect label={field.label} value={values[unitKey] || field.unit} options={options} onChange={(unit) => onChange(unitKey, unit)} />
      </span>
    </Field>
  );
}

function RepeatField({ field, items, onChange }) {
  const rows = items?.length ? items : [];
  const min = field.min ?? (field.seed === 0 ? 0 : 1);
  const update = (index, key, value) => {
    onChange(field.key, rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };
  return (
    <div className="mb-3">
      <div className="mb-1.5 text-[13px] font-semibold text-ink-2">{field.label}</div>
      <div className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <div key={index} className="rounded-r2 border border-line bg-surface-2 p-2.5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-ink-3">{field.itemLabel} {index + 1}</span>
              {rows.length > min && (
                <Btn sm kind="link" onClick={() => onChange(field.key, rows.filter((_, i) => i !== index))}>Remove</Btn>
              )}
            </div>
            {field.fields.filter((child) => isVisible(child, row)).map((child) => (
              <FieldControl key={child.key} field={child} values={row} onChange={(key, value) => update(index, key, value)} />
            ))}
          </div>
        ))}
      </div>
      <Btn sm icon="plus" className="mt-2" onClick={() => onChange(field.key, [...rows, emptyItem(field.fields)])}>{field.addLabel || 'Add'}</Btn>
    </div>
  );
}

export function FieldControl({ field, values, onChange }) {
  if (field.type === 'repeat') return <RepeatField field={field} items={values[field.key]} onChange={onChange} />;
  if (UNITS[field.type]) return <MeasureField field={field} values={values} onChange={onChange} />;
  if (field.type === 'select') {
    return (
      <Field label={field.label} hint={field.hint}>
        <Select aria-label={field.label} value={values[field.key] ?? ''} onChange={(e) => onChange(field.key, e.target.value)} className="w-full [&_button]:w-full">
          {field.options.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
        </Select>
      </Field>
    );
  }
  return (
    <Field label={field.label} hint={field.hint}>
      <Input
        value={values[field.key] ?? ''}
        inputMode={field.type === 'number' ? 'decimal' : 'text'}
        autoComplete="off"
        aria-label={field.label}
        placeholder={field.placeholder || ''}
        onChange={(e) => onChange(field.key, e.target.value)}
      />
    </Field>
  );
}

export function FieldList({ fields, values, onChange }) {
  const shown = fields.filter((field) => isVisible(field, values));
  return (
    <div className="grid gap-x-4 sm:grid-cols-2">
      {shown.map((field) => (
        <div key={field.key} className={field.type === 'repeat' ? 'sm:col-span-2' : ''}>
          <FieldControl field={field} values={values} onChange={(key, value) => onChange({ ...values, [key]: value })} />
        </div>
      ))}
    </div>
  );
}
