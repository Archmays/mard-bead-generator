interface StepTitleProps {
  number: '01' | '02' | '03'
  title: string
  description: string
}

export function StepTitle({ number, title, description }: StepTitleProps) {
  return (
    <header className="step-title">
      <span className="step-number" aria-hidden="true">{number}</span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </header>
  )
}
