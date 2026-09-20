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
