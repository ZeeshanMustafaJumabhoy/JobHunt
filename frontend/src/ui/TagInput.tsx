import { Plus } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import { Button, Chip } from './ui'

/** A list of short phrases the user can remove and add to. */
export function TagInput({
  label,
  values,
  onChange,
  placeholder,
  hint,
  max = 50,
}: {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  hint?: string
  max?: number
}) {
  const id = useId()
  const [draft, setDraft] = useState('')

  function add() {
    const parts = draft
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const existing = new Set(values.map((v) => v.toLowerCase()))
    const fresh = parts.filter((p) => !existing.has(p.toLowerCase()))
    if (fresh.length) onChange([...values, ...fresh].slice(0, max))
    setDraft('')
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add()
    } else if (e.key === 'Backspace' && !draft && values.length) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      {values.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2" aria-label={label}>
          {values.map((v) => (
            <li key={v}>
              <Chip selected removable label={`Remove ${v}`} onToggle={() => onChange(values.filter((x) => x !== v))}>
                {v}
              </Chip>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder}
          className="h-11 min-w-0 flex-1 rounded-[10px] border border-line bg-surface px-3.5 text-base shadow-card transition-[border-color,box-shadow] duration-150 placeholder:text-faint hover:border-line-strong focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none sm:text-[0.9375rem]"
        />
        <Button variant="secondary" icon={Plus} onClick={add} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
      {hint && <p className="mt-1.5 text-sm text-muted">{hint}</p>}
    </div>
  )
}
