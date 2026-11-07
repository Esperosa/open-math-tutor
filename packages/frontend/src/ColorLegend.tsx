import type { Locale } from '@openmathtutor/shared';
import type { MessageKey } from './i18n';

export interface ColorLegendItem {
  id: 'red-pen' | 'teal-pen' | 'green-mark' | 'red-mark' | 'gray-mark';
  label: Record<Locale, string>;
  shapeDesc: Record<Locale, string>;
  colorLight: string;
  colorDark: string;
  shape: 'pen-red' | 'pen-teal' | 'circle-check' | 'cross' | 'question-dot';
}

export const COLOR_LEGEND_ITEMS: ColorLegendItem[] = [
  {
    id: 'red-pen',
    label: {
      cs: 'Červené pero: oprava nebo nalezená chyba',
      en: 'Red pen: correction or detected error',
    },
    shapeDesc: {
      cs: 'Pero pro označení a opravu chyby',
      en: 'Pen used to mark and correct mistakes',
    },
    colorLight: '#b42318',
    colorDark: '#ff8577',
    shape: 'pen-red',
  },
  {
    id: 'teal-pen',
    label: {
      cs: 'Tyrkysové pero: vysvětlení a postup učitele',
      en: 'Teal pen: teacher explanation and guidance',
    },
    shapeDesc: {
      cs: 'Pero pro nápovědu a vysvětlení dalšího kroku',
      en: 'Pen used for hints and explaining the next step',
    },
    colorLight: '#065f69',
    colorDark: '#79d2c5',
    shape: 'pen-teal',
  },
  {
    id: 'green-mark',
    label: {
      cs: 'Zelená ✓ (kroužek): správný krok',
      en: 'Green ✓ (circle): correct step',
    },
    shapeDesc: {
      cs: 'Kruhový tvar se symbolem zaškrtnutí ✓',
      en: 'Circular shape with checkmark ✓ symbol',
    },
    colorLight: '#136340',
    colorDark: '#6ee7b7',
    shape: 'circle-check',
  },
  {
    id: 'red-mark',
    label: {
      cs: 'Červená ✗ (kříž): nesedí',
      en: 'Red ✗ (cross): does not match',
    },
    shapeDesc: {
      cs: 'Křížkový tvar se symbolem ✗',
      en: 'Cross shape with ✗ symbol',
    },
    colorLight: '#a32d2d',
    colorDark: '#fca5a5',
    shape: 'cross',
  },
  {
    id: 'gray-mark',
    label: {
      cs: 'Oranžový přerušovaný rámeček s „?“: nejisté čtení rukopisu',
      en: 'Orange dashed frame with "?": uncertain handwriting reading',
    },
    shapeDesc: {
      cs: 'Oranžový přerušovaný rámeček s otazníkem upozorňující na symbol k ověření',
      en: 'Orange dashed border with question mark highlighting symbol to verify',
    },
    colorLight: '#c2410c',
    colorDark: '#fb923c',
    shape: 'question-dot',
  },
];

interface Props {
  open: boolean;
  onClose(): void;
  locale: Locale;
  t: Record<MessageKey, string>;
}

export function ColorLegendDialog({ open, onClose, locale, t }: Props) {
  if (!open) return null;

  return (
    <div
      className="color-legend-backdrop"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="color-legend-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="color-legend-title"
        data-testid="color-legend-dialog"
      >
        <div className="color-legend-head">
          <h2 id="color-legend-title" className="color-legend-title">{t.colorLegendTitle}</h2>
          <button
            type="button"
            className="color-legend-close"
            onClick={onClose}
            aria-label={t.close}
            title={t.close}
          >
            ✕
          </button>
        </div>
        <p className="color-legend-note">{t.legendA11yNote}</p>
        <ul className="color-legend-list">
          {COLOR_LEGEND_ITEMS.map(item => (
            <li key={item.id} className={`color-legend-item legend-${item.id}`} data-testid={`legend-item-${item.id}`}>
              <span className={`legend-badge shape-${item.shape}`} aria-hidden="true">
                {item.shape === 'pen-red' && (
                  <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                )}
                {item.shape === 'pen-teal' && (
                  <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                )}
                {item.shape === 'circle-check' && <span>✓</span>}
                {item.shape === 'cross' && <span>✗</span>}
                {item.shape === 'question-dot' && <span>?</span>}
              </span>
              <div className="legend-text legend-item-body">
                <strong className="legend-item-title">{item.label[locale]}</strong>
                <small className="legend-item-desc">{item.shapeDesc[locale]}</small>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
