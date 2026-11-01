import { cx } from '../utils/cx'
import React, { useEffect } from 'react'
import { MotionSection } from './CareMotion.jsx'
import { news, articlePath, photoCredits } from '../utils/landingNews.js'

export function NewsCard({ article, index, className, ...rest }) {
  return <article className={cx('news-card', className)} {...rest}><a href={articlePath(article)} className="news-card-link"><div className="news-photo"><img src={`/care/${article.image}`} alt="" loading="lazy" /><span>{String(index + 1).padStart(2, '0')} / 10</span></div><div className="news-card-copy"><div className="news-meta"><span>{article.archive ? 'From the archive' : article.category}</span><span>↗</span></div><h3>{article.title}</h3><p>{article.summary}</p><div className="news-byline"><span>{article.publisher}</span><span>Read brief <b aria-hidden="true">↗</b></span></div></div></a></article>
}

export function NewsSection({ Ribbon, ...rest }) {
  return <MotionSection id="news" className="news-section" aria-labelledby="news-title" {...rest}><div className="page-container news-heading"><div><p className="eyebrow">The care brief</p><h2 id="news-title" className="section-title">Small acts.<br /><em>Stories that matter.</em></h2></div><p className="section-description">Blood donation news from across the Philippines. The people, the drives, and the need that connects us.</p></div><Ribbon name="news stories">{news.map((article,index) => <NewsCard article={article} index={index} key={article.slug} />)}</Ribbon><p className="page-container news-footnote">2026 coverage + one 2021 archive · Attributed news briefs · Representative photography</p></MotionSection>
}

export function NewsArticle({ slug, ...rest }) {
  const index = news.findIndex(article => article.slug === slug)
  const article = news[index]
  useEffect(() => {
    document.title = article ? `${article.title} · Dugo+` : 'Story not found · Dugo+'
  }, [article])
  if (!article) return <main id="main-content" className="article-page page-container" {...rest}><h1>Story not found.</h1><a href="/#news" className="text-link">Return to the care brief →</a></main>
  const credit = photoCredits.find(photo => photo.file === article.image)
  const related = [news[(index + 1) % news.length], news[(index + 2) % news.length], news[(index + 3) % news.length]]
  return <main id="main-content" className="article-page" {...rest}><MotionSection className="article-intro page-container"><a href="/#news" className="article-back">← All stories</a><div className="article-labels"><span className="sample-badge">{article.category}</span>{article.archive && <span className="sample-badge">Archive · 2021</span>}</div><h1>{article.title}</h1><p className="article-deck">{article.summary}</p><div className="article-meta"><span>Dugo+ news brief</span><span>Source: {article.publisher}</span><span>{article.date}</span></div></MotionSection><MotionSection className="article-image page-container"><figure><img src={`/care/${article.image}`} alt="Representative medical or hospital photograph; not a photograph of the reported event" fetchPriority="high" /><figcaption>Representative photograph · <a href={credit.url} target="_blank" rel="noreferrer">{credit.name} / Unsplash ↗</a></figcaption></figure></MotionSection><MotionSection className="article-reading page-container"><aside><span className="eyebrow">In the community</span><p>A shared need.<br />A collective response.</p><a className="text-link" href="/#platform">Explore Dugo+ →</a></aside><div className="article-body"><h2>The story, in brief</h2>{article.paragraphs.map(p => <p key={p}>{p}</p>)}<div className="article-sources"><p className="eyebrow">Read at the source</p>{article.sources.map(([label,url]) => <a key={url} href={url} target="_blank" rel="noreferrer">{label}<span>↗</span></a>)}{article.sourceNote && <p className="source-note">{article.sourceNote}</p>}<p className="source-note">A Dugo+ summary of the linked coverage. The original publishers retain their reporting. Figures and events are tied to the dates above.</p></div><a href="/#news" className="text-link article-return">← Back to all stories</a></div></MotionSection><MotionSection className="related-section page-container"><div><p className="eyebrow">Keep the connection going</p><h2 className="section-title">More from <em>the care brief.</em></h2></div><div className="related-grid">{related.map(item => <NewsCard key={item.slug} article={item} index={news.indexOf(item)} />)}</div></MotionSection></main>
}
