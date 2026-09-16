import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { transitionDeadline } from '../shared/platform.ts'

const databaseUrl = process.env.TEST_DATABASE_URL
const now = new Date('2026-09-16T00:00:00Z')
test('decision periods preserve the policy windows and do not advance closed processes', () => {
  assert.equal(
    transitionDeadline('standard', 'consultation', now),
    '2026-09-21T00:00:00.000Z',
  )
  assert.equal(
    transitionDeadline('standard', 'revision', now),
    '2026-09-17T00:00:00.000Z',
  )
  assert.equal(
    transitionDeadline('snap', 'consultation', now, 48),
    '2026-09-17T00:00:00.000Z',
  )
  assert.equal(
    transitionDeadline('snap', 'decision', now, 48),
    '2026-09-16T12:00:00.000Z',
  )
  assert.equal(
    transitionDeadline('snap', 'voting', now, 48),
    '2026-09-17T00:00:00.000Z',
  )
  assert.equal(transitionDeadline('standard', 'adopted', now), null)
})
test('production cannot materialize demo events, decisions or deadlines', () => {
  const result = execFileSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import * as s from '../server/lib/store.js'; console.log(JSON.stringify([s.listEvents(),s.listCouncil(),s.listSubmissions(),s.listAnnouncements(),s.listFixtureOpportunities()]))`,
    ],
    {
      cwd: new URL('.', import.meta.url),
      env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: '' },
      encoding: 'utf8',
    },
  )
  assert.deepEqual(JSON.parse(result), [[], [], [], [], []])
})

test(
  'operational platform preserves membership, scoped authority and reviewed publication',
  { skip: databaseUrl ? false : 'TEST_DATABASE_URL is not set' },
  async (t) => {
    process.env.DATABASE_URL = databaseUrl
    const service = await import('../server/modules/platform/service.ts')
    const { getPool } = await import('../server/lib/db.js')
    const { getAccessProfile } = await import('../server/lib/access.js')
    const { createSession, getSessionAccount } =
      await import('../server/lib/accounts.js')
    const { createApp } = await import('../server/app.js')
    const pool = getPool()
    const actors = Object.fromEntries(
      [
        'admin',
        'coordinator',
        'member',
        'publisher',
        'steward',
        'outsider',
        'network',
      ].map((name) => [
        name,
        { id: randomUUID(), role: name === 'admin' ? 'admin' : 'member' },
      ]),
    )
    const ids = Object.values(actors).map((a) => a.id)
    const slug = `test-${randomUUID()}`
    let enquiryId, decisionId, taskId
    const app = createApp({ env: { NODE_ENV: 'test' } })
    const server = app.listen(0, '127.0.0.1')
    await new Promise((resolve) => server.once('listening', resolve))
    const origin = `http://127.0.0.1:${server.address().port}`
    t.after(async () => {
      await new Promise((resolve) => server.close(resolve))
      await pool.query('DELETE FROM platform_enquiries WHERE id=$1', [
        enquiryId || null,
      ])
      await pool.query('DELETE FROM platform_tasks WHERE body_id=$1', [slug])
      await pool.query(
        'DELETE FROM platform_contributions WHERE decision_id IN (SELECT id FROM platform_decisions WHERE body_id=$1)',
        [slug],
      )
      await pool.query(
        'DELETE FROM platform_decision_revisions WHERE decision_id IN (SELECT id FROM platform_decisions WHERE body_id=$1)',
        [slug],
      )
      await pool.query('DELETE FROM platform_decisions WHERE body_id=$1', [
        slug,
      ])
      await pool.query('DELETE FROM platform_bodies WHERE id=$1', [slug])
      await pool.query(
        'DELETE FROM governance_audit WHERE actor_id=ANY($1::uuid[])',
        [ids],
      )
      await pool.query('DELETE FROM hub_accounts WHERE id=ANY($1::uuid[])', [
        ids,
      ])
      await pool.end()
    })
    for (const [name, actor] of Object.entries(actors)) {
      await pool.query(
        `INSERT INTO hub_accounts(id,email,password_hash,password_salt,name,entity_type,membership_track,country,membership_policy_version,role,member_status,hub_access_status,membership_status,constituency_work_status,course_passed_at,email_verified_at) VALUES($1,$2,'unused','unused',$3,'individual',$4,'Kenya','test',$5,'verified','active','active',$6,now(),now())`,
        [
          actor.id,
          `${actor.id}@example.org`,
          name,
          ['network', 'admin'].includes(name) ? 'network' : 'constituency_work',
          actor.role,
          ['network', 'admin'].includes(name) ? null : 'active',
        ],
      )
    }
    const rejects = (promise, status) =>
      assert.rejects(promise, (error) => error.status === status)
    const term = {
      startsAt: new Date(Date.now() - 60000).toISOString(),
      endsAt: new Date(Date.now() + 86400000 * 60).toISOString(),
      evidence: 'Recorded appointment and reviewed mandate',
    }
    const assign = (who, scopeType, scopeId, role = 'member', overrides = {}) =>
      service.assign(actors.admin, {
        accountId: actors[who].id,
        scopeType,
        scopeId,
        role,
        ...term,
        ...overrides,
      })
    const detail = () => service.decisionDetail(actors.coordinator, decisionId)
    const finishPeriod = () =>
      pool.query(
        "UPDATE platform_decisions SET deadline_at=now()-interval '1 second' WHERE id=$1",
        [decisionId],
      )
    const advance = async (stage, extra = {}) =>
      service.transition(actors.coordinator, decisionId, {
        stage,
        version: (await detail()).decision.version,
        reason: 'Reviewed the process and confirmed its outcome',
        ...extra,
      })

    await t.test(
      'body creation requires an administrator; coordination does not follow technical administration',
      async () => {
        await rejects(
          service.saveBody(actors.member, {
            id: slug,
            name: 'Working group',
            kind: 'working_group',
          }),
          403,
        )
        await service.saveBody(actors.admin, {
          id: slug,
          name: 'Working group',
          kind: 'working_group',
          description: 'Internal coordination notes',
          publicSummary: 'Reviewed public purpose',
        })
        // A WG mandate must use its documented Contact Point responsibility.
        await rejects(assign('outsider', 'body', slug, 'coordinator'), 400)
        await rejects(assign('outsider', 'body', slug, 'liaison'), 400)
        await rejects(assign('outsider', 'working_group', 'ace', 'lead'), 400)
        await assign('coordinator', 'body', slug, 'contact_point')
        await assign('publisher', 'body', slug)
        await assign('publisher', 'team', 'content_publisher')
        await assign('steward', 'team', 'membership_team')
        await assign('steward', 'team', 'partnerships')
        await service.joinBody(actors.member, slug)
        await rejects(service.joinBody(actors.network, slug), 403)
        await rejects(
          service.saveTask(actors.admin, {
            bodyId: slug,
            title: 'Unmandated work',
            status: 'open',
          }),
          403,
        )
        await rejects(
          service.saveBody(actors.coordinator, { kind: 'council' }, slug),
          403,
        )
        assert.equal((await service.overview(actors.network)).bodies.length, 0)
        assert.equal((await service.overview(actors.outsider)).people.length, 1)
        assert.equal(
          (await service.overview(actors.outsider)).bodies.find(
            (b) => b.id === slug,
          ).publicSummary,
          '',
        )
      },
    )
    await t.test(
      'publication uses an independent reviewed snapshot',
      async () => {
        assert.equal(
          (await service.publicPlatform()).bodies.some((b) => b.id === slug),
          false,
        )
        await service.publishBody(actors.publisher, slug, 1)
        await service.saveBody(
          actors.coordinator,
          {
            name: 'Working group',
            kind: 'working_group',
            description: 'Changed private notes',
            publicSummary: 'Unreviewed public draft',
            version: 1,
          },
          slug,
        )
        assert.equal(
          (await service.publicPlatform()).bodies.find((b) => b.id === slug)
            .summary,
          'Reviewed public purpose',
        )
        await rejects(service.publishBody(actors.publisher, slug, 1), 409)
      },
    )
    await t.test(
      'work requires scope, eligible ownership and optimistic conflict checks',
      async () => {
        const task = {
          bodyId: slug,
          title: 'Organise the next meeting',
          status: 'open',
          ownerId: actors.member.id,
          dueAt: new Date(Date.now() + 86400000).toISOString(),
        }
        await rejects(service.saveTask(actors.outsider, task), 403)
        await rejects(
          service.saveTask(actors.member, {
            ...task,
            ownerId: actors.outsider.id,
          }),
          400,
        )
        taskId = (await service.saveTask(actors.member, task)).id
        await service.saveTask(
          actors.member,
          { ...task, status: 'in_progress', version: 1 },
          taskId,
        )
        await rejects(
          service.saveTask(actors.member, { ...task, version: 1 }, taskId),
          409,
        )
        assert.ok(
          (await service.overview(actors.member)).notices.some(
            (n) => n.kind === 'task',
          ),
        )
      },
    )
    await t.test(
      'future and expired assignments do not confer legacy or new access',
      async () => {
        await assign('outsider', 'body', slug, 'contact_point', {
          startsAt: new Date(Date.now() + 86400000).toISOString(),
        })
        assert.equal(
          (await service.permissions(actors.outsider)).participates(slug),
          false,
        )
        await pool.query(
          "UPDATE hub_accounts SET team_roles=ARRAY['membership_team'],role='wg_contact',wg_interests=ARRAY['ace'] WHERE id=$1",
          [actors.outsider.id],
        )
        const access = await getAccessProfile({
          ...actors.outsider,
          teamRoles: ['membership_team'],
          wgInterests: ['ace'],
          role: 'wg_contact',
        })
        assert.equal(access.teamRoles.includes('membership_team'), false)
        assert.equal(access.wgAssignments.length, 0)
        await assign('outsider', 'body', slug, 'member')
        const assignment = (
          await pool.query(
            "SELECT id FROM account_assignments WHERE account_id=$1 AND role='member'",
            [actors.outsider.id],
          )
        ).rows[0]
        await service.revoke(
          actors.admin,
          assignment.id,
          'Mandate was ended by its appointing body',
        )
        assert.equal(
          (await service.permissions(actors.outsider)).participates(slug),
          false,
        )
      },
    )
    await t.test(
      'decisions require response periods and retain revisions; flags prevent consensus',
      async () => {
        const proposal = {
          bodyId: slug,
          title: 'Approve a partnership',
          proposal: 'Publicly share a reviewed collaboration with Example.',
          process: 'standard',
          policyVersion: 'DMP 2024 / local test',
        }
        decisionId = (await service.saveDecision(actors.member, proposal)).id
        await rejects(service.decisionDetail(actors.outsider, decisionId), 403)
        await rejects(
          service.transition(actors.admin, decisionId, {
            stage: 'consultation',
            version: 1,
            reason: 'I am the admin',
          }),
          403,
        )
        await advance('consultation')
        await rejects(advance('revision'), 409)
        await service.contribute(actors.member, decisionId, {
          kind: 'red',
          text: 'Need safeguards',
          grounds: 'Conflict of interest',
          alternative: 'Add a transparent review',
        })
        await service.contribute(actors.publisher, decisionId, {
          kind: 'grey',
          text: 'Review this next month',
          grounds: 'Keep the collaboration under review',
        })
        await finishPeriod()
        await advance('revision')
        await service.saveDecision(
          actors.coordinator,
          {
            ...proposal,
            proposal: 'Revised collaboration with independent safeguards',
            version: (await detail()).decision.version,
          },
          decisionId,
        )
        await finishPeriod()
        await advance('decision')
        await finishPeriod()
        await rejects(
          advance('adopted', { evidence: 'Recorded consensus' }),
          409,
        )
        const flag = (await detail()).contributions[0]
        await rejects(
          service.resolveContribution(actors.coordinator, flag.id, {
            resolution: 'Overruled by coordinator',
          }),
          403,
        )
        await service.resolveContribution(actors.member, flag.id, {
          resolution: 'The revised safeguards resolve my concern',
        })
        await rejects(
          advance('adopted', { evidence: 'Consensus with reservations' }),
          400,
        )
        await advance('adopted', {
          evidence: 'Minutes and independent review confirm consensus',
          reservations: 'A monthly review will address the remaining grey flag',
        })
        assert.ok(
          (await service.overview(actors.coordinator)).tasks.some(
            (t) =>
              t.decisionId === decisionId &&
              t.title.startsWith('Communicate decision:'),
          ),
        )
        assert.equal((await detail()).revisions.length, 2)
        await rejects(
          service.saveDecision(
            actors.member,
            { ...proposal, version: (await detail()).decision.version },
            decisionId,
          ),
          409,
        )
        assert.equal(
          (await service.publicPlatform()).decisions.some(
            (d) => d.id === decisionId,
          ),
          false,
        )
        await assign('coordinator', 'team', 'content_publisher')
        await rejects(
          service.publishDecision(
            actors.coordinator,
            decisionId,
            (await detail()).decision.version,
          ),
          409,
        )
        await service.publishDecision(
          actors.publisher,
          decisionId,
          (await detail()).decision.version,
        )
        assert.equal(
          (await service.publicPlatform()).decisions.find(
            (d) => d.id === decisionId,
          ).proposal,
          'Revised collaboration with independent safeguards',
        )
      },
    )
    await t.test(
      'partner enquiries stay private until an approved public decision backs the listing',
      async () => {
        const input = {
          organisation: 'Example Org',
          contactName: 'Private Person',
          email: 'private@example.org',
          message: 'Private discussion',
          consent: true,
        }
        await rejects(service.createEnquiry({ ...input, consent: false }), 400)
        const response = await fetch(`${origin}/api/platform/enquiries`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
        assert.equal(response.status, 201)
        enquiryId = (await response.json()).id
        assert.deepEqual((await service.overview(actors.member)).enquiries, [])
        const update = {
          status: 'approved',
          publicSummary: 'Reviewed collaboration',
          website: 'https://example.org',
          version: 1,
        }
        await rejects(
          service.updateEnquiry(actors.steward, enquiryId, update),
          409,
        )
        await rejects(
          service.updateEnquiry(actors.member, enquiryId, {
            ...update,
            decisionId,
          }),
          403,
        )
        await service.updateEnquiry(actors.steward, enquiryId, {
          ...update,
          decisionId,
        })
        const publicResponse = await fetch(`${origin}/api/platform/public`)
        assert.equal(publicResponse.status, 200)
        const body = JSON.stringify(await publicResponse.json())
        assert.ok(body.includes('Example Org'))
        assert.ok(!body.includes('private@example.org'))
        assert.ok(!body.includes('Private discussion'))
        assert.ok(!body.includes('Private Person'))
        assert.equal(
          (await fetch(`${origin}/api/platform/overview`)).status,
          401,
        )
        const session = await createSession(actors.steward.id)
        const privateResponse = await fetch(`${origin}/api/platform/overview`, {
          headers: { Authorization: `Bearer ${session.token}` },
        })
        assert.equal(privateResponse.headers.get('cache-control'), 'no-store')
        assert.equal(
          (await privateResponse.json()).enquiries.find(
            (e) => e.id === enquiryId,
          ).email,
          input.email,
        )
      },
    )
    await t.test(
      'a recorded veto requires evidence and the policy threshold, and can stop voting early',
      async () => {
        const original = decisionId
        decisionId = (
          await service.saveDecision(actors.member, {
            bodyId: slug,
            title: 'Veto example',
            proposal: 'An externally vetoed proposal',
            process: 'standard',
            policyVersion: 'DMP issue 3',
          })
        ).id
        for (const stage of [
          'consultation',
          'revision',
          'decision',
          'voting',
        ]) {
          await finishPeriod()
          await advance(stage)
        }
        const veto = {
          outcomeBasis: 'formal_veto',
          vetoOrganisations: 5,
          vetoGlobalSouth: 5,
          vetoBodies: 0,
          evidence: 'Main-channel formal request with reasons and signatories',
        }
        await rejects(advance('withdrawn', veto), 409)
        await advance('withdrawn', {
          ...veto,
          vetoOrganisations: 6,
          vetoGlobalSouth: 6,
        })
        assert.equal((await detail()).decision.stage, 'withdrawn')
        assert.match((await detail()).decision.outcome, /Formal veto/)
        decisionId = original
      },
    )
    await t.test(
      'external vote outcomes enforce both quorum and approval; technical admins cannot vote by proxy',
      async () => {
        const original = decisionId
        decisionId = (
          await service.saveDecision(actors.member, {
            bodyId: slug,
            title: 'External vote',
            proposal: 'Test recorded vote',
            process: 'snap',
            urgencyReason: 'Conference deadline requires this window',
            policyVersion: 'DMP 2024',
          })
        ).id
        for (const stage of [
          'consultation',
          'revision',
          'decision',
          'voting',
        ]) {
          await finishPeriod()
          await advance(stage)
        }
        await finishPeriod()
        await rejects(
          advance('adopted', {
            evidence: 'External ballot',
            electorateSize: 100,
            votesFor: 4,
            votesAgainst: 0,
          }),
          409,
        )
        await rejects(
          advance('adopted', {
            evidence: 'External ballot',
            electorateSize: 100,
            votesFor: 5,
            votesAgainst: 3,
          }),
          409,
        )
        await rejects(
          advance('adopted', {
            evidence: 'Missing vote count',
            electorateSize: 100,
            votesFor: 10,
            votesAgainst: '',
          }),
          400,
        )
        await advance('adopted', {
          evidence: 'External ballot evidence with eligible seats',
          electorateSize: 100,
          votesFor: 6,
          votesAgainst: 3,
        })
        decisionId = original
      },
    )
    await t.test(
      'ending Constituency Work preserves Network access and removes assignments',
      async () => {
        await pool.query(
          "INSERT INTO wg_workspace_progress(account_id,wg_slug,status,role_in_wg) VALUES($1,'ace','active','contact')",
          [actors.member.id],
        )
        await assign('member', 'working_group', 'ace', 'contact')
        const session = await createSession(actors.member.id)
        await rejects(
          service.membershipAction(actors.admin, actors.member.id, {
            action: 'expire_cw',
            reason: 'Technical admins are not membership officers',
          }),
          403,
        )
        await service.membershipAction(actors.steward, actors.member.id, {
          action: 'expire_cw',
          reason: 'Member did not renew Constituency Work participation',
        })
        const current = await getSessionAccount(session.token)
        assert.equal(current.membershipTrack, 'network')
        assert.equal(current.hubAccessStatus, 'active')
        assert.equal(
          (await service.permissions(actors.member)).participates(slug),
          false,
        )
        assert.equal((await getAccessProfile(current)).wgAssignments.length, 0)
        await rejects(
          service.saveTask(actors.member, {
            bodyId: slug,
            title: 'No remaining mandate',
            status: 'open',
          }),
          403,
        )
        await service.membershipAction(actors.steward, actors.member.id, {
          action: 'activate_cw',
          cohort: 'Reviewed September cohort',
          renewalDueAt: new Date(Date.now() + 86400000 * 90).toISOString(),
          reason: 'Renewed course and onboarding review',
        })
        assert.equal((await service.permissions(actors.member)).cw, true)
        assert.equal(
          (await service.permissions(actors.member)).participates(slug),
          false,
        )
      },
    )
    await t.test(
      'withdrawal removes public decisions and dependent partner listings without erasing the decision',
      async () => {
        await service.withdrawPublication(
          actors.publisher,
          'decision',
          decisionId,
          {
            version: (await detail()).decision.version,
            reason: 'Correct a public disclosure before republishing',
          },
        )
        const publication = await service.publicPlatform()
        assert.ok(!publication.decisions.some((d) => d.id === decisionId))
        assert.ok(!publication.partners.some((p) => p.id === enquiryId))
        assert.equal((await detail()).decision.stage, 'adopted')
        await service.withdrawPublication(actors.publisher, 'body', slug, {
          version: 2,
          reason: 'Review old body details',
        })
        assert.ok(
          !(await service.publicPlatform()).bodies.some((b) => b.id === slug),
        )
      },
    )
  },
)
