import { describe, it, expect } from 'vitest'

import { emailPlainText, emailTextLength, sanitizeEmailHtml } from '../../src/lib/emailHtml'
import { renderEmailTemplate } from '../../src/lib/notifications'

// no database needed: hostile input for the member mail sanitiser
describe('email html hostile input', () => {
  it('drops raw elements with their content', () => {
    for (const tag of ['script', 'style', 'iframe', 'textarea', 'title', 'noscript'])
      expect(sanitizeEmailHtml(`<${tag}>alert(1)</${tag}><p>ok</p>`)).toBe('<p>ok</p>')
    expect(sanitizeEmailHtml('<svg><script>1</script></svg><img src=x onerror=alert(1)>')).toBe('')
  })

  it('strips event handlers, styles and unknown attributes', () => {
    expect(
      sanitizeEmailHtml(
        '<p onclick="x()" style="color:red" class="c">a</p><a href="https://y.test" onmouseover="x">b</a>',
      ),
    ).toBe('<p>a</p><p><a href="https://y.test/">b</a></p>')
  })

  it('unwraps links that are not http, https or mailto', () => {
    for (const href of [
      ' JaVaScRiPt:alert(1)',
      'java&#x09;script:alert(1)',
      '//evil.test',
      'data:text/html,x',
      'vbscript:x',
    ])
      expect(
        sanitizeEmailHtml(`<p><a href="${href}">x</a><a href="mailto:a@b.test">m</a></p>`),
      ).toBe('<p>x<a href="mailto:a@b.test">m</a></p>')
  })

  it('balances nested and unbalanced tags', () => {
    expect(sanitizeEmailHtml('<p>a<strong>b<em>c</p>d</em></strong>')).toBe(
      '<p>a<strong>b<em>c</em></strong></p><p>d</p>',
    )
    expect(sanitizeEmailHtml('</em></ul>text')).toBe('<p>text</p>')
  })

  it('never turns entities into markup', () => {
    const html = sanitizeEmailHtml('&#x3C;script&#x3E;alert(1)&#x3C;/script&#x3E;')
    expect(html).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
    expect(emailPlainText(html)).toBe('<script>alert(1)</script>')
  })

  it('keeps benign formatting as before', () => {
    const html =
      '<h2>Title</h2><p>One<br>two</p><blockquote><p>q</p></blockquote><ol><li>x</li></ol>'
    expect(sanitizeEmailHtml(html)).toBe(
      '<h2>Title</h2><p>One<br />two</p><blockquote><p>q</p></blockquote><ol><li>x</li></ol>',
    )
    expect(sanitizeEmailHtml('<div>Hi <i>there</i></div><br><br><br><br>')).toBe(
      '<p>Hi <em>there</em></p><br /><br />',
    )
  })

  it('puts a stray top-level list item in a list, not a paragraph', () => {
    expect(sanitizeEmailHtml('<li>a</li><li>b</li>tail')).toBe(
      '<ul><li>a</li><li>b</li></ul><p>tail</p>',
    )
    expect(sanitizeEmailHtml('x<li>a</li>')).toBe('<p>x</p><ul><li>a</li></ul>')
  })

  it('counts real text only, not list or quote markers', () => {
    const html = '<ul><li>a</li><li>b</li></ul><ol><li>c</li></ol><blockquote><p>d</p></blockquote>'
    expect(emailPlainText(html).length).toBeGreaterThanOrEqual(12)
    expect(emailTextLength(html)).toBe(7)
    expect(emailTextLength('<p>The call moves to Thursday.</p>')).toBe(27)
    // bare markers as the only content still count as nothing
    expect(emailTextLength('<ul><li>*</li><li>1.</li></ul>')).toBe(0)
  })

  it('renders templates with escaped values and safe links only', async () => {
    const { html, text } = await renderEmailTemplate(
      'membership-activated',
      {
        firstName: '<b>Ana</b>',
        actionUrl: 'javascript:alert(1)',
        socialLinks: [
          { label: 'Bad', url: 'javascript:1' },
          { label: 'Ok', url: 'https://ok.test' },
        ],
      },
      { unsubscribeUrl: 'https://hub.test/u?t=a.b' },
    )
    expect(html).toContain('&lt;b&gt;Ana&lt;/b&gt;, you are in')
    expect(html).not.toMatch(/javascript:/i)
    expect(text).not.toMatch(/javascript:/i)
    expect(html).toContain('href="https://ok.test/"')
    expect(html).toContain('Unsubscribe from this category')
    expect(text).toContain('Unsubscribe from this category: https://hub.test/u?t=a.b')
  })
})
