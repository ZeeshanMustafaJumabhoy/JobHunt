import { RotateCcw } from 'lucide-react'
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Loader } from './ui/Loader'
import { Button, ThemeToggle } from './ui/ui'
import './index.css'

const MESSAGES = ['Reading your resume...', 'Scanning your resume...', 'Searching for jobs...']

function Demo() {
  const [runId, setRunId] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDone(false)
    const t = setTimeout(() => setDone(true), 5000)
    return () => clearTimeout(t)
  }, [runId])

  return (
    <div className="mx-auto flex min-h-dvh max-w-4xl flex-col items-center justify-center gap-10 px-6">
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <Button variant="secondary" icon={RotateCcw} onClick={() => setRunId((n) => n + 1)}>
          Restart (5s)
        </Button>
        <span className="text-sm text-muted">{done ? 'Done — this is the resting state after loading.' : 'Loading for 5 real seconds…'}</span>
      </div>
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
        {MESSAGES.map((m, i) => (
          <div key={runId + '-' + i} className="card flex h-56 w-56 items-center justify-center p-6">
            {done ? (
              <p className="text-sm font-medium text-success">Done ✓</p>
            ) : (
              <Loader size={i === 2 ? 80 : i === 1 ? 48 : 64} message={m} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
)
