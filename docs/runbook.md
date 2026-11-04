# Runbook

What has to be looked at on a schedule, and what "fine" looks like. Everything
here is manual by design: there is no monitoring agent, so a checkbox nobody
reads is worse than this file.

## Weekly — dependency PRs

Dependabot (`.github/dependabot.yml`) opens three kinds of PR on Mondays:

| ecosystem | what it bumps | how to merge |
| --- | --- | --- |
| npm | `astro`, `@astrojs/*`, `nodemailer` — grouped minor+patch | merge when `ci` is green |
| docker | `node:24-alpine` in the Dockerfile | merge when `ci` is green |
| github-actions | `actions/checkout`, `actions/setup-node` | merge when `ci` is green |

A major (astro 8, nodemailer 11) arrives as its own PR. Read the release notes
and run the mail test before merging:

```sh
npm test                       # 46 tests, includes the SMTP render test
```

Then, on staging, one signup to a mail-tester.com address and confirm ≥9/10.
A green unit test suite says the HTML changed; only mail-tester says the mail
still lands.

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
