# Security policy

## Supported versions

Fixes go into the latest release. While react-wordgard is on 0.x, only the newest minor version
gets security fixes; upgrade to it to receive them.

## Reporting a vulnerability

Please report vulnerabilities privately, through GitHub's private vulnerability reporting: on this
repository's **Security** tab, choose **Report a vulnerability**. Don't open a public issue or pull
request for it.

Include what you can of:

- the react-wordgard, `wordgard`, React and browser versions;
- the steps or a minimal example that shows the problem;
- what an attacker could do with it.

## What happens next

- We aim to acknowledge a report within five working days, and to keep you informed as we
  investigate.
- Once confirmed, we fix it in a new release, publish a GitHub security advisory (with a CVE where
  one applies), and note the fix in `CHANGELOG.md`.
- We coordinate the disclosure date with you, and credit you in the advisory if you'd like.

## Scope

In scope: react-wordgard's own code, such as how it renders the document and decorations with
React, turns decoration attributes into props, and handles the DOM's mutations and events.

Out of scope:

- vulnerabilities in Wordgard itself: report them to Wordgard's maintainer
  (https://code.haverbeke.berlin/wordgard/wordgard);
- vulnerabilities in React or in other dependencies: report them to their projects;
- an application's own components, schema or decorations, for instance one that puts untrusted
  values in links or attributes without checking them.

react-wordgard renders the document's text as text and never injects raw HTML; content that comes
from untrusted sources is the application's to validate, as with any editor.
