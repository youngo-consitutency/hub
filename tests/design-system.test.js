import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const child = new URL(
        `${entry.name}${entry.isDirectory() ? '/' : ''}`,
        directory,
      )
      return entry.isDirectory() ? sourceFiles(child) : [child]
    }),
  )
  return files.flat().filter((file) => /\.[cm]?[jt]sx?$/.test(file.pathname))
}

function luminance(hex) {
  const channels = hex
    .match(/[a-f\d]{2}/gi)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    )
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function contrast(foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background))
  const darker = Math.min(luminance(foreground), luminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

test('component styles use the shared colour tokens', async () => {
  const directory = new URL('../src/styles/parts/', import.meta.url)
  const files = (await readdir(directory)).filter((file) =>
    file.endsWith('.css'),
  )
  const rawColour = /#[\da-f]{3,8}\b|rgba?\(/i

  for (const file of files) {
    const css = await read(`src/styles/parts/${file}`)
    assert.equal(rawColour.test(css), false, `${file} contains a raw colour`)
  }
})

test('primary action colours meet WCAG AA contrast for text', async () => {
  const css = await read('src/styles/tokens.css')
  const accent = css.match(/--accent:\s*(#[\da-f]{6})/i)?.[1]
  const onAccent = css.match(/--on-accent:\s*(#[\da-f]{6})/i)?.[1]

  assert.ok(accent && onAccent, 'primary action tokens must be defined')
  assert.ok(
    contrast(accent, onAccent) >= 4.5,
    'primary action contrast must be at least 4.5:1',
  )
})

test('access gates use document scrolling and popovers stay out of layout flow', async () => {
  const css = await read('src/styles/parts/gates.css')
  const gateRule = css.match(/\.mandateGate\s*{([^}]+)}/)?.[1] || ''
  const menuRule = css.match(/\.comboMenu\s*{([^}]+)}/)?.[1] || ''

  assert.match(gateRule, /position:\s*relative/)
  assert.match(gateRule, /overflow:\s*visible/)
  assert.doesNotMatch(gateRule, /overflow-y:\s*auto/)
  assert.match(menuRule, /position:\s*absolute/)
})

test('labelled sections clear any preceding page block', async () => {
  const css = await read('src/styles/parts/layout.css')
  const sectionSpacing = css.match(
    /\.section:not\(:first-child\)\s*{([^}]+)}/,
  )?.[1]

  assert.match(sectionSpacing || '', /margin-top:\s*var\(--section-gap\)/)
  assert.doesNotMatch(css, /\.section\s*\+\s*\.section\s*{/)
})

test('the UI uses the operating system font stack', async () => {
  const [entry, manifest, tokens] = await Promise.all([
    read('src/main.jsx'),
    read('package.json'),
    read('src/styles/tokens.css'),
  ])

  assert.doesNotMatch(entry, /@fontsource/)
  assert.doesNotMatch(manifest, /@fontsource/)
  assert.match(tokens, /--font-ui:\s*\n?\s*system-ui/)
})

test('the Hub and constituency use the correct brand lockups', async () => {
  const [brand, publicSite] = await Promise.all([
    read('src/components/Brand.jsx'),
    read('src/pages/site/PublicSite.jsx'),
  ])

  assert.match(brand, /youngo-hub-logo\.png/)
  assert.match(brand, /youngo-logo\.png/)
  assert.match(brand, /data-brand=/)
  assert.doesNotMatch(brand, /className="brandHub"/)
  assert.match(publicSite, /<Brand constituencyOnly \/>/)
})

test('catalog controls keep expanded filters below search and sort', async () => {
  const css = await read('src/styles/parts/layout.css')
  const popover = css.match(/(?:^|\n)\.filterMenuPanel\s*{([^}]+)}/)?.[1] || ''
  const searchRow = css.match(/\.catalogSearchRow\s*{([^}]+)}/)?.[1] || ''

  assert.match(popover, /position:\s*static/)
  assert.match(popover, /width:\s*fit-content/)
  assert.match(popover, /padding:\s*0/)
  assert.match(searchRow, /grid-template-columns:\s*minmax\(0, 1fr\) auto/)
  assert.doesNotMatch(css, /\.sortControlLabel/)
  assert.match(
    css,
    /\.catalogFilterRow \.filterMenuPanel\s*{[\s\S]*?width:\s*fit-content/,
  )
  assert.match(
    css,
    /\.catalogTools\s*{[\s\S]*?margin-bottom:\s*var\(--space-2\)/,
  )
  assert.doesNotMatch(css, /\.resultsSummary/)
})

test('region filters use abbreviations instead of repeated pin icons', async () => {
  const [ui, coys, opportunities, layout] = await Promise.all([
    read('src/components/ui.jsx'),
    read('src/pages/Coys.jsx'),
    read('src/pages/Opportunities.jsx'),
    read('src/styles/parts/layout.css'),
  ])

  assert.match(ui, /className="pillPrefix"/)
  assert.match(
    coys,
    /prefix={[\s\S]*?regionFilterPrefix\(item\.key, item\.label\)/,
  )
  assert.match(opportunities, /prefix={regionFilterPrefix\(region\)}/)
  assert.doesNotMatch(coys, /item\.key === 'all' \? Map : MapPin/)
  assert.doesNotMatch(
    opportunities,
    /state={regionFilters\[region\][\s\S]*?icon={MapPin}/,
  )
  assert.match(layout, /\.pillPrefix\s*{[^}]*font-weight:\s*750/)
})

test('catalogue card tags control the same filters shown above the grid', async () => {
  const [ui, cards, groups, coys, council, opportunities, submissions] =
    await Promise.all([
      read('src/components/ui.jsx'),
      read('src/components/cards.jsx'),
      read('src/pages/Groups.jsx'),
      read('src/pages/Coys.jsx'),
      read('src/pages/Council.jsx'),
      read('src/pages/Opportunities.jsx'),
      read('src/pages/Submissions.jsx'),
    ])

  assert.match(ui, /export function FilterChip/)
  assert.match(ui, /className={`chip chip-\$\{tone\} cardFilterChip/)
  assert.match(ui, /icon: Icon,[\s\S]*?className="chipPrefix"/)
  assert.match(cards, /workingGroupTopic\(group\.slug\)/)
  assert.match(cards, /className="entityCardLinkOverlay"/)
  assert.match(groups, /workingGroupTopic\(group\.slug\)\?\.label/)
  assert.doesNotMatch(groups, /\.\.\.\(group\.tags \|\| \[\]\)/)
  assert.match(groups, /onTopicFilter=/)
  assert.match(coys, /onTypeFilter=/)
  assert.match(coys, /onRegionFilter=/)
  assert.match(council, /onStatusFilter=/)
  assert.match(opportunities, /onKindFilter=/)
  assert.match(opportunities, /onFormatFilter=/)
  assert.match(opportunities, /onRegionFilter=/)
  assert.match(submissions, /onStatusFilter=/)
  assert.match(submissions, /onGroupFilter=/)
  assert.match(cards, /icon={workingGroupIcon\(sub\.wg\.slug\)}/)
  assert.match(cards, /prefix={regionFilterPrefix\(coy\.region/)
  assert.match(opportunities, /icon={KIND_ICON\[item\.kind\]}/)
  assert.match(opportunities, /icon={FORMAT_ICON\[item\.format\]}/)
  assert.match(opportunities, /prefix={regionFilterPrefix\(item\.region\)}/)
})

test('catalogues omit global totals and grouped totals sit beside their headings', async () => {
  const [ui, layout, opportunities, ...catalogues] = await Promise.all([
    read('src/components/ui.jsx'),
    read('src/styles/parts/layout.css'),
    read('src/pages/Opportunities.jsx'),
    read('src/pages/Groups.jsx'),
    read('src/pages/Coys.jsx'),
    read('src/pages/Council.jsx'),
    read('src/pages/Submissions.jsx'),
    read('src/pages/Directory.jsx'),
  ])

  assert.match(
    ui,
    /export function Section\(\{ label, meta, action, children \}\)/,
  )
  assert.match(ui, /sectionHeadingMeta/)
  assert.match(layout, /\.sectionHeadingMeta\s*{/)
  assert.doesNotMatch(layout, /\.resultsSummary/)
  assert.match(
    opportunities,
    /label="Open"[\s\S]*?meta={`\$\{groupedItems\.open\.length\}/,
  )
  assert.match(
    opportunities,
    /label="Closed"[\s\S]*?meta={`\$\{groupedItems\.closed\.length\}/,
  )
  assert.doesNotMatch(opportunities, /action={`\$\{groupedItems\./)

  for (const catalogue of [opportunities, ...catalogues]) {
    assert.doesNotMatch(catalogue, /resultsSummary/)
    assert.doesNotMatch(catalogue, /\}\s+of\s+\{/)
  }
})

test('mobile navigation keeps the full menu in the top bar and quick routes in the bottom bar', async () => {
  const shell = await read('src/components/Shell.jsx')

  assert.match(shell, /className={`btn btn-ghost btn-sm mobileMenuButton/)
  assert.match(shell, /id="mobile-navigation"/)
  assert.match(shell, /className="sheetSearch"/)
  assert.doesNotMatch(shell, /ThemeToggle/)
  assert.doesNotMatch(shell, /⌘K/)
  assert.match(shell, /className="navItem sidebarSearch"/)
  assert.match(shell, /aria-modal="true"/)
  assert.match(shell, /menuButtonRef\.current\?\.focus\(\)/)
  assert.match(
    shell,
    /<main[\s\S]*?inert={sheet \? true : undefined}[\s\S]*?aria-hidden={sheet \? 'true' : undefined}/,
  )
  assert.doesNotMatch(
    shell,
    /<div[\s\S]{0,120}?className="content"[\s\S]{0,120}?inert=/,
  )
  assert.doesNotMatch(shell, /className="tabbar"/)
  assert.match(
    shell,
    /href: '\/calendar'[\s\S]*?href: '\/opportunities'[\s\S]*?href: '\/'[\s\S]*?href: '\/groups'[\s\S]*?href: '\/profile'/,
  )
  assert.match(shell, /mobileLabel: 'Calls'/)
  assert.doesNotMatch(shell, /<span>Menu<\/span>/)
  assert.doesNotMatch(shell, /TbDots as MoreHorizontal/)
})

test('science resources share the Hub catalogue and public-site language', async () => {
  const [hub, resources, publicSite, siteResources, siteGys, shell] =
    await Promise.all([
      read('src/components/ResourceHub.jsx'),
      read('src/pages/Resources.jsx'),
      read('src/pages/site/PublicSite.jsx'),
      read('src/pages/site/SiteResources.jsx'),
      read('src/pages/site/SiteGys.jsx'),
      read('src/components/Shell.jsx'),
    ])

  assert.match(hub, /ResourceCatalogue/)
  assert.match(hub, /FilterPill/)
  assert.match(hub, /FilterChip/)
  assert.match(hub, /Send for review/)
  assert.match(resources, /ResourceSubmissionPanel/)
  assert.match(publicSite, /\/about\/resources/)
  assert.match(publicSite, /\/about\/gys/)
  assert.match(siteResources, /Public catalogue/)
  assert.match(siteGys, /From local input to global advocacy/)
  assert.match(shell, /Science resources/)
})

test('mobile catalogue filters stay in compact horizontally scrollable rows', async () => {
  const layout = await read('src/styles/parts/layout.css')

  assert.match(
    layout,
    /@media \(max-width: 620px\)[\s\S]*?\.filterMenuPanel \.pillRow\s*{[\s\S]*?flex-wrap:\s*nowrap[\s\S]*?overflow-x:\s*auto/,
  )
  assert.match(
    layout,
    /@media \(max-width: 620px\)[\s\S]*?\.sortControl\s*{[\s\S]*?justify-self:\s*start[\s\S]*?width:\s*max-content/,
  )
})

test('admins compose device alerts from the Admin page', async () => {
  const [admin, composer] = await Promise.all([
    read('src/pages/Admin.jsx'),
    read('src/components/PushBroadcast.jsx'),
  ])
  assert.match(admin, /<PushBroadcast \/>/)
  assert.match(composer, /label="Device alerts"/)
  assert.match(composer, /apiPost\('\/push\/send'/)
  assert.match(composer, /Everyone with alerts on/)
  assert.match(composer, /ALL_CONFIRM = 'SEND'/)
})

test('notification settings start with the device alert heading', async () => {
  const [component, css] = await Promise.all([
    read('src/components/NotificationSettings.jsx'),
    read('src/styles/parts/pages.css'),
  ])

  assert.match(component, /<h2>Alerts on this device<\/h2>/)
  assert.doesNotMatch(component, />Notifications<\/h2>/)
  assert.doesNotMatch(css, /\.notificationTitleRow/)
  assert.match(
    css,
    /\.notificationStatusActions\s*{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1;/,
  )
})

test('install and alert setup is offered on every member page, not only Profile', async () => {
  const [shell, settings, help, guide] = await Promise.all([
    read('src/components/Shell.jsx'),
    read('src/components/NotificationSettings.jsx'),
    read('src/pages/Help.jsx'),
    read('src/components/NotificationGuide.jsx'),
  ])
  assert.match(shell, /<AlertSetupNotice \/>/)
  assert.match(settings, /id="alerts"/)
  assert.match(settings, /notificationInstallSteps/)
  assert.match(settings, /Show me where to tap/)
  assert.match(help, /href: '\/profile#alerts'/)
  assert.match(guide, /Add to Home Screen/)
})

test('Help and support is the only global support launcher', async () => {
  const [shell, help, connect, pages] = await Promise.all([
    read('src/components/Shell.jsx'),
    read('src/pages/Help.jsx'),
    read('src/content/connect.js'),
    read('src/styles/parts/pages.css'),
  ])

  assert.doesNotMatch(shell, /FeedbackButton/)
  assert.match(shell, /href="\/help"/)
  assert.match(help, /<FeedbackButton mode="menu" label="Report an issue"/)
  assert.match(help, /className="helpActionGrid"/)
  assert.match(help, /className="card helpDestinationGrid"/)
  assert.match(help, /className="helpPeopleGrid"/)
  assert.doesNotMatch(help, /Contributor log|BETA_CONTRIBUTORS|GUIDE\.map/)
  assert.match(
    connect,
    /name: 'Jaloliddin Ismailov',[\s\S]*?focus: 'Product, engineering, policy & governance'/,
  )
  assert.match(connect, /name: 'Genaro Matías Godoy González'/)
  assert.doesNotMatch(connect, /Genn|Imran Shaik|Leticia|BETA_CONTRIBUTORS/)
  assert.match(
    pages,
    /\.helpActionCard\s*{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\) auto;[^}]*align-items:\s*center;/,
  )
  assert.match(
    pages,
    /@media \(max-width:\s*700px\)[\s\S]*?\.helpDestinationGrid\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/,
  )
})

test('shared mobile primitives shrink and wrap safely at narrow widths', async () => {
  const [cards, layout, pages, overlays] = await Promise.all([
    read('src/styles/parts/cards.css'),
    read('src/styles/parts/layout.css'),
    read('src/styles/parts/pages.css'),
    read('src/styles/parts/overlays.css'),
  ])

  assert.match(cards, /\.card\s*{[\s\S]*?min-width:\s*0/)
  assert.match(
    cards,
    /@media \(max-width: 560px\)[\s\S]*?\.btn\s*{[\s\S]*?white-space:\s*normal/,
  )
  assert.match(layout, /\.cardGrid > \*[\s\S]*?min-width:\s*0/)
  assert.match(
    pages,
    /@media \(max-width: 380px\)[\s\S]*?\.notificationCard\s*{[\s\S]*?grid-template-columns:\s*1fr/,
  )
  assert.match(overlays, /\.paletteInput\s*{[\s\S]*?min-width:\s*0/)
})

test('the member overview loads workspaces from the authenticated adapter', async () => {
  const home = await read('src/pages/Home.jsx')

  assert.match(home, /useApi\('\/member\/workspace'\)/)
  assert.doesNotMatch(home, /useApi\('\/workspace'\)/)
})

test('each repeated-card grid shares one card height without a global fixed height', async () => {
  const [cards, layout, pages, shell, tokens] = await Promise.all([
    read('src/styles/parts/cards.css'),
    read('src/styles/parts/layout.css'),
    read('src/styles/parts/pages.css'),
    read('src/styles/parts/shell.css'),
    read('src/styles/tokens.css'),
  ])

  assert.match(tokens, /--catalog-card-max:\s*320px/)
  assert.doesNotMatch(tokens, /--catalog-card-min-height/)
  assert.match(cards, /\.entityCard,[\s\S]*?height:\s*auto/)
  assert.match(cards, /\.entityCard,[\s\S]*?align-content:\s*start/)
  assert.doesNotMatch(cards, /grid-template-rows:\s*minmax\(66px/)
  assert.match(layout, /\.cardGrid\s*{[\s\S]*?var\(--catalog-columns\)/)
  assert.match(layout, /minmax\(0, var\(--catalog-card-max\)\)/)
  assert.match(layout, /justify-content:\s*start/)
  assert.match(
    layout,
    /\.cardGrid\s*{[\s\S]*?grid-auto-rows:\s*1fr[\s\S]*?align-items:\s*stretch/,
  )
  assert.match(layout, /\.cardGrid > \.card\s*{[\s\S]*?height:\s*100%/)
  assert.match(
    shell,
    /\.directoryContacts\s*{[\s\S]*?grid-auto-rows:\s*1fr[\s\S]*?align-items:\s*stretch/,
  )
  assert.match(
    shell,
    /\.peopleGrid\s*{[\s\S]*?grid-auto-rows:\s*1fr[\s\S]*?align-items:\s*stretch/,
  )
  assert.match(
    pages,
    /\.dashboardCardGrid\s*{[\s\S]*?grid-auto-rows:\s*1fr[\s\S]*?align-items:\s*stretch/,
  )
})

test('COY and group cards use compact content-sized tracks at every width', async () => {
  const [cards, components] = await Promise.all([
    read('src/styles/parts/cards.css'),
    read('src/components/cards.jsx'),
  ])
  const coyCard = cards.match(/\.entityCard\.coyCard\s*{([^}]+)}/)?.[1] || ''
  const groupCard = cards.match(/\.groupCard\s*{([^}]+)}/)?.[1] || ''

  assert.match(coyCard, /grid-template-rows:\s*auto auto/)
  assert.match(coyCard, /align-content:\s*start/)
  assert.doesNotMatch(coyCard, /minmax\(/)
  assert.match(groupCard, /grid-auto-rows:\s*auto/)
  assert.match(groupCard, /gap:\s*var\(--space-2\)/)
  assert.match(groupCard, /align-content:\s*start/)
  assert.doesNotMatch(groupCard, /minmax\(/)
  assert.match(components, /className="card cardTight groupCard entityCard"/)
  assert.doesNotMatch(
    components,
    /group\.tags\?\.map\(\(tag\)[\s\S]*?chip-neutral/,
  )
})

test('working-group resources gate member links and keep open media visible', async () => {
  const [page, links, cardsCss, pagesCss, categories, publicRoute] =
    await Promise.all([
      read('src/pages/GroupDetail.jsx'),
      read('src/components/DestinationLink.jsx'),
      read('src/styles/parts/cards.css'),
      read('src/styles/parts/pages.css'),
      read('shared/resourceCategories.js'),
      read('server/routes/public.js'),
    ])

  assert.match(page, /className="section groupResourcesSection"/)
  assert.match(page, /<h2 className="srOnly"/)
  assert.match(page, /<ExternalResourceRow/)
  assert.match(page, /groupResourcesByCategory\(resources\)/)
  assert.match(page, /resources\.filter\(isPublicGroupResource\)/)
  assert.match(page, /groupResourceGroups.*isSingle/)
  assert.match(page, /className="groupResourceColumn"/)
  assert.match(page, /title="Member resources"/)
  assert.match(page, /Unlock the workspace to see join links/)
  assert.match(page, /Unlock to see/)
  assert.match(categories, /label: 'Join'/)
  assert.match(categories, /label: 'Channels'/)
  assert.match(categories, /label: 'Working files'/)
  assert.match(categories, /label: 'Reference'/)
  assert.match(links, /host\.endsWith\('instagram\.com'\).*TbBrandInstagram/)
  assert.match(links, /host\.endsWith\('linkedin\.com'\).*TbBrandLinkedin/)
  assert.match(links, /host\.endsWith\('whatsapp\.com'\).*TbBrandWhatsapp/)
  assert.doesNotMatch(links, /react-icons\/(?:fa|si|ri|vsc)/)
  assert.doesNotMatch(page, /r\.description/)
  assert.match(categories, /export function isPublicGroupResource/)
  assert.match(publicRoute, /getWgProgress/)
  assert.match(publicRoute, /includeWorkspace/)
  assert.match(
    cardsCss,
    /\.resourceRow\.destinationResourceRow\s*{[\s\S]*?grid-template-columns:\s*20px minmax\(0, 1fr\) auto 16px/,
  )
  assert.match(
    pagesCss,
    /\.groupResourceGroups\s*{[^}]*grid-template-columns:\s*repeat\(2,/s,
  )
  assert.match(
    pagesCss,
    /@media \(max-width:\s*900px\)[\s\S]*?\.groupResourceGroups\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/,
  )
  assert.match(page, /<Empty[\s\S]*?icon={Lock}[\s\S]*?cta=/)
  assert.doesNotMatch(pagesCss, /\.groupResourcesLocked/)
  assert.doesNotMatch(pagesCss, /\.groupActivityGrid\s*{/)
})

test('lifecycle status and deadlines use one shared compact primitive', async () => {
  const [ui, cards, cardsCss, opportunities, submissionDetail, decisionDetail] =
    await Promise.all([
      read('src/components/ui.jsx'),
      read('src/components/cards.jsx'),
      read('src/styles/parts/cards.css'),
      read('src/pages/Opportunities.jsx'),
      read('src/pages/SubmissionDetail.jsx'),
      read('src/pages/DecisionDetail.jsx'),
    ])

  assert.match(ui, /export function LifecycleTiming/)
  assert.match(ui, /<StatusChip[\s\S]*?<time dateTime={iso}>/)
  assert.match(cardsCss, /\.lifecycleTiming\s*{[^}]*flex-wrap:\s*wrap/s)
  assert.match(cards, /<LifecycleTiming[\s\S]*?status={sub\.status}/)
  assert.match(cards, /<LifecycleTiming status={item\.status}/)
  assert.match(cards, /status={decision\.status}/)
  assert.match(opportunities, /<LifecycleTiming iso={item\.deadlineAt}/)
  assert.match(submissionDetail, /className="detailLifecycleTiming"/)
  assert.match(decisionDetail, /className="detailLifecycleTiming"/)
  assert.doesNotMatch(cards, /CountdownChip/)
})

test('detail access panels keep one primary action and reflow by content width', async () => {
  const [groupDetail, workspace, pagesCss] = await Promise.all([
    read('src/pages/GroupDetail.jsx'),
    read('src/pages/Workspace.jsx'),
    read('src/styles/parts/pages.css'),
  ])

  const overviewActions =
    groupDetail.match(
      /<div className="detailActions groupOverviewActions">([\s\S]*?)<\/div>/,
    )?.[1] || ''

  assert.match(overviewActions, /Open workspace/)
  assert.doesNotMatch(overviewActions, /whatsappUrl|groupUrl|driveUrl/)
  assert.match(workspace, /group\.whatsappUrl/)
  assert.match(
    pagesCss,
    /\.detailPage\s*{[^}]*container:\s*detail-page\s*\/\s*inline-size/s,
  )
  assert.match(
    pagesCss,
    /@container detail-page \(max-width:\s*560px\)[\s\S]*?\.detailActionPanel,[\s\S]*?\.groupOverview\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/,
  )
  assert.doesNotMatch(
    pagesCss,
    /@container detail-page \(max-width:\s*900px\)[\s\S]*?\.groupOverview,[\s\S]*?grid-template-columns:\s*1fr/,
  )
})

test('page headers use one title and detail actions stay compact on the right', async () => {
  const [ui, pagesCss, files] = await Promise.all([
    read('src/components/ui.jsx'),
    read('src/styles/parts/pages.css'),
    sourceFiles(new URL('../src/', import.meta.url)),
  ])

  assert.match(
    ui,
    /export function PageHeader\(\{ title, description, action, children \}\)/,
  )
  assert.doesNotMatch(ui, /eyebrow &&|PageHeader\(\{ eyebrow/)

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    assert.doesNotMatch(source, /\beyebrow=/)
  }

  assert.match(
    pagesCss,
    /\.detailPage \.detailActions:has\(> :nth-child\(2\)\)\s*{[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?justify-content:\s*flex-end;[\s\S]*?width:\s*fit-content;[\s\S]*?max-width:\s*min\(100%, 390px\)/,
  )
  assert.match(
    pagesCss,
    /\.detailPage \.detailActions:has\(> :nth-child\(2\)\) > \*\s*{[^}]*width:\s*auto;/,
  )
  assert.doesNotMatch(
    pagesCss,
    /\.detailPage \.detailActions:has\(> :nth-child\(2\)\)\s*{[^}]*grid-template-columns:/,
  )
  assert.match(
    pagesCss,
    /\.detailSummary\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto;[^}]*align-items:\s*start;/,
  )
  assert.match(
    pagesCss,
    /\.detailOverviewCard\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 390px\);/,
  )
  assert.match(
    pagesCss,
    /@container detail-page \(max-width:\s*560px\)\s*{[\s\S]*?\.detailSummary,[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/,
  )
  assert.doesNotMatch(
    pagesCss,
    /@container detail-page \(max-width:\s*900px\)\s*{\s*\.detailSummary,/,
  )
  assert.match(
    pagesCss,
    /\.detailOverviewCard \.detailActions\s*{[^}]*justify-content:\s*flex-end;[^}]*justify-self:\s*end;/,
  )
})

test('back navigation is explicit and visually prominent', async () => {
  const [ui, pagesCss, forgotPassword, course, cpManage] = await Promise.all([
    read('src/components/ui.jsx'),
    read('src/styles/parts/pages.css'),
    read('src/components/auth/ForgotPasswordForm.jsx'),
    read('src/pages/Course.jsx'),
    read('src/pages/CpManage.jsx'),
  ])

  assert.match(ui, /<span>Back to \{children\}<\/span>/)
  assert.match(ui, /<ArrowLeft size=\{18\} strokeWidth=\{2\}/)
  assert.match(
    pagesCss,
    /\.backLink\s*{[^}]*min-height:\s*40px;[^}]*border:\s*1px solid var\(--border-strong\);[^}]*background:\s*var\(--bg-card\);[^}]*font-weight:\s*600;/,
  )
  assert.match(forgotPassword, /variant="secondary"[\s\S]*?Back to sign in/)
  assert.match(course, /variant="secondary"[\s\S]*?Back to modules/)
  assert.match(cpManage, /<BackLink href="\/cp">all WG consoles<\/BackLink>/)
})

test('Council decisions use one combined chronological timeline', async () => {
  const [decision, css] = await Promise.all([
    read('src/pages/DecisionDetail.jsx'),
    read('src/styles/parts/pages.css'),
  ])

  assert.match(decision, /className="decisionTimeline"/)
  assert.match(decision, /STEPS\.map\(\(step, index\)/)
  assert.match(decision, /processEntry\(d\.statusLog, index\)/)
  assert.match(
    decision,
    /aria-current={[\s\S]*?state === 'current' \? 'step' : undefined[\s\S]*?}/,
  )
  assert.doesNotMatch(
    decision,
    /<Timeline|detailProcessActivity|<h3>Activity<\/h3>/,
  )
  assert.match(css, /\.decisionTimelineStep\.current \.decisionTimelineMarker/)
  assert.doesNotMatch(css, /\.detailProcessActivity|\.statusLog|\.logRow/)
})

test('binary catalogue views use one joined segmented control', async () => {
  const [council, submissions, css] = await Promise.all([
    read('src/pages/Council.jsx'),
    read('src/pages/Submissions.jsx'),
    read('src/styles/parts/layout.css'),
  ])

  assert.match(council, /TbClock as Clock/)
  assert.match(
    council,
    /className="viewSwitch" role="group" aria-label="Council view"/,
  )
  assert.match(council, /icon={Clock}[\s\S]*?In progress/)
  assert.match(
    submissions,
    /className="viewSwitch" role="group" aria-label="Submission view"/,
  )
  assert.match(css, /\.viewSwitch\s*{[^}]*gap:\s*0;[^}]*padding:\s*0;/)
  assert.match(css, /\.viewSwitch \.pill \+ \.pill\s*{[^}]*border-left:/)
  assert.match(
    css,
    /\.viewSwitch \.pill\.active\s*{[^}]*background:\s*var\(--accent-tint\);[^}]*box-shadow:\s*none;/,
  )
})

test('the Hub uses one Tabler icon family', async () => {
  const files = await sourceFiles(new URL('../src/', import.meta.url))
  const packageJson = await read('package.json')

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    assert.doesNotMatch(source, /from ['"]lucide-react['"]/)
    assert.doesNotMatch(source, /from ['"]react-icons\/(?!tb['"])/)
  }

  assert.match(packageJson, /"react-icons"/)
  assert.doesNotMatch(packageJson, /"lucide-react"/)
})

test('navigable entity cards use semantic corner icons', async () => {
  const [cards, cardsCss, submissions, search, workingGroupIcons] =
    await Promise.all([
      read('src/components/cards.jsx'),
      read('src/styles/parts/cards.css'),
      read('src/pages/Submissions.jsx'),
      read('src/pages/Search.jsx'),
      read('src/lib/workingGroupIcons.js'),
    ])

  assert.match(cards, /className="cardCornerIcon entityCardCornerIcon"/)
  assert.match(cards, /icon={EventIcon}/)
  assert.match(cards, /icon={SubmissionIcon}/)
  assert.match(cards, /icon={Gavel}/)
  assert.match(cards, /icon={CoyIcon}/)
  assert.match(cardsCss, /\.cardCornerIcon\s*{[^}]*color:\s*var\(--accent\)/)
  assert.match(submissions, /icon={workingGroupIcon\(item\.slug\)}/)
  assert.match(search, /className="cardCornerIcon searchResultIcon"/)
  assert.match(workingGroupIcons, /export function workingGroupIcon\(slug\)/)
  assert.doesNotMatch(workingGroupIcons, /react-icons\/(?!tb['"])/)
})

test('recognition tiers use aligned progression cards with responsive arrows', async () => {
  const [recognition, layoutCss] = await Promise.all([
    read('src/pages/Recognition.jsx'),
    read('src/styles/parts/layout.css'),
  ])

  assert.match(recognition, /TbArrowRight as ArrowRight/)
  assert.match(recognition, /className="recognitionTierTopline"/)
  assert.match(recognition, /className="recognitionTierArrow"/)
  assert.match(
    layoutCss,
    /\.recognitionLadder\s*{[^}]*grid-auto-rows:\s*1fr;[^}]*gap:\s*32px;/,
  )
  assert.match(
    layoutCss,
    /\.recognitionTierArrow\s*{[^}]*left:\s*calc\(100% \+ 7px\);[^}]*transform:\s*translateY\(-50%\);/,
  )
  assert.match(
    layoutCss,
    /@media \(max-width:\s*560px\)[\s\S]*?\.recognitionTierArrow\s*{[^}]*transform:\s*translateX\(-50%\) rotate\(90deg\);/,
  )
})

test('detail summaries stay compact when they have no actions', async () => {
  const [coyDetail, eventDetail, pagesCss] = await Promise.all([
    read('src/pages/CoyDetail.jsx'),
    read('src/pages/EventDetail.jsx'),
    read('src/styles/parts/pages.css'),
  ])

  assert.match(coyDetail, /card detailSummary coyDetailOverview/)
  assert.match(coyDetail, /className="coyDetailHeader"/)
  assert.match(coyDetail, /className="detailMetaLabel">Status/)
  assert.match(coyDetail, /const hasActions = Boolean/)
  assert.match(coyDetail, /\{hasActions && \(/)
  assert.match(eventDetail, /card detailSummary detailOverviewCard/)
  assert.match(
    pagesCss,
    /\.detailSummary:not\(:has\(> \.detailActions\)\)\s*{[^}]*width:\s*fit-content;[^}]*max-width:\s*100%;/,
  )
  assert.match(
    pagesCss,
    /@container detail-page \(max-width:\s*560px\)[\s\S]*?\.coyDetailFacts\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/,
  )
  assert.match(
    pagesCss,
    /\.coyDetailHeader\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto;/,
  )
  assert.match(pagesCss, /\.coyDetailOverview\s*{[^}]*justify-self:\s*end;/)
  assert.match(
    pagesCss,
    /@container detail-page \(max-width:\s*900px\)[\s\S]*?\.coyDetailHeader\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/,
  )
})

test('resource and social surfaces share destination-aware icons', async () => {
  const [
    statement,
    contact,
    footer,
    calendar,
    submission,
    decision,
    opportunities,
  ] = await Promise.all([
    read('src/pages/Statement.jsx'),
    read('src/pages/site/SiteContact.jsx'),
    read('src/pages/site/PublicSite.jsx'),
    read('src/components/AddToCalendar.jsx'),
    read('src/pages/SubmissionDetail.jsx'),
    read('src/pages/DecisionDetail.jsx'),
    read('src/pages/Opportunities.jsx'),
  ])

  assert.match(statement, /<DestinationIcon[\s\S]*?url={link\.url}/)
  assert.match(contact, /<DestinationIcon url={link\.url}/)
  assert.match(footer, /<DestinationIcon url={link\.url}/)
  assert.match(calendar, /DestinationIcon url={googleCalendarUrl\(event\)}/)
  assert.match(calendar, /DestinationIcon url={outlookWebUrl\(event\)}/)
  assert.match(submission, /DestinationIcon url={sub\.draftUrl}/)
  assert.match(decision, /DestinationIcon url={d\.proposalUrl}/)
  assert.match(opportunities, /DestinationIcon url={item\.linkUrl}/)
})

test('registration cards keep their headings and choices text-only', async () => {
  const [gate, individual, organisation, shared, css] = await Promise.all([
    read('src/components/AuthGate.jsx'),
    read('src/components/auth/RegisterIndividualForm.jsx'),
    read('src/components/auth/RegisterOrgForm.jsx'),
    read('src/components/auth/shared.jsx'),
    read('src/styles/parts/gates.css'),
  ])

  assert.match(
    gate,
    /<h2 className="authSectionTitle">Who is registering\? \*<\/h2>/,
  )
  assert.match(
    individual,
    /<h2 className="authSectionTitle">Individual registration<\/h2>/,
  )
  assert.match(
    organisation,
    /<h2 className="authSectionTitle">Organisation registration<\/h2>/,
  )
  assert.match(
    shared,
    /<h2 className="authSectionTitle">Your data and your consent \*<\/h2>/,
  )
  assert.doesNotMatch(gate, /authChoiceIdentityIcon|AuthSectionTitle/)
  assert.doesNotMatch(individual, /AuthSectionTitle/)
  assert.doesNotMatch(organisation, /AuthSectionTitle/)
  assert.doesNotMatch(shared, /AuthSectionTitle|authSectionTitleIcon/)
  assert.doesNotMatch(css, /authSectionTitleIcon|authChoiceIdentityIcon/)
})

test('onboarding path cards align titles and actions at every width', async () => {
  const css = await read('src/styles/parts/layout.css')

  assert.match(css, /\.onboardingPathTitle\s*{[^}]*flex-wrap:\s*nowrap;/)
  assert.match(css, /\.onboardingPathAction\s*{[^}]*margin-top:\s*auto;/)
  assert.match(
    css,
    /@media \(max-width:\s*900px\)[\s\S]*?\.onboardingPathGrid\s*{[^}]*grid-template-columns:\s*1fr;/,
  )
})

test('the member library contains guides without an official-policies section', async () => {
  const library = await read('src/pages/Library.jsx')

  assert.match(library, /label="Open guides"/)
  assert.doesNotMatch(library, /Official policies/)
  assert.doesNotMatch(library, /POLICY_CATEGORIES/)
})

test('opportunity cards keep content in a compact natural flow', async () => {
  const cards = await read('src/styles/parts/cards.css')
  const opportunityCard =
    cards.match(/\.entityCard\.opportunityCard\s*{([^}]+)}/)?.[1] || ''
  const opportunityCopy =
    cards.match(/\.opportunityCardCopy\s*{([^}]+)}/)?.[1] || ''

  assert.match(opportunityCard, /grid-template-rows:\s*auto auto auto auto/)
  assert.match(opportunityCard, /align-content:\s*start/)
  assert.doesNotMatch(opportunityCard, /minmax\(/)
  assert.match(opportunityCopy, /grid-template-rows:\s*auto/)
  assert.match(cards, /\.opportunityMeta:empty\s*{[\s\S]*?display:\s*none/)
})

test('opportunity results render separate open and closed card grids', async () => {
  const opportunities = await read('src/pages/Opportunities.jsx')

  assert.match(opportunities, /groupOpportunitiesByStatus\(items\)/)
  assert.match(opportunities, /label="Open"/)
  assert.match(opportunities, /label="Closed"/)
  assert.match(
    opportunities,
    /groupedItems\.open\.length[\s\S]*?className="cardGrid"[\s\S]*?groupedItems\.closed\.length[\s\S]*?className="cardGrid"/,
  )
})

test('public site navigation collapses into a labelled mobile menu', async () => {
  const [site, css] = await Promise.all([
    read('src/pages/site/PublicSite.jsx'),
    read('src/styles/parts/site.css'),
  ])

  assert.match(site, /aria-controls="site-mobile-navigation"/)
  assert.match(site, /aria-expanded={open}/)
  assert.match(site, /event\.key !== 'Escape'/)
  assert.match(css, /@media \(max-width: 760px\)/)
  assert.match(css, /\.siteNavDesktop\s*{[\s\S]*?display:\s*none/)
  assert.match(css, /\.siteMenuButton\s*{[\s\S]*?display:\s*inline-grid/)
})

test('landing-page onboarding steps adapt to their own available width', async () => {
  const [home, css] = await Promise.all([
    read('src/pages/site/SiteHome.jsx'),
    read('src/styles/parts/site.css'),
  ])

  assert.match(home, /className="siteStartStepLabel"/)
  assert.match(home, /Step \{index \+ 1\}/)
  assert.doesNotMatch(home, /siteStartNumber|ListChecks/)
  assert.match(css, /container:\s*site-start \/ inline-size/)
  assert.match(
    css,
    /@container site-start \(min-width: 600px\)[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/,
  )
  assert.match(
    css,
    /\.siteStartList li\s*{[^}]*grid-template-columns:\s*32px minmax\(0, 1fr\)/,
  )
  assert.match(
    css,
    /@media \(max-width: 340px\)[\s\S]*?\.siteHeaderInner\s*{[^}]*padding-inline:\s*var\(--space-2\)/,
  )
})

test('the signed-out platform landing has distinct join and sign-in paths', async () => {
  const [accessGate, authGate, landing, desk] = await Promise.all([
    read('src/components/AccessGate.jsx'),
    read('src/components/AuthGate.jsx'),
    read('src/pages/PlatformLanding.jsx'),
    read('src/components/auth/LandingSignIn.jsx'),
  ])

  assert.match(accessGate, /if \(account\)/)
  assert.match(accessGate, /if \(path === '\/'\)/)
  assert.match(
    accessGate,
    /<PlatformLanding onAuthenticated={handleAuthenticated} \/>/,
  )
  assert.match(accessGate, /path === '\/join' \? 'register' : 'signin'/)
  assert.match(authGate, /initialMode = 'register'/)
  assert.match(landing, /href="\/join"/)
  assert.match(landing, /href="\/signin"/)
  assert.match(landing, /id="what-it-does"/)
  assert.match(landing, /id="trust"/)
  assert.match(landing, /<LandingSignIn onAuthenticated={onAuthenticated} \/>/)
  assert.match(desk, /id="signin"/)
  assert.match(desk, /apiPost\('\/auth\/login'/)
  assert.match(desk, /href="\/join"/)
})

test('working-group contact cards keep their icon beside the group name', async () => {
  const [cards, css] = await Promise.all([
    read('src/components/cards.jsx'),
    read('src/styles/parts/cards.css'),
  ])

  assert.match(cards, /className="workingGroupContactTitle"/)
  assert.match(cards, /className="workingGroupContactIcon"/)
  assert.match(css, /\.workingGroupContactTitle\s*{[\s\S]*?display:\s*flex/)
})

test('working-group details render Contact Points as connected account cards', async () => {
  const page = await read('src/pages/GroupDetail.jsx')

  assert.match(page, /workingGroupRole=manager/)
  assert.match(page, /className="peopleGrid groupContactAccountGrid"/)
  assert.match(page, /<PersonCard key={person\.id} person={person}/)
  assert.doesNotMatch(page, /<ContactCard contact={g\.contact}/)
})

test('motion follows surface geometry and continuous animation stays disabled', async () => {
  const directory = new URL('../src/styles/parts/', import.meta.url)
  const files = (await readdir(directory)).filter((file) =>
    file.endsWith('.css'),
  )
  const [tokens, app, motion] = await Promise.all([
    read('src/styles/tokens.css'),
    read('src/styles/app.css'),
    read('src/styles/parts/motion.css'),
  ])

  assert.match(tokens, /--motion-fast:\s*120ms/)
  assert.match(tokens, /--motion-standard:\s*180ms/)
  assert.match(app, /@import '\.\/parts\/motion\.css'/)
  assert.match(
    motion,
    /\.sheet\s*{[^}]*transform-origin:\s*top right;[^}]*animation:\s*hubMenuIn/,
  )
  assert.match(
    motion,
    /\.routePeek\[open\]\s*{[^}]*animation:\s*hubRightPanelIn/,
  )
  assert.match(
    motion,
    /\.comboMenu,[\s\S]*?\.siteMobileNav\s*{[^}]*animation:\s*hubPopoverIn/,
  )
  assert.doesNotMatch(motion, /\.card[^,{]*[,{][^}]*animation:/)

  for (const file of files) {
    const css = await read(`src/styles/parts/${file}`)
    assert.doesNotMatch(css, /animation[^;]*\binfinite\b/i, file)
  }
})

test('calendar agenda groups natural cards and keeps range filters visible', async () => {
  const calendar = await read('src/pages/Calendar.jsx')
  const css = await read('src/styles/parts/calendar.css')
  const cardRule = css.match(
    /\.calendarAgendaCards\s*>\s*\.entityCard\s*{([^}]+)}/,
  )?.[1]

  assert.match(cardRule || '', /height:\s*auto/)
  assert.match(cardRule || '', /min-height:\s*0/)
  assert.match(cardRule || '', /grid-template-rows:\s*auto auto/)
  assert.match(cardRule || '', /overflow:\s*hidden/)
  assert.match(css, /scroll-snap-type:\s*y proximity/)
  assert.match(css, /padding:\s*0 var\(--space-1\) var\(--space-3\) 2px/)
  assert.match(calendar, /aria-label="Agenda range"/)
  assert.match(calendar, />\s*Today\s*</)
  assert.match(calendar, />\s*This week\s*</)
  assert.match(calendar, />\s*Month\s*</)
  assert.match(calendar, /className="calendarAgendaGroup"/)
})

test('statement processes and archive use four compact desktop columns', async () => {
  const css = await read('src/styles/parts/pages.css')
  const steps = css.match(/\.gysSteps\s*{([^}]+)}/)?.[1] || ''
  const archive = css.match(/\.gysArchiveGrid\s*{([^}]+)}/)?.[1] || ''

  assert.match(steps, /repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(archive, /repeat\(4, minmax\(0, 1fr\)\)/)
  assert.doesNotMatch(steps, /overflow-x/)
  assert.doesNotMatch(archive, /overflow-x/)
})

test('page descriptions use the available header width', async () => {
  const css = await read('src/styles/parts/layout.css')
  const copy = css.match(/\.pageHeaderCopy\s*{([^}]+)}/)?.[1] || ''
  const title = css.match(/\.pageTitle\s*{([^}]+)}/)?.[1] || ''
  const lead = css.match(/\.pageLead\s*{([^}]+)}/)?.[1] || ''

  assert.match(copy, /flex:\s*1 1 auto/)
  assert.match(title, /max-width:\s*var\(--text-measure\)/)
  assert.match(lead, /max-width:\s*none/)
})
