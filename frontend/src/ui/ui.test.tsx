import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { facts, posted } from '../jobs/JobRow'
import type { Job } from '../api'
import { TagInput } from './TagInput'
import { Toggle } from './ui'

function Harness({ initial = [] as string[] }) {
  const [values, setValues] = useState(initial)
  return <TagInput label="Skills" values={values} onChange={setValues} />
}

describe('TagInput', () => {
  it('adds comma separated values without duplicates, case-insensitively', async () => {
    render(<Harness initial={['SQL']} />)
    await userEvent.type(screen.getByRole('textbox', { name: 'Skills' }), 'sql, Tableau,  dbt {Enter}')
    const items = screen.getAllByRole('listitem').map((li) => li.textContent?.replace('×', ''))
    expect(items).toEqual(['SQL', 'Tableau', 'dbt'])
  })

  it('removes a value by clicking it, and the last one with Backspace', async () => {
    render(<Harness initial={['SQL', 'Tableau', 'dbt']} />)
    await userEvent.click(screen.getByRole('button', { name: /Remove SQL/ }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Skills' }), '{Backspace}')
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Remove Tableau/ })).toBeInTheDocument()
  })
})

describe('Toggle', () => {
  it('is a labelled switch', async () => {
    const onChange = vi.fn()
    render(<Toggle checked={false} onChange={onChange} label="Search LinkedIn" />)
    const toggle = screen.getByRole('switch', { name: 'Search LinkedIn' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith(true)
  })
})

const base = {
  visa_sponsorship: 'unclear', remote_type: 'unclear', direct: false, years_required: null,
  salary_below_minimum: false, bucket: 0,
} as unknown as Job

describe('job facts', () => {
  it('puts sponsorship first and warns about low pay', () => {
    const f = facts({ ...base, visa_sponsorship: 'yes', remote_type: 'hybrid', salary_below_minimum: true })
    expect(f.map((x) => x.text)).toEqual(['Sponsors visas', 'Hybrid', 'Pays below your minimum'])
    expect(f[0].tone).toBe('good')
    expect(f[2].tone).toBe('warn')
  })

  it("doesn't repeat remote worldwide when the place label already says it", () => {
    expect(facts({ ...base, remote_type: 'remote_worldwide', bucket: 1 })).toEqual([])
    expect(facts({ ...base, remote_type: 'remote_worldwide', bucket: 0 })[0].text).toBe('Remote worldwide')
  })

  it('describes posting age in words', () => {
    expect(posted(null)).toBe('')
    expect(posted(0)).toBe('Posted today')
    expect(posted(1)).toBe('Posted yesterday')
    expect(posted(9)).toBe('Posted 9 days ago')
  })
})
