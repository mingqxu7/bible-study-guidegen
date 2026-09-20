# Commentary research corpus

Builds a local sqlite corpus of public-domain Bible commentaries from sources that
support bulk use (currently HelloAO and CrossWire SWORD modules). It never contacts StudyLight.org
and never disguises itself: requests carry an honest User-Agent, are rate limited per
host, back off on 429/5xx, and stop on 403.

Requires Node >= 22.13. No npm dependencies.

```bash
cd corpus
export CORPUS_CONTACT=you@example.com        # optional; added to the User-Agent so servers can reach you
npm run ingest -- helloao                    # Calvin, Henry, Gill, JFB, Clarke
npm run ingest -- helloao --commentary john-gill --book ROM   # one book
npm run ingest -- sword                      # Wesley, Barnes (NT), Luther (selected passages); ~11 MB, one ZIP per 30 s
npm run report                               # coverage gaps + licenses
npm test
```

Output: `corpus.sqlite` (tables `passages`, `sources`). Raw downloads are cached under `cache/`
and reruns skip anything already downloaded. Both files are gitignored.
If a run dies (network error), just rerun it — completed chapters are cached.

Not included yet: Lapide, Gill, Benson, Whedon, Bengel, Kretzmann, Haydock, Darby's Synopsis
(no bulk source found), and the SWORD versions of Clarke/Calvin/MHC/JFB (HelloAO already supplies
those; SWORD could fill their gaps). The copyrighted commentaries (Scofield, Ironside, McGee,
Constable, Orchard) are out of scope.

SWORD notes: modules are read with a built-in reader (no SWORD library). Book and chapter intro
headings are not ingested; Barnes' preface/introduction sit in the Matt 1:1/1:2 verse slots and
are stored as ordinary verse rows. Barnes "no specific text" placeholders are dropped.
