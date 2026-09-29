import { Link, useNavigate } from 'react-router-dom';

// The prototype used hash routes like "#/projects/p1?tab=files". The React app mounts the
// desktop at /desktop, so every legacy hash route maps to a real path with this prefix.
export const DESKTOP_BASE = '/desktop';
export const href = (hash) => DESKTOP_BASE + String(hash).replace(/^#/, '');

// <DLink to="#/projects/p1?tab=files"> or <DLink to="/projects/p1"> — both accepted.
export function DLink({ to, children, ...rest }) {
  return <Link to={href(to)} {...rest}>{children}</Link>;
}

export const useDesktopNavigate = () => {
  const navigate = useNavigate();
  return (hash, opts) => navigate(href(hash), opts);
};
