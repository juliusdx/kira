import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ComboPill } from './ComboPill'

describe('ComboPill', () => {
  it('stays hidden below 2 — a "1x combo" is noise', () => {
    const { container } = render(<ComboPill combo={0} />)
    expect(container.textContent).toBe('')
    const one = render(<ComboPill combo={1} />)
    expect(one.container.textContent).toBe('')
  })

  it('appears from 2 with an accessible label', () => {
    render(<ComboPill combo={2} />)
    expect(screen.getByRole('status')).toHaveAccessibleName('2 correct in a row')
    expect(screen.getByRole('status')).toHaveTextContent('2')
  })

  it('escalates its emoji at 5 and 10', () => {
    expect(render(<ComboPill combo={4} />).container.textContent).toContain('✨')
    expect(render(<ComboPill combo={5} />).container.textContent).toContain('⚡')
    expect(render(<ComboPill combo={10} />).container.textContent).toContain('🔥')
  })

  it('never shows a timer — pace must not compete with self-explanation', () => {
    const { container } = render(<ComboPill combo={9} />)
    expect(container.textContent).not.toMatch(/\d+\s*s|sec|:/)
  })
})
