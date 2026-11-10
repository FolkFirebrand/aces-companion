'use client'

import { useEffect, useRef, useState } from 'react'
import { DossierButton } from '@/components/dossier/DossierButton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** The crop window's width and height on screen, in CSS pixels. */
const VIEW = 280
/** The saved photo's width and height: photos are shown square and small, so this keeps saves light. */
const OUT = 200
const MAX_ZOOM = 4
const NUDGE = 10

type Offset = { x: number; y: number }

/** Keeps the image covering the whole crop window. */
function clamp(o: Offset, width: number, height: number): Offset {
  return { x: Math.min(0, Math.max(VIEW - width, o.x)), y: Math.min(0, Math.max(VIEW - height, o.y)) }
}

/**
 * Choose a photo, then crop it square: drag to move it, the slider to zoom. `choose` opens the file chooser and
 * `picker` holds the hidden file input and the crop dialog, to render once beside the button that calls `choose`.
 */
export function usePhotoPicker(onPhoto: (photoUrl: string) => void, title = 'Crop the photo') {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)

  const picker = (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-hidden="true" tabIndex={-1}
        onChange={e => { setFile(e.target.files?.[0] ?? null); e.target.value = '' }} />
      <Dialog open={file !== null} onOpenChange={o => { if (!o) setFile(null) }}>
        <DialogContent className="bg-surface border-line text-text-primary">
          {file && <Cropper key={`${file.name}-${file.lastModified}`} file={file} title={title}
            onCancel={() => setFile(null)} onDone={url => { setFile(null); onPhoto(url) }} />}
        </DialogContent>
      </Dialog>
    </>
  )
  return { choose: () => fileRef.current?.click(), picker }
}

function Cropper({ file, title, onCancel, onDone }: { file: File; title: string; onCancel: () => void; onDone: (photoUrl: string) => void }) {
  const [src] = useState(() => URL.createObjectURL(file))
  const imgRef = useRef<HTMLImageElement>(null)
  const drag = useRef<{ pointer: number; x: number; y: number; from: Offset } | null>(null)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [failed, setFailed] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })

  useEffect(() => () => URL.revokeObjectURL(src), [src])

  const scale = natural ? (VIEW / Math.min(natural.w, natural.h)) * zoom : 1
  const width = natural ? natural.w * scale : VIEW
  const height = natural ? natural.h * scale : VIEW

  function loaded(img: HTMLImageElement) {
    const w = img.naturalWidth, h = img.naturalHeight
    const s = VIEW / Math.min(w, h)
    setNatural({ w, h })
    setOffset({ x: (VIEW - w * s) / 2, y: (VIEW - h * s) / 2 })
  }

  function rezoom(next: number) {
    if (!natural) return
    // Zoom about the middle of the crop window.
    const base = VIEW / Math.min(natural.w, natural.h)
    const cx = (VIEW / 2 - offset.x) / scale, cy = (VIEW / 2 - offset.y) / scale
    const s = base * next
    setZoom(next)
    setOffset(clamp({ x: VIEW / 2 - cx * s, y: VIEW / 2 - cy * s }, natural.w * s, natural.h * s))
  }

  function move(e: React.PointerEvent) {
    const d = drag.current
    if (!d || d.pointer !== e.pointerId) return
    setOffset(clamp({ x: d.from.x + e.clientX - d.x, y: d.from.y + e.clientY - d.y }, width, height))
  }

  function nudge(e: React.KeyboardEvent) {
    const step: Record<string, Offset> = { ArrowLeft: { x: NUDGE, y: 0 }, ArrowRight: { x: -NUDGE, y: 0 }, ArrowUp: { x: 0, y: NUDGE }, ArrowDown: { x: 0, y: -NUDGE } }
    const by = step[e.key]
    if (!by) return
    e.preventDefault()
    setOffset(o => clamp({ x: o.x + by.x, y: o.y + by.y }, width, height))
  }

  function save() {
    const img = imgRef.current
    if (!img || !natural) return
    const canvas = document.createElement('canvas')
    canvas.width = OUT
    canvas.height = OUT
    canvas.getContext('2d')!.drawImage(img, -offset.x / scale, -offset.y / scale, VIEW / scale, VIEW / scale, 0, 0, OUT, OUT)
    onDone(canvas.toDataURL('image/jpeg', 0.8))
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display font-bold text-2xl uppercase text-active">{title}</DialogTitle>
        <DialogDescription className="m-0 text-sm text-text-secondary">Drag the photo to frame it and use the slider to zoom.</DialogDescription>
      </DialogHeader>

      {failed
        ? <p role="alert" className="m-0 text-sm text-danger">That file couldn&apos;t be opened as a picture. Try a JPEG or PNG.</p>
        : (
          <div className="flex flex-col items-center gap-3">
            <div
              tabIndex={0}
              role="img"
              aria-label="Crop window. Drag, or use the arrow keys, to move the photo."
              onKeyDown={nudge}
              onPointerDown={e => {
                e.currentTarget.setPointerCapture(e.pointerId)
                drag.current = { pointer: e.pointerId, x: e.clientX, y: e.clientY, from: offset }
              }}
              onPointerMove={move}
              onPointerUp={() => { drag.current = null }}
              onPointerCancel={() => { drag.current = null }}
              className="relative overflow-hidden bg-surface-deep border-2 border-active touch-none select-none cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-result"
              style={{ width: VIEW, height: VIEW }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={imgRef} src={src} alt="" draggable={false} onLoad={e => loaded(e.currentTarget)} onError={() => setFailed(true)}
                className="absolute max-w-none pointer-events-none"
                style={{ left: offset.x, top: offset.y, width, height, visibility: natural ? 'visible' : 'hidden' }} />
            </div>
            <label className="w-full flex items-center gap-3" style={{ maxWidth: VIEW }}>
              <span className="field-label text-text-secondary">Zoom</span>
              <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom} disabled={!natural}
                onChange={e => rezoom(Number(e.target.value))} className="flex-1 accent-[var(--color-active)]" />
            </label>
          </div>
        )}

      <DialogFooter className="gap-2 flex-wrap bg-transparent border-line">
        <DossierButton variant="secondary" onClick={onCancel} className="border-line text-text-secondary">Cancel</DossierButton>
        <DossierButton variant="secondary" onClick={save} disabled={!natural || failed}>Use photo</DossierButton>
      </DialogFooter>
    </>
  )
}
