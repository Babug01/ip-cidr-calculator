# IP & CIDR Calculator

Subnet math, subnet splitting, single-IP info, and a netmask reference — the four things I always
end up needing from an IP calculator, in one page. Runs entirely in the browser; nothing you type
ever leaves your machine.

## Features

- **CIDR calculator** — network/broadcast address, usable host range, total and usable host counts
  for any `a.b.c.d/n`
- **Subnet splitter** — split a CIDR block into equal subnets either by target prefix length or by a
  minimum number of hosts per subnet
- **IP info lookup** — class, private/public, loopback/link-local/multicast/reserved classification
  for a single address
- **CIDR ⇄ netmask reference** — the conversion table you inevitably have to look up anyway
- Everything computed with plain integer/bitwise arithmetic — no dependency on any IP-address library

## Why I built this

ipaddressguide.com covers this well, but I wanted it alongside the rest of the small utilities I
use constantly, with a consistent editor and dark mode. This is also one piece of a larger internal
DevOps tool I built at work consolidating the utility pages a platform engineer reaches for daily
into one place — this repo is the IP/CIDR piece, cleaned up and open-sourced on its own.

## Tech Stack

- [React](https://react.dev/) + [Vite](https://vitejs.dev/) — no other runtime dependencies; all
  subnet math is plain integer/bitwise arithmetic

## Running locally

```bash
git clone https://github.com/Babug01/ip-cidr-calculator.git
cd ip-cidr-calculator
npm install
npm run dev
```

## License

MIT — see [LICENSE](LICENSE).
