import i18n from '../i18n';

/**
 * Телефоны любой страны. Сервер хранит номер в E.164 цифрами: код страны
 * и номер подряд, «77010000102», «996555123456». Тот же список кодов —
 * у страницы входа Keycloak (`phone-login.js`).
 *
 * Файл один на три проекта: front, portal и admin держат одинаковые копии,
 * `phoneCopies.test.ts` в каждом сверяет их побайтно. Правка — во всех трёх.
 */

export interface Country {
  iso: string;
  code: string;
}

/** Страны СНГ — сверху выбора, по алфавиту; дальше остальные, тоже по алфавиту. */
export const CIS_COUNTRIES = ['AM', 'AZ', 'BY', 'KZ', 'KG', 'MD', 'RU', 'TJ', 'TM', 'UZ'];

/**
 * Название страны: свой перевод (`phoneCountry.<ISO>`), если справочник
 * браузера называет её непривычно для наших людей («Киргизия»), иначе — его.
 */
function nameOf(iso: string, lang: string, names: Intl.DisplayNames | null): string {
  return i18n.t(`phoneCountry.${iso}`, { lng: lang, defaultValue: '' }) || names?.of(iso) || iso;
}

export const COUNTRIES: Country[] = (
  'AF 93,AL 355,DZ 213,AD 376,AO 244,AG 1,AR 54,AM 374,AU 61,AT 43,AZ 994,BS 1,BH 973,' +
  'BD 880,BB 1,BY 375,BE 32,BZ 501,BJ 229,BT 975,BO 591,BA 387,BW 267,BR 55,BN 673,BG 359,' +
  'BF 226,BI 257,KH 855,CM 237,CA 1,CV 238,CF 236,TD 235,CL 56,CN 86,CO 57,KM 269,CG 242,' +
  'CD 243,CR 506,CI 225,HR 385,CU 53,CY 357,CZ 420,DK 45,DJ 253,DM 1,DO 1,EC 593,EG 20,' +
  'SV 503,GQ 240,ER 291,EE 372,SZ 268,ET 251,FJ 679,FI 358,FR 33,GA 241,GM 220,GE 995,DE 49,' +
  'GH 233,GR 30,GD 1,GT 502,GN 224,GW 245,GY 592,HT 509,HN 504,HK 852,HU 36,IS 354,IN 91,' +
  'ID 62,IR 98,IQ 964,IE 353,IL 972,IT 39,JM 1,JP 81,JO 962,KZ 7,KE 254,KI 686,KP 850,KR 82,' +
  'KW 965,KG 996,LA 856,LV 371,LB 961,LS 266,LR 231,LY 218,LI 423,LT 370,LU 352,MO 853,' +
  'MG 261,MW 265,MY 60,MV 960,ML 223,MT 356,MH 692,MR 222,MU 230,MX 52,FM 691,MD 373,MC 377,' +
  'MN 976,ME 382,MA 212,MZ 258,MM 95,NA 264,NR 674,NP 977,NL 31,NZ 64,NI 505,NE 227,NG 234,' +
  'MK 389,NO 47,OM 968,PK 92,PW 680,PS 970,PA 507,PG 675,PY 595,PE 51,PH 63,PL 48,PT 351,' +
  'PR 1,QA 974,RO 40,RU 7,RW 250,KN 1,LC 1,VC 1,WS 685,SM 378,ST 239,SA 966,SN 221,RS 381,' +
  'SC 248,SL 232,SG 65,SK 421,SI 386,SB 677,SO 252,ZA 27,SS 211,ES 34,LK 94,SD 249,SR 597,' +
  'SE 46,CH 41,SY 963,TW 886,TJ 992,TZ 255,TH 66,TL 670,TG 228,TO 676,TT 1,TN 216,TR 90,' +
  'TM 993,TV 688,UG 256,UA 380,AE 971,GB 44,US 1,UY 598,UZ 998,VU 678,VA 39,VE 58,VN 84,' +
  'XK 383,YE 967,ZM 260,ZW 263'
)
  .split(',')
  .map((pair) => {
    const [iso, code] = pair.split(' ');
    return { iso, code };
  });

/** Код страны в начале номера: самый длинный подходящий; у +7 — Казахстан. */
export function dialCodeOf(digits: string): string | null {
  let found: string | null = null;
  for (const { code } of COUNTRIES) {
    if (digits.startsWith(code) && (!found || code.length > found.length)) found = code;
  }
  return found;
}

