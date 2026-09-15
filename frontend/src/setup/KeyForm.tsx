import { CircleCheck, KeyRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { api, ApiError } from '../api'
import { Button, Field, Notice } from '../ui/ui'
import { useFlow } from './flow'

export interface KeyField {
  name: string
  label: string
  type?: 'password' | 'text' | 'email'
  placeholder?: string
  optional?: boolean
}

/**
 * Test-and-save form for one service. The key goes to the local backend, which
 * checks it against the real service before writing it to .env.
 */
export function KeyForm({
  service,
  envKey,
  fields,
  help,
  onSaved,
  saveLabel = 'Test and save',
}: {
  service: string
  envKey: string
  fields: KeyField[]
  help?: ReactNode
  onSaved?: () => void
  saveLabel?: string
}) {
  const { state, setKeys } = useFlow()
  const saved = state.keys[envKey]
  const [values, setValues] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState(!saved?.set)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const ready = fields.every((f) => f.optional || (values[f.name] ?? '').trim())

  async function save() {
    setBusy(true)
    setResult(null)
    try {
      const res = await api.saveKey(service, values)
      setKeys(res.keys)
      setResult({ ok: true, message: res.message })
      setValues({})
      setEditing(false)
      onSaved?.()
    } catch (err) {
      setResult({ ok: false, message: err instanceof ApiError ? err.message : 'Saving failed.' })
    } finally {
      setBusy(false)
    }
  }

  if (!editing && saved?.set) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-success/25 bg-success-soft px-4 py-3">
        <CircleCheck aria-hidden className="size-5 text-success" />
        <p className="text-[0.9375rem] font-medium text-ink">
          Saved <span className="ml-1 font-normal text-muted tabular-nums">{saved.hint}</span>
        </p>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setEditing(true)}>
          Replace
        </Button>
        {result?.ok && <span className="sr-only" role="status">{result.message}</span>}
      </div>
    )
  }

  return (
    <div
      className="flex flex-col gap-4"
      onKeyDown={(e) => {
        // These forms sit inside a step's form. Enter here should test the key,
        // not submit the whole step.
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
          e.preventDefault()
          if (ready && !busy) void save()
        }
      }}
    >
      {help}
      {fields.map((f) => (
        <Field
          key={f.name}
          label={f.label}
          type={f.type ?? 'password'}
          icon={f.type === 'password' || !f.type ? KeyRound : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={f.placeholder}
          value={values[f.name] ?? ''}
          onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
        />
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={save} busy={busy} disabled={!ready}>
          {busy ? 'Testing' : saveLabel}
        </Button>
        {saved?.set && (
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Keep the saved one
          </Button>
        )}
      </div>
      {result && (
        <div>
          <Notice tone={result.ok ? 'ok' : 'error'}>{result.message}</Notice>
        </div>
      )}
    </div>
  )
}
