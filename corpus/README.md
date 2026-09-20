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

### Chinese translation (on demand)

Translate a passage's commentary into Simplified Chinese with the Anthropic API and keep it in
`corpus.sqlite` (table `translations`; the English `passages` are never changed):

    export ANTHROPIC_API_KEY=...                       # your key; never stored or printed
    npm run translate -- gill rom 8:28 --dry-run       # preview: counts and rough token estimate, no key needed
    npm run translate -- gill rom 8:28                 # translate and store (default model claude-sonnet-5)
    npm run show -- gill rom 8:28                      # English + stored Chinese, labelled machine translation
    npm run translate -- gill rom 8                    # a whole chapter
    node cli.js translations report                    # translated counts and token totals

A repeat request reads the stored translation and costs nothing. `--force` translates again;
`--max-chars` (default 30000) refuses a request that would translate more than that many characters.
Translations always render "God" as 上帝 (和合本上帝版 terms) and are labelled with the model and prompt
version. Nothing is sent to the API unless you run `translate` without `--dry-run`.

Not included yet: Lapide, Benson, Whedon, Bengel, Kretzmann, Haydock, Darby's Synopsis
(no bulk source found), and the SWORD versions of Clarke/Calvin/MHC/JFB (SWORD could fill gaps for Clarke and Calvin;
MHC and JFB use the `zCom4` driver, which this reader refuses, so they would need a zCom4 reader). The copyrighted commentaries (Scofield, Ironside, McGee,
Constable, Orchard) are out of scope.

SWORD notes: modules are read with a built-in reader (no SWORD library). Book and chapter intro
headings are not ingested; Barnes' preface/introduction sit in the Matt 1:1/1:2 verse slots and
are stored as ordinary verse rows. Barnes "no specific text" placeholders are dropped.
Wesley's SWORD module has no text for 1 Kings and Philemon, so `report` will show those books missing.
