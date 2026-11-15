# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Audiences, weighted equally:

- **Recruiters and hiring managers** hiring for security roles (pentest / VAPT, detection) **and** software roles. They skim in under a minute, look for a name, what the person does, proof and a way to get in touch, and forward the link.
- **Technical interviewers**: senior pentesters, and engineers, who read the writeups closely and judge methodology, ownership and honesty.
- **Founders and collaborators** looking for someone who builds fast and knows security.

The page must survive both a 30-second skim and a careful read.

## Product Purpose

Personal portfolio of Mervin Sequeira, a 2026 B.E. CSE (AI & ML) graduate who builds web apps and works in cybersecurity, open to junior security and software roles. Success: within one screen a reader can name him, say what he does (builds, and secures) and find one thing he built, can reach him by email, and can verify claims through linked work.

## Positioning

Builder and defender: he ships web apps (SmashBid, PacMap, this site and its 3D room) and runs his own detection lab (Wazuh, Kismet, failover), training offensively on the HTB CPTS path. The landing says it in one line: "I build web apps and run my own security lab." Honest learning status is part of the position; nothing is overclaimed.

## Operating Context

Static site on GitHub Pages (`m0vi0.github.io`), built with Vite: a three.js room on the landing, plain HTML writeups. Visitors arrive from LinkedIn, the resume, or job applications; many on phones.

## Capabilities and Constraints

- Pages: `index.html` and three writeups in `writeups/` (Tailscale failover, Deauth → Wazuh, PacMap).
- Contact is email (`mervinsequeira485@gmail.com`), LinkedIn and GitHub. No forms, no backend.
- Name shown as **Mervin Sequeira** only; the `m0vi0` handle is not shown as identity (it remains in GitHub URLs).

## Brand Commitments

- Voice: plain, first person, modest and accurate about learning status (see commits `ea4ea7b`, `611af43`).
- The OYO bug-bounty summary was deliberately removed from the site; do not reintroduce it on pages.

## Evidence on Hand

- No resume on the site (Nov 2026): it carried a phone number. Contact is email, LinkedIn and GitHub.
- PacMap source: https://github.com/m0vi0/pacmap (public). Demo video: `assets/demo.mp4`.
- Offensive training (from resumes, user approved citing): HTB Academy CPTS path in progress (Footprinting and Network Enumeration with Nmap completed; web exploitation, shells & payloads, pivoting, privilege escalation in progress); HTB Season 11, 3 machines owned (Connected, DevHub, Reactor); PortSwigger Web Security Academy labs (access control, request manipulation, SSRF); bug bounty recon on Bugcrowd programs with subfinder and ffuf; CompTIA Network+ in progress.
- Defensive work: multi-node Wazuh SIEM (manager + 2 agents, Raspberry Pi 3B+ and HP laptop); custom Kismet deauth rules, false positives reduced ~40% by threshold tuning; Uptime Kuma and Netdata monitoring; Tailscale subnet-router failover.
- Absent, do not fabricate: certifications earned, employment, client engagements, CVEs, testimonials, screenshots or diagrams of the lab.

## Product Principles

1. Name, role and a way to get in touch are reachable in one screen.
2. Every skill claim points at evidence: a module, a lab, a repo or a writeup.
3. Honest status beats impressive framing.
4. Writeups say what he did, in first person, with links that can be checked.

## Accessibility & Inclusion

WCAG 2.2 AA: real heading structure, keyboard reachable links, pausable motion, respects reduced motion, readable on 390px phones and slow connections.
