import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AppState } from '../api'
import { FlowProvider } from './flow'
import { StepShell } from './StepShell'

const fakeState = {} as AppState

function renderStep(onSubmit: () => Promise<void> | void, back: () => void) {
  return render(
    <FlowProvider value={{ mode: 'setup', state: fakeState, reference: null, setProfile: vi.fn(), setKeys: vi.fn(), next: vi.fn(), back }}>
      <StepShell title="Which jobs should it look for?" onSubmit={onSubmit} canSubmit>
        <p>content</p>
      </StepShell>
    </FlowProvider>,
  )
}

describe('StepShell Back button', () => {
  it('saves the current step before navigating back, so an in-progress answer is not lost', async () => {
    const order: string[] = []
    const onSubmit = vi.fn(async () => {
      order.push('saved')
    })
    const back = vi.fn(() => order.push('went back'))
    renderStep(onSubmit, back)

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(back).toHaveBeenCalledTimes(1)
    // The save must complete before navigating away, not after.
    expect(order).toEqual(['saved', 'went back'])
  })

  it('still goes back even if there was nothing valid to save yet', async () => {
    const onSubmit = vi.fn(async () => {
      throw new Error('Pick or add at least one job title.')
    })
    const back = vi.fn()
    renderStep(onSubmit, back)

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(back).toHaveBeenCalledTimes(1)
  })
})
