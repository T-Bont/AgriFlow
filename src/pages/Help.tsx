import './Help.css'

type HelpItem = {
  question: string
  answer: string
  gifPath: string
  gifAlt: string
}

const helpItems: HelpItem[] = [
  {
    question: 'How do I draw a new field?',
    answer:
      'Open the Map, use Draw new field (or add from Fields), and draw the boundary around your new field. Save to create the field and make it available for planning and logs.',
    gifPath: '/help-gifs/draw-new-field.gif',
    gifAlt: 'Demonstration of drawing a new field on the map.',
  },
  {
    question: 'How do I change my static dashboard view?',
    answer:
      'On the map toolbar, choose the Current View selector and switch to the saved static view you want to use.',
    gifPath: '/help-gifs/establish-dashboard-view.gif',
    gifAlt: 'Demonstration of changing the current static dashboard view.',
  },
  {
    question: 'How do I create an additional static dashboard?',
    answer:
      'From the map, use Add View to create another static snapshot. Name it clearly so it is easy to pick later on the map and in Settings.',
    gifPath: '/help-gifs/create-new-view.gif',
    gifAlt: 'Demonstration of creating an additional static dashboard view.',
  },
  {
    question: 'How do I edit a fields boundaries?',
    answer:
      'Open the field in map edit mode, adjust boundary points to the correct shape, then save. Review the updated boundary before leaving the editor.',
    gifPath: '/help-gifs/edit-field-boundary.gif',
    gifAlt: 'Demonstration of editing a field boundary.',
  },
]

export default function Help() {
  return (
    <div className="help-page">
      <p className="help-intro">
        Browse common questions and expand each section to view the steps and a short walkthrough GIF.
      </p>

      <section className="help-list" aria-label="Frequently asked questions">
        {helpItems.map((item) => (
          <details key={item.question} className="help-item">
            <summary className="help-question">{item.question}</summary>
            <div className="help-answer-wrap">
              <p className="help-answer">{item.answer}</p>
              <img className="help-gif" src={item.gifPath} alt={item.gifAlt} loading="lazy" />
            </div>
          </details>
        ))}
      </section>
    </div>
  )
}
