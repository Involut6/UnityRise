import { useEffect, useState } from 'react';
import { Eye, FileText } from 'lucide-react';
import { Modal } from '../ui/overlay';
import { Button, Skeleton, ErrorState } from '../ui/primitives';
import { fetchBlob } from '../../lib/api';

/** Authenticated document viewer: fetches the file with the bearer token and previews it in a modal. */
export function DocViewer({ path, name, label }: { path: string; name: string; label?: string }) {
  const [open, setOpen] = useState(false); const [url, setUrl] = useState<string | null>(null); const [err, setErr] = useState(false);
  useEffect(() => { if (!open) return; let u: string | null = null; setErr(false); fetchBlob(path).then(b => { u = URL.createObjectURL(b); setUrl(u); }).catch(() => setErr(true)); return () => { if (u) URL.revokeObjectURL(u); setUrl(null); }; }, [open, path]);
  const pdf = /\.pdf$/i.test(name), img = /\.(png|jpe?g|webp|gif)$/i.test(name);
  return <><Button size="sm" variant="outline" icon={<Eye size={15} />} onClick={() => setOpen(true)} aria-label={`View ${label ?? name}`}>View</Button>
    {open && <Modal size="lg" title={label ?? name} description={name} onClose={() => setOpen(false)}>{err ? <ErrorState message="Could not load this document." /> : !url ? <Skeleton className="h-72" /> :
      img ? <img src={url} alt={label ?? name} className="mx-auto max-h-[65vh] rounded-lg" /> : pdf ? <iframe src={url} title={name} className="h-[65vh] w-full rounded-lg border border-line" /> :
        <div className="py-8 text-center"><FileText className="mx-auto mb-2 text-muted" /><p className="mb-3 text-sm text-muted">Preview isn't available for this file type.</p><a href={url} download={name}><Button>Download file</Button></a></div>}</Modal>}</>;
}
