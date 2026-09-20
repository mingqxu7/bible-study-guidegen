export const PD_MARK_URL = 'https://creativecommons.org/publicdomain/mark/1.0/';

// Key = HelloAO commentary id. `id` is our stable commentary_id.
// sectionLevel: entries are keyed by their first verse and run until the next entry.
export const HELLOAO_COMMENTARIES = {
  'john-calvin': { id: 'calvin', name: "Calvin's Commentaries", author: 'John Calvin', sectionLevel: false },
  'matthew-henry': { id: 'henry', name: 'Matthew Henry Commentary', author: 'Matthew Henry', sectionLevel: true },
  'john-gill': { id: 'gill', name: "Gill's Exposition of the Bible", author: 'John Gill', sectionLevel: false },
  'jamieson-fausset-brown': { id: 'jfb', name: 'Jamieson-Fausset-Brown Commentary', author: 'Jamieson, Fausset, Brown', sectionLevel: false },
  'adam-clarke': { id: 'clarke', name: "Clarke's Commentary", author: 'Adam Clarke', sectionLevel: false },
};

// Only these HCF authors are ingested: the HCF LICENSE says the database also holds
// copyrighted fair-use excerpts, so we allowlist authors instead of taking everything.
export const HCF_AUTHORS = {
  'Cornelius a Lapide': { id: 'lapide', name: "Lapide's Commentary", author: 'Cornelius a Lapide' },
  'John Wesley': { id: 'wesley', name: "Wesley's Notes (HCF excerpts)", author: 'John Wesley' },
  'Martin Luther': { id: 'luther', name: "Luther's Commentary (HCF excerpts)", author: 'Martin Luther' },
};

export const HCF_LICENSE =
  'Public-domain dedication (compilation); public-domain authors only (allowlist), fair-use excerpts excluded';
