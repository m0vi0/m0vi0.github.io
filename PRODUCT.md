# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, weighted equally:

- **Recruiters and hiring managers** at security firms and VAPT consultancies hiring junior penetration testers. They skim in under a minute, look for a name, a role, a resume and proof, and forward the link.
- **Technical interviewers** (senior pentesters) who read the writeups closely and judge methodology, ownership and honesty.

The page must survive both a 30-second skim and a careful read.

## Product Purpose

Personal portfolio of Mervin Sequeira, a 2026 B.E. CSE (AI & ML) graduate in Mangaluru, India, seeking a junior pentest / VAPT role. Success: a reader can name him, the role he wants and one thing he built within one screen, can download his resume, and can verify claims through linked work.

## Positioning

Detection-aware pentester: he builds and runs the defensive stack (Wazuh SIEM, Kismet WIDS, failover monitoring) and is training offensively (CPTS path, labs, bug bounty), so he knows what an attacker looks like from the defender's side. Honest learning status is part of the position; nothing is overclaimed.

## Operating Context

Static site on GitHub Pages (`m0vi0.github.io`), plain HTML/CSS, no build step, no JavaScript framework. Visitors arrive from LinkedIn, the resume, or job applications; many on phones.

## Capabilities and Constraints

- Pages: `index.html` and three writeups in `writeups/` (Tailscale failover, Deauth → Wazuh, PacMap).
- Contact is email (`mervinsequeira485@gmail.com`), LinkedIn and GitHub. No forms, no backend.
- Name shown as **Mervin Sequeira** only; the `m0vi0` handle is not shown as identity (it remains in GitHub URLs).

## Brand Commitments

- Voice: plain, first person, modest and accurate about learning status (see commits `ea4ea7b`, `611af43`).
- The OYO bug-bounty summary was deliberately removed from the site; do not reintroduce it on pages.

## Evidence on Hand

- Resume: `assets/resume.pdf` (copied from `~/Documents/Mervin_Sequeira_Resume.pdf`, Sep 2026; user approved publishing it with phone number).
- PacMap source: https://github.com/m0vi0/pacmap (public). Demo video: `assets/demo.mp4`.
- Offensive training (from resumes, user approved citing): HTB Academy CPTS path in progress (Footprinting and Network Enumeration with Nmap completed; web exploitation, shells & payloads, pivoting, privilege escalation in progress); HTB Season 11, 3 machines owned (Connected, DevHub, Reactor); PortSwigger Web Security Academy labs (access control, request manipulation, SSRF); bug bounty recon on Bugcrowd programs with subfinder and ffuf; CompTIA Network+ in progress.
- Defensive work: multi-node Wazuh SIEM (manager + 2 agents, Raspberry Pi 3B+ and HP laptop); custom Kismet deauth rules, false positives reduced ~40% by threshold tuning; Uptime Kuma and Netdata monitoring; Tailscale subnet-router failover.
- Absent, do not fabricate: certifications earned, employment, client engagements, CVEs, testimonials, screenshots or diagrams of the lab.

## Product Principles

1. Name, role and resume are reachable in one screen.
2. Every skill claim points at evidence: a module, a lab, a repo or a writeup.
3. Honest status beats impressive framing.
4. Writeups say what he did, in first person, with links that can be checked.

## Accessibility & Inclusion

WCAG 2.2 AA: real heading structure, keyboard reachable links, pausable motion, respects reduced motion, readable on 390px phones and slow connections.
