import type { ReactNode } from 'react';

export function Sensitive({ children, block }: { children: ReactNode; block?: boolean }) {
  const Tag = block ? 'div' : 'span';
  return <Tag className="sensitive">{children}</Tag>;
}