/**
 * «77010000102» → «+7 701 000 01 02», «996555123456» → «+996 555123456».
 * Номер +7 разбит по разрядам, как его привыкли читать. У других стран
 * отделён только код: чужой номер, разбитый по чужим правилам, читается
 * хуже неразбитого. Не номер — как есть.
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
  }
  const code = digits.length >= 8 ? dialCodeOf(digits) : null;
  return code ? `+${code} ${digits.slice(code.length)}` : phone;
}

/** Страны для выбора: сначала СНГ, затем остальные — по алфавиту на языке интерфейса. */
export function countryOptions(language: string): (Country & { name: string })[] {
  const lang = language.slice(0, 2);
  const names = (() => {
    try {
      return new Intl.DisplayNames([lang], { type: 'region' });
    } catch {
      return null;
    }
  })();
  // Только +7 — Казахстан и Россия (решение владельца 2026-11-02): вход и все
  // формы с номером (клиенты, сотрудники, каналы WhatsApp) — по номерам +7,
  // как на странице входа. Полный список остаётся для показа чужих номеров.
  const named = COUNTRIES.filter((c) => c.code === '7').map((c) => ({ ...c, name: nameOf(c.iso, lang, names) }));
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, lang);
  return [
    ...named.filter((c) => CIS_COUNTRIES.includes(c.iso)).sort(byName),
    ...named.filter((c) => !CIS_COUNTRIES.includes(c.iso)).sort(byName),
  ];
}

/**
 * Номер из телефонной книги цифрами с кодом страны. Записан он как угодно:
 * «+996 555 12 34 56» — код уже есть; «8 701 …» и «701 …» без «+» — свой,
 * казахстанский.
 */
export function phoneFromBook(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (raw.trim().startsWith('+') || raw.trim().startsWith('00')) return digits.replace(/^00/, '');
  if (digits.length === 11 && /^[78]/.test(digits)) return `7${digits.slice(1)}`;
  if (digits.length === 10) return `7${digits}`;
  return digits;
}

/**
 * Почему набранное не принято: «8» в начале, чужой код, старый номер
 * не +7 (из прежних данных — его вводят заново).
 */
export type Plus7Note = 'eight' | 'foreign' | 'legacy' | null;

/**
 * Номер +7 из набранного — как на странице входа (`phone-login.js`, take):
 * десять цифр после кода. `prev` — цифры номера до этого ввода.
 * `pending` — в поле пока только «+» (ждём 7) или «+7» (ждём номер).
 *
 * - «+7…» (набор или вставка) — свой код, после него цифры как есть:
 *   «8» после «+7» — часть номера (Петербург 812, бесплатные 800).
 * - «+» и другая цифра — чужой код, отказ.
 * - `whole` (вставка, автозаполнение): 11 цифр с 7 или 8 в начале — код или
 *   местная восьмёрка, срезаются; больше десяти иначе — чужой номер, отказ.
 * - Набор: «8», поставленная в начало номера, который с неё не начинался, —
 *   местная восьмёрка, не принимается. Номер на 8 (вставленный 800, 812)
 *   правится как обычно. Лишняя цифра срезается в конце — первую резать
 *   нельзя, все номера Казахстана начинаются с 7.
 */
export function takePlus7(
  raw: string,
  whole: boolean,
  prev = '',
  /** Ввод, а не стирание: при стирании первой цифры соседняя «8» не трогается. */
  inserting = true,
): { digits: string; note: Plus7Note; pending?: '+' | '+7' } {
  const text = raw.trim();
  if (text.startsWith('+')) {
    const rest = text.slice(1).trimStart();
    if (!rest) return { digits: '', note: null, pending: '+' };
    if (!rest.startsWith('7')) return whole ? { digits: '', note: 'foreign' } : { digits: '', note: 'foreign', pending: '+' };
    const digits = rest.slice(1).replace(/\D/g, '').slice(0, 10);
    return !digits && !whole ? { digits, note: null, pending: '+7' } : { digits, note: null };
  }
  let digits = text.replace(/\D/g, '');
  if (whole) {
    if (digits.length === 11 && /^[78]/.test(digits)) digits = digits.slice(1);
    else if (digits.length > 10) return { digits: '', note: 'foreign' };
    return { digits, note: null };
  }
  // Номер на 8 правится как обычно; но одна «8» вместо всего номера (выделил
  // всё и набрал) — снова местная восьмёрка.
  if (inserting && digits.startsWith('8') && !(prev.startsWith('8') && digits.length > 1)) {
    return { digits: digits.replace(/^8+/, '').slice(0, 10), note: 'eight' };
  }
  return { digits: digits.slice(0, 10), note: null };
}

/** «7011234567» → «701 123 45 67» — так номер диктуют и читают. */
export function groupPlus7(digits: string): string {
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 8), digits.slice(8, 10)].filter(Boolean).join(' ');
}
