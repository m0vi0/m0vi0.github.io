---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

MODE: experience
THESIS: The portfolio is the homelab rack Mervin actually runs, and the rack is the whole page: scrolling moves your head up to the rack and down it, one server at a time, and each server's faceplate carries its own content.
OWN-WORLD: POPH: primary yellow hero, the original black server rack (model by Spellkaze, CC BY), Bebas Neue titles, Space Grotesk text, one volt accent per project (pink, lime, blue). The "MERVIN SEQUEIRA" nameplate sits on the top panel. Raises: no separate text sections when JS runs; every server labels itself; status is a coloured dot, never an adjective.
STORY: Stop 0: yellow hero, wordmark and the rack at 3/4. Stop 1: dolly in to the nameplate, background turns black. Stops 2–10: head-on, one server per stop (About, Tailscale, Deauth→Wazuh, PacMap, Skills defense, Skills offense, Resume, Email, LinkedIn|GitHub). Stop 11: pull back to the footer (email and CC BY credit). Clicking a project runs the ~1s portal into its writeup; other servers open their link.
FIRST VIEWPORT: Wordmark "MERVIN SEQUEIRA", role line and resume download on yellow; the black rack to the right (desktop) or between the name and copy (portrait).
FORM: three.js 0.186.1; scroll-driven camera over 12 sticky stops with proximity snap; faceplates are CanvasTexture planes. The HTML sections stay in the DOM (visually hidden) as the source of truth for screen readers and keyboard; focusing one moves the camera to its server.
FINISH: Labels crisp at 1440 and 390 widths, the camera rests on each server and moves fast between them, and the page is fully usable with no JS or with reduced motion (the old sections show as plain content).
