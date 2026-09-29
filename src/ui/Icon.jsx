import { ICONS } from '../shared/icons';

// Icon paths are static strings from the shared Lucide set, never user input.
export default function Icon({ name, small = false, className = '' }) {
  const size = small ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <svg
      className={`${size} flex-none ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ICONS[name] || '' }}
    />
  );
}
