import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { countryOptions, groupPlus7, takePlus7, type Plus7Note } from './phone';

const cn = (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' ');

/**
 * Копия `front/src/shared/Plus7Input.tsx` для портала и админки: та же логика
 * ввода, но страна — системным списком (стран у +7 две, Mantine здесь нет).
 * Файл одинаков в portal и admin.
 *
 * Номер +7 — один ввод на все формы с номером и тот же, что на странице входа
 * (`phone-login.js`): слева «KZ +7», в поле десять цифр группами
 * «701 123 45 67», «8» в начале не принимается, вставка «+7 (701) …»
 * и «8 (701) …» приводится к десяти цифрам, чужой код с плюсом — отказ.
 *
 * Значение — цифры с кодом, «77011234567», как его хранит сервер. Почему
 * цифра не принята, форма узнаёт через `onNote` и пишет под полем.
 * Рамку, подпись и подсказку рисует форма: у кабинета их два вида.
 */
export function Plus7Input({
  id, name, value, onChange, onBlur, onNote, invalid = false, describedBy, autoFocus = false, required = false,
  placeholder, inputClassName, pickerClassName, legacyText,
}: {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onNote: (note: Plus7Note) => void;
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
  required?: boolean;
  placeholder?: string;
  inputClassName?: string;
  pickerClassName?: string;
  /** Хранимый текст, который не разобрать как номер +7 («7012345»): старый номер. */
  legacyText?: string;
}) {
  const { t, i18n } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  // Казахстан или Россия — код у обоих +7, на номер выбор не влияет.
  const [country, setCountry] = useState('KZ');
  // Сколько цифр стояло перед курсором: после перестановки пробелов курсор
  // ставится после той же цифры, а не прыгает в конец.
  const caret = useRef<number | null>(null);
  // Набраны только «+» или «+7» — показываем их и ждём номер (значение формы
  // пока пустое). «+7» видно до первой цифры: иначе код «исчезал», и следующая
  // «8» (Петербург 812, бесплатные 800) принималась за местную восьмёрку.
  const [pending, setPending] = useState<'+' | '+7' | null>(null);
  // Номер не +7 из прежних данных: показан как есть с подсказкой «введите
  // заново»; первое же нажатие очищает поле — молча переделать его в +7 нельзя.
  const legacy = legacyText !== undefined || (value !== '' && !/^7\d{0,10}$/.test(value));
  const national = legacy ? '' : value.slice(1);
  const shown = legacy ? (legacyText ?? `+${value}`) : pending && !national ? pending : groupPlus7(national);
  const wasLegacy = useRef(legacy);
  useEffect(() => {
    if (legacy) onNote('legacy');
    // Номер подменили снаружи на верный (сброс формы, другой сотрудник) — подсказка уходит.
    else if (wasLegacy.current) onNote(null);
    wasLegacy.current = legacy;
    // onNote — сеттер состояния формы, стабилен.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legacy]);

  // Выделили номер целиком и вводят поверх — это новый номер, а не правка:
  // «8» в его начале снова местная восьмёрка, даже если прежний был на 8.
  const replacing = useRef(false);
  useEffect(() => {
    const el = input.current;
    if (!el) return undefined;
    const mark = () => {
      replacing.current = !!el.value && el.selectionStart === 0 && el.selectionEnd === el.value.length;
    };
    el.addEventListener('beforeinput', mark);
    return () => el.removeEventListener('beforeinput', mark);
  }, []);

  useLayoutEffect(() => {
    const el = input.current;
    if (caret.current === null || !el || document.activeElement !== el) return;
    let at = 0;
    for (let seen = 0; at < shown.length && seen < caret.current; at++) {
      if (/\d/.test(shown.charAt(at))) seen++;
    }
    caret.current = null;
    el.setSelectionRange(at, at);
  }, [shown]);

  return (
    <>
      {/* «KZ +7 ▾» сверху, под ним невидимый системный список — на телефоне
          открывается родной выбор, читалка видит обычный select. */}
      <span className={cn('relative flex h-full shrink-0 items-center gap-2 whitespace-nowrap border-0 border-r border-solid px-3 text-sm font-semibold', pickerClassName)}>
        <span aria-hidden="true">{`${country} +7`}</span>
        <svg aria-hidden="true" width="10" height="6" viewBox="0 0 10 6"><path d="M0 0h10L5 6z" fill="currentColor" /></svg>
        <select
          aria-label={t('phonePicker.country')}
          value={country}
          onChange={(event) => {
            setCountry(event.currentTarget.value);
            input.current?.focus();
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {countryOptions(i18n.language).map((c) => (
            <option key={c.iso} value={c.iso}>{`${c.name} +${c.code}`}</option>
          ))}
        </select>
      </span>
      <input
        ref={input}
        id={id}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        autoFocus={autoFocus}
        value={shown}
        // Образец — по стране: российские мобильные начинаются с 9.
        placeholder={placeholder ?? (country === 'RU' ? '900 000 00 00' : '701 000 00 00')}
        aria-invalid={invalid ? 'true' : 'false'}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        onChange={(event) => {
          const raw = event.currentTarget.value;
          const type = (event.nativeEvent as InputEvent).inputType;
          const whole = !type || type === 'insertFromPaste' || type === 'insertReplacementText' || type === 'insertFromDrop';
          // Любое нажатие по старому номеру его убирает: стирание — пустое поле,
          // набранная цифра или вставка — с чистого листа.
          if (legacy) {
            if (type?.startsWith('delete')) {
              setPending(null);
              onNote(null);
              onChange('');
              return;
            }
            const added = whole ? (raw.includes(shown) ? raw.replace(shown, '') : raw) : ((event.nativeEvent as InputEvent).data ?? '');
            const fresh = takePlus7(added, whole, '');
            setPending(fresh.pending ?? null);
            onNote(fresh.note);
            onChange(fresh.digits ? `7${fresh.digits}` : '');
            return;
          }
          const at = event.currentTarget.selectionStart ?? raw.length;
          let before = raw.slice(0, at).replace(/\D/g, '').length;
          const taken = takePlus7(raw, whole, replacing.current ? '' : national, !type?.startsWith('delete'));
          replacing.current = false;
          const { note, pending: waiting } = taken;
          let digits = taken.digits;
          // Стёрли пробел между группами — цифр столько же, и маска вернула бы
          // его на место: стирается соседняя цифра, а не «ничего».
          if (type?.startsWith('delete') && !pending && digits === national) {
            const index = type === 'deleteContentBackward' ? before - 1 : before;
            if (index >= 0 && index < digits.length) {
              digits = digits.slice(0, index) + digits.slice(index + 1);
              if (type === 'deleteContentBackward') before -= 1;
            }
          }
          // Полный номер: одиннадцатая цифра не принимается ни в конце, ни
          // в середине — номер остаётся как был, курсор на месте.
          const typed = raw.replace(/\D/g, '');
          if (!whole && !waiting && !note && !raw.trim().startsWith('+') && typed.length > 10) {
            digits = national;
            before = Math.max(0, before - 1);
          }
          setPending(waiting ?? null);
          caret.current = Math.max(0, Math.min(digits.length, before - (note === 'eight' ? 1 : 0)));
          onNote(note);
          onChange(digits ? `7${digits}` : '');
        }}
        onBlur={onBlur}
        className={cn('h-full min-w-0 grow border-0 bg-transparent px-3 text-sm outline-none', inputClassName)}
      />
      {value || pending ? (
        <button
          type="button"
          aria-label={t('phonePlus7.clear')}
          onClick={() => {
            setPending(null);
            onNote(null);
            onChange('');
            input.current?.focus();
          }}
          className="flex h-full w-11 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent text-lg opacity-50 hover:opacity-100"
        >
          ×
        </button>
      ) : null}
    </>
  );
}

/** Текст подсказки под полем: почему цифра не принята. */
export function plus7NoteKey(note: Plus7Note): string | null {
  return note ? `phonePlus7.${note}` : null;
}
