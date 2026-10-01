import { createContext, useContext } from 'react';

/** FormField publishes the control's id / description / invalid state here, so wrapped controls are still labelled correctly. */
export const FieldCtx = createContext<{ id: string; describedBy?: string; invalid: boolean } | null>(null);
export const useField = (p: { id?: string; invalid?: boolean; 'aria-describedby'?: string }) => {
  const f = useContext(FieldCtx); const invalid = p.invalid ?? f?.invalid;
  return { id: p.id ?? f?.id, 'aria-describedby': p['aria-describedby'] ?? f?.describedBy, 'aria-invalid': invalid || undefined, invalid };
};
