import { useId, useState, type KeyboardEvent } from 'react'
import { Chip } from './ui'

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
          className="h-11 min-w-0 flex-1 rounded-md border border-rule bg-sheet px-3 text-[0.95rem] placeholder:text-faint focus:border-pen focus:outline-none"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="h-11 rounded-md border border-rule bg-sheet px-4 text-[0.95rem] hover:border-graphite disabled:opacity-40"
        >
          Add
        </button>
      </div>
      {hint && <p className="mt-1.5 text-sm text-graphite">{hint}</p>}
    </div>
  )
}
