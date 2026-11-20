import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../ui/cn';
import { FieldFaultText, type FieldFault } from '../../ui/Field';
import type { Plus7Note } from '../../shared/phone';
import { Plus7Input, plus7NoteKey } from '../../shared/Plus7Input';

/**
 * Номер на страницах приглашения: «KZ +7 ▾» и десять цифр, как на странице входа.
 * Значение — цифры с кодом, «77011234567»; вставка «+7 701 …» и «8 701 …» приводится к нему.
 */
export function JoinPhone({ id, name, label, value, fault, onChange, onBlur }: {
  id: string;
  name: string;
  label: React.ReactNode;
  value: string;
  fault?: FieldFault;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const { t } = useTranslation();
  const [note, setNote] = useState<Plus7Note>(null);
  const noteKey = plus7NoteKey(note);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
      <div className={cn(
        'flex h-14 items-center overflow-hidden rounded-[var(--radius-control)] border-2 bg-surface',
        fault || noteKey ? 'border-gone' : 'border-field-line focus-within:border-shop focus-within:ring-1 focus-within:ring-shop',
      )}>
        <Plus7Input
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          onNote={setNote}
          invalid={!!fault || !!noteKey}
          pickerClassName="border-field-line text-base text-ink"
          inputClassName="text-base text-ink"
        />
      </div>
      {noteKey ? <span role="alert" className="text-sm text-gone">{t(noteKey)}</span> : null}
      <FieldFaultText fault={fault} name={name} />
    </div>
  );
}
