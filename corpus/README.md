# Commentary research corpus

Builds a local sqlite corpus of public-domain Bible commentaries from sources that
support bulk use (currently HelloAO). It never contacts StudyLight.org
and never disguises itself: requests carry an honest User-Agent, are rate limited per
host, back off on 429/5xx, and stop on 403.

Requires Node >= 22.13. No npm dependencies.

```bash
cd corpus
export CORPUS_CONTACT=you@example.com        # optional; added to the User-Agent so servers can reach you
npm run ingest -- helloao                    # Calvin, Henry, Gill, JFB, Clarke
npm run ingest -- helloao --commentary john-gill --book ROM   # one book
npm run report                               # coverage gaps + licenses
npm test
```

Output: `corpus.sqlite` (tables `passages`, `sources`). Raw downloads are cached under `cache/`
and reruns skip anything already downloaded. Both files are gitignored.
If a run dies (network error), just rerun it — completed chapters are cached.

Not included yet: Wesley, Barnes, Luther, Lapide (no bulk source wired up; SWORD modules are the likely route), Benson, Whedon, Darby, Kretzmann, Bengel,
Haydock. The copyrighted commentaries (Scofield, Ironside, McGee, Constable, Orchard) are out of scope.
