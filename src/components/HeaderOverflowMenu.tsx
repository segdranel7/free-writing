import {
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from 'react';
import { MoreVertical } from 'lucide-react';

export type HeaderOverflowMenuItem = {
  label: string;
  title?: string;
  icon: ReactNode;
  disabled?: boolean;
  active?: boolean;
  pressed?: boolean;
  danger?: boolean;
  draggable?: boolean;
  onClick?: () => void;
  onDragStart?: (event: ReactDragEvent<HTMLButtonElement>) => void;
  onDragEnd?: () => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerCancel?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
};

type HeaderOverflowMenuProps = {
  label?: string;
  items: HeaderOverflowMenuItem[];
};

export function HeaderOverflowMenu({ label = 'More actions', items }: HeaderOverflowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className="header-overflow" ref={menuRef}>
      <button
        className={isOpen ? 'icon-button active' : 'icon-button'}
        type="button"
        title={label}
        aria-label={label}
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={() => setIsOpen((current) => !current)}
      >
        <MoreVertical size={18} />
      </button>
      {isOpen && (
        <div className="header-overflow-menu" aria-label={label}>
          {items.map((item) => (
            <button
              key={item.label}
              className={[
                'header-overflow-item',
                item.active ? 'active' : '',
                item.danger ? 'danger' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              type="button"
              title={item.title ?? item.label}
              aria-label={item.label}
              aria-pressed={item.pressed}
              draggable={item.draggable}
              disabled={item.disabled}
              onDragStart={item.onDragStart}
              onDragEnd={item.onDragEnd}
              onPointerDown={item.onPointerDown}
              onPointerMove={item.onPointerMove}
              onPointerUp={item.onPointerUp}
              onPointerCancel={item.onPointerCancel}
              onClick={() => {
                item.onClick?.();
                setIsOpen(false);
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
