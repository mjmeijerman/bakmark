# Runbook

What has to be looked at on a schedule, and what "fine" looks like. Everything
here is manual by design: there is no monitoring agent, so a checkbox nobody
reads is worse than this file.

## Weekly — dependency PRs

Dependabot (`.github/dependabot.yml`) opens three kinds of PR on Mondays:

| ecosystem | what it bumps | how to merge |
| --- | --- | --- |
| npm | `astro`, `@astrojs/*`, `nodemailer` — grouped minor+patch | merge when `ci` is green |
| docker | `node:26-alpine` in the Dockerfile | merge when `ci` is green |
| github-actions | `actions/checkout`, `actions/setup-node` | merge when `ci` is green |

A major (astro 8, nodemailer 11) arrives as its own PR. Read the release notes
and run the mail test before merging:

```sh
npm test                       # 46 tests, includes the SMTP render test
```

Then, on staging, one signup to a mail-tester.com address and confirm ≥9/10.
A green unit test suite says the HTML changed; only mail-tester says the mail
still lands.

## Daily — purge and the newsletter log

`deploy.sh` installs two cron entries on the host: the purge of unconfirmed
addresses at 04:17 (every environment) and the newsletter on Friday at 19:00
(production only). Both write one line per run.

```sh
ssh deploy@vps1.markmeijerman.nl 'tail -5 ~/.bakmark-purge.log'
```

A line a day, `removed N unconfirmed addresses older than 24 hours`, is the
proof that the promise in the confirmation mail is kept. No lines at all means
the crontab block is gone: deploy again, and check `crontab -l` for the
`# >>> bakmark cron` markers.

Ten minutes later the bounce sweep reads the same Postfix log:

```sh
ssh deploy@vps1.markmeijerman.nl 'tail -5 ~/.bakmark-bounces.log'
```

`1 hard bounce(s), 1 removed; 0 soft (kept); 12 delivered` is a normal line. A
`check SUBSCRIBERS_DB` error means the job found hard bounces for addresses that
are not in the list — almost always the wrong list, not a healthy one. A missing
log line for days on end usually means mail stopped being logged: check that
`/var/log/mail.log` is growing at all.

## Friday — the newsletter

Production mails the confirmed list at 19:00
(`scripts/newsletter.mjs`, cron installed by `deploy.sh`). No mail in a week
without a new video is normal, so check the log rather than the inbox:

```sh
ssh deploy@vps1.markmeijerman.nl 'tail -5 ~/.bakmark-newsletter.log'
```

What it should say, once per Friday: one line with the hour check that did
nothing, and one with `N new video(s) to x/y subscriber(s)`. Two send lines in
one week means the snapshot in `/var/lib/bakmark/videos-mailed.json` is not
being written; two `nothing done` lines means both cron entries skipped, which
is a timezone, not a video, problem. `failed:` in the line is one address that
refused the mail; the rest of the list got it and those videos are not retried,
so check whether that address is real.

Before the first real video, look at the mail once with
`npm run newsletter -- --preview you@example.com`: every recipe with a video,
concepts included, snapshot untouched.

## Monthly — analytics

The visit counter (Umami + Postgres, `analytics/compose.yaml`) runs beside the
site on the same VPS, on loopback, behind the nginx vhost `analytics.bakmark.nl`.

1. **It is still up.** From a checkout:

   ```sh
   cd /srv/bakmark-staging
   docker compose -p bakmark-analytics --env-file analytics/.env \
     -f analytics/compose.yaml ps
   ```

   `db` healthy and `umami` running is the expected pair. Swap `ps` for `logs`
   when it is not. The env file name is the one `deploy.sh` wrote; it is
   git-ignored, so it exists only on the machine that deployed.
2. **Pageviews are still arriving** in the dashboard. A flat line is either a
   quiet month or a site that lost the tracker; check the built HTML for
   `script.js` before believing the first explanation.
3. **Cookies.** Umami sets none for visitors, which is the whole reason there is
   no consent banner. If a `Set-Cookie` ever shows up on `/script.js` or
   `/api/send`, the privacy statement is wrong and needs the sentence back.
4. **Disk.** The database grows slowly but forever: `docker system df` and the
   size of `/var/lib/bakmark-analytics/data`.

## Monthly — mail health

1. **DMARC reports.** `_dmarc.news.bakmark.nl` has `rua=mailto:…`; check that
   mailbox for aggregate reports. Anything failing SPF/DKIM alignment there is
   mail being sent by something you forgot about — or by a spammer using your
   domain.
2. **DNS is still what you think it is.** All four should answer:

   ```sh
   dig +short TXT news.bakmark.nl      # v=spf1 ip4:5.79.100.71 -all
   dig +short TXT mail.bakmark.nl      # v=spf1 a -all  (HELO identity)
   dig +short TXT _dmarc.news.bakmark.nl
   dig +short -x 5.79.100.71           # mail.bakmark.nl
   ```

3. **Blocklists.** https://www.mail-tester.com or MXToolbox for `5.79.100.71`.
   One listing is not a crisis; it is a reason to find out who reported you.

## Yearly — DKIM key rotation

The selector is `default` on `news.bakmark.nl`, 2048-bit. Rotation is not
urgent, but it is impossible to do in a hurry: the old key has to stay
published until every mail signed with it has expired.

1. Generate a new key under a **new selector**, e.g. `2027`:

   ```sh
   opendkim-genkey -b 2048 -d news.bakmark.nl -s 2027 -D /etc/dkimkeys
   ```

2. Publish `/etc/dkimkeys/2027.txt` as `2027._domainkey.news.bakmark.nl`.
   Verify it resolves before touching the signing config.
3. Point `SigningTable` / `KeyTable` at the new key, restart `opendkim`.
4. Send one mail-tester message and confirm `header.s=2027` with `dkim=pass`.
5. Leave the old selector published for at least a month, then remove the DNS
   record and the key. Removing it first breaks DKIM for mail already in
   flight.

## VPS — OS and mail stack

Debian 12, Postfix 3.7.x, OpenDKIM 2.11.x, patched to the current `deb12u`
point release. There is **no `unattended-upgrades` installed**, so security
updates land only when someone runs `apt upgrade`:

```sh
ssh deploy@vps1.markmeijerman.nl
sudo apt update && apt list --upgradable
sudo apt upgrade
```

Installing unattended-upgrades is the better fix (one command, then it patches
itself):

```sh
sudo apt install unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades
```

After any Postfix or OpenDKIM change, run the mail test again. A signature that
passes mail-tester but lands in Gmail's spam is still a broken funnel — check
the folder, not just the score.

## Known gaps

- **No `List-Unsubscribe` header.** Gmail and Yahoo require it for bulk senders.
  The unsubscribe token and route already exist; only the headers are missing.
- **DMARC is `p=none`.** It passes, but enforces nothing. Move to `p=quarantine`
  once the aggregate reports have been clean for a few weeks.
