import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, ExternalLink, Quote } from 'lucide-react'

const plays = [
  {
    title: 'Doctor Faustus',
    subtitle: 'The Tragical History of Doctor Faustus',
    url: '/api/v1/documents/download?path=dr-faustus/pg811-images.html',
    description: 'The scholar who sells his soul to the devil—a tale of ambition, knowledge, and damnation.',
  },
  {
    title: 'The Jew of Malta',
    url: '/api/v1/documents/download?path=jew-of-malta/pg901-images.html',
    description: 'Barabas and the fraught politics of Malta—revenge, intrigue, and moral complexity.',
  },
  {
    title: 'Tamburlaine the Great',
    url: 'https://www.gutenberg.org/ebooks/1094',
    description: 'The rise of the Scythian shepherd who became conqueror of empires.',
  },
  {
    title: 'Edward II',
    url: 'https://www.gutenberg.org/ebooks/38246',
    description: 'The troubled reign of Edward II—power, rebellion, and tragedy.',
  },
]

const quotes = [
  {
    text: "Was this the face that launch'd a thousand ships",
    source: 'Doctor Faustus',
  },
  {
    text: 'Infinite riches in a little room',
    source: 'The Jew of Malta',
  },
]

export default function AboutMarlowe() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Christopher Marlowe</h1>
        <p className="text-base text-muted-foreground mt-1">
          Elizabethan playwright, poet, and namesake of Marlowe
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            About the Namesake
          </CardTitle>
          <CardDescription>
            Why this AI governance app bears his name
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <p>
            <strong className="text-foreground">Christopher Marlowe</strong> (1564–1593) was an Elizabethan playwright,
            poet, and contemporary of Shakespeare. His work combined sharp structure, craft, and a touch of intrigue—qualities
            we aspire to in building tools for responsible AI governance.
          </p>
          <p>
            Marlowe pioneered blank verse drama and influenced generations of writers. From <em>Doctor Faustus</em> to{' '}
            <em>The Jew of Malta</em>, his plays explore ambition, power, and the human condition—themes that resonate
            as we navigate the risks and opportunities of artificial intelligence.
          </p>
          <p className="text-sm">
            <span className="text-foreground font-medium">Marlowe</span> — bridging 16th-century literary innovation
            with 21st-century AI governance. Marlowe is a trademark of GallowGlass AI.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Famous Lines</CardTitle>
          <CardDescription>
            A few of Marlowe's enduring phrases
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {quotes.map((q) => (
              <blockquote key={q.source} className="flex gap-3 border-l-2 border-primary/50 pl-4 italic">
                <Quote className="h-5 w-5 text-primary/70 shrink-0 mt-0.5" />
                <div>
                  <p className="text-foreground">&ldquo;{q.text}&rdquo;</p>
                  <cite className="text-sm text-muted-foreground not-italic">— {q.source}</cite>
                </div>
              </blockquote>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Major Plays</CardTitle>
          <CardDescription>
            Read Marlowe's works (local copies and public domain sources)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {plays.map((play) => (
              <li key={play.title} className="flex flex-col gap-1">
                <a
                  href={play.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 font-medium text-primary hover:underline"
                >
                  {play.title}
                  <ExternalLink className="h-4 w-4 shrink-0" />
                </a>
                {play.subtitle && (
                  <span className="text-sm text-muted-foreground">{play.subtitle}</span>
                )}
                <p className="text-sm text-muted-foreground">{play.description}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        <Link to="/help" className="underline hover:text-foreground">
          Back to Help
        </Link>
        {' · '}
        <a
          href="https://en.wikipedia.org/wiki/Christopher_Marlowe"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Wikipedia: Christopher Marlowe
        </a>
      </p>
    </div>
  )
}
