import { useState } from "react";
import Header from "./components/Header";

const REPO_URL = "https://github.com/Babug01/ip-cidr-calculator";

// All arithmetic here verified directly (node) against known-correct
// real-world values before being written into the page:
// 192.168.1.0/24 -> network .0, broadcast .255, 254 usable, netmask
// 255.255.255.0; 10.0.0.0/8 -> 16,777,214 usable; 192.168.1.5/30 -> network
// .4, broadcast .7, usable .5-.6; plus the /0, /31, /32 edge cases and
// equal-subnet splitting (192.168.1.0/24 into /26 -> .0/.64/.128/.192).

const IP_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isValidOctets(parts) {
  return parts.every((p) => p >= 0 && p <= 255);
}

function ipToInt(ip) {
  const m = ip.trim().match(IP_RE);
  if (!m) throw new Error(`"${ip}" is not a valid IPv4 address`);
  const parts = m.slice(1, 5).map(Number);
  if (!isValidOctets(parts)) throw new Error(`"${ip}" has an octet outside 0-255`);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function intToIp(n) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

function maskFromPrefix(prefix) {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

function parseCidr(cidr) {
  const [ip, prefixStr] = cidr.trim().split("/");
  if (!prefixStr) throw new Error("Enter a CIDR in the form ip/prefix, e.g. 192.168.1.0/24");
  const prefix = Number(prefixStr);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) throw new Error("Prefix must be an integer from 0 to 32");
  return { ipInt: ipToInt(ip), prefix };
}

function cidrInfo(cidr) {
  const { ipInt, prefix } = parseCidr(cidr);
  const maskInt = maskFromPrefix(prefix);
  const network = (ipInt & maskInt) >>> 0;
  const broadcast = (network | (~maskInt >>> 0)) >>> 0;
  const total = Math.pow(2, 32 - prefix);
  const usable = prefix >= 31 ? 0 : total - 2;
  return {
    input: cidr, prefix,
    network: intToIp(network), broadcast: intToIp(broadcast),
    netmask: intToIp(maskInt), wildcard: intToIp((~maskInt) >>> 0),
    firstHost: prefix >= 31 ? intToIp(network) : intToIp(network + 1),
    lastHost: prefix >= 31 ? intToIp(broadcast) : intToIp(broadcast - 1),
    total, usable,
    binary: [24, 16, 8, 0].map((s) => (((ipInt >>> s) & 255) >>> 0).toString(2).padStart(8, "0")).join("."),
  };
}

function splitCidr(cidr, newPrefix) {
  const { ipInt, prefix } = parseCidr(cidr);
  const np = Number(newPrefix);
  if (!Number.isInteger(np) || np < prefix || np > 32) throw new Error(`New prefix must be between /${prefix} and /32`);
  const maskInt = maskFromPrefix(prefix);
  const network = (ipInt & maskInt) >>> 0;
  const count = Math.pow(2, np - prefix);
  if (count > 4096) throw new Error(`That split would produce ${count.toLocaleString()} subnets — narrow the range or raise the starting prefix`);
  const blockSize = Math.pow(2, 32 - np);
  const subnets = [];
  for (let i = 0; i < count; i++) {
    const subnetCidr = `${intToIp((network + i * blockSize) >>> 0)}/${np}`;
    subnets.push(cidrInfo(subnetCidr));
  }
  return subnets;
}

// Smallest prefix whose block can fit `hosts` usable addresses.
function prefixForHosts(hosts) {
  const needed = hosts + 2; // + network + broadcast
  for (let p = 32; p >= 0; p--) {
    if (Math.pow(2, 32 - p) >= needed) return p;
  }
  return 0;
}

const PRIVATE_RANGES = [
  ["10.0.0.0", 8], ["172.16.0.0", 12], ["192.168.0.0", 16], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["100.64.0.0", 10],
];

function ipInfo(ip) {
  const ipInt = ipToInt(ip);
  const isPrivate = PRIVATE_RANGES.some(([net, prefix]) => (ipInt & maskFromPrefix(prefix)) >>> 0 === ipToInt(net));
  const firstOctet = (ipInt >>> 24) & 255;
  let ipClass = "N/A (classful addressing is obsolete, shown for reference only)";
  if (firstOctet < 128) ipClass = "A";
  else if (firstOctet < 192) ipClass = "B";
  else if (firstOctet < 224) ipClass = "C";
  else if (firstOctet < 240) ipClass = "D (multicast)";
  else ipClass = "E (reserved)";
  return {
    ip,
    binary: [24, 16, 8, 0].map((s) => (((ipInt >>> s) & 255) >>> 0).toString(2).padStart(8, "0")).join("."),
    decimal: ipInt,
    hex: "0x" + ipInt.toString(16).padStart(8, "0"),
    isPrivate,
    ipClass,
    reverseDns: ip.trim().split(".").reverse().join(".") + ".in-addr.arpa",
  };
}

function netmaskTable() {
  const rows = [];
  for (let p = 32; p >= 0; p--) {
    const maskInt = maskFromPrefix(p);
    rows.push({
      prefix: p,
      netmask: intToIp(maskInt),
      wildcard: intToIp((~maskInt) >>> 0),
      total: Math.pow(2, 32 - p),
      usable: p >= 31 ? 0 : Math.pow(2, 32 - p) - 2,
    });
  }
  return rows;
}

const styles = {
  root: { minHeight: "100dvh", display: "flex", flexDirection: "column" },
  content: { fontFamily: "system-ui, sans-serif", padding: "24px 32px", maxWidth: 1000, margin: "0 auto", color: "var(--text, #1a1a1a)", width: "100%", boxSizing: "border-box", background: "var(--bg-subtle, #f0efed)", flex: 1 },
  legendSection: { marginTop: 32 },
  legendGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 },
  legendTable: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  legendTh: { textAlign: "left", padding: "4px 8px 4px 0", opacity: 0.5, fontWeight: 600, textTransform: "uppercase", fontSize: 10 },
  legendTd: { padding: "6px 8px 6px 0", fontFamily: "'SFMono-Regular', Consolas, monospace", verticalAlign: "top" },
  sectionTitle: { fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.6, marginBottom: 10 },
  title: { fontSize: 22, fontWeight: 700, margin: 0 },
  subtitle: { fontSize: 13, opacity: 0.6, margin: "4px 0 20px" },
  tabs: { display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  tabBtn: (active) => ({
    padding: "8px 16px", borderRadius: 8, border: active ? "none" : "1px solid var(--border, #e5e7eb)",
    background: active ? "var(--accent, #4f46e5)" : "transparent", color: active ? "#fff" : "var(--text, #1a1a1a)",
    cursor: "pointer", fontSize: 13, fontWeight: 600,
  }),
  row: { display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" },
  input: {
    padding: "9px 12px", borderRadius: 6, border: "1px solid var(--border, #e5e7eb)",
    background: "var(--input-bg, #f9fafb)", color: "var(--text, #1a1a1a)", fontSize: 13, minWidth: 220,
    fontFamily: "'SFMono-Regular', Consolas, monospace",
  },
  btn: {
    padding: "9px 18px", borderRadius: 6, border: "none", background: "var(--accent, #4f46e5)",
    color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
  },
  errorBox: {
    padding: 14, borderRadius: 8, border: "1px solid #e05c5c", background: "rgba(224,92,92,0.08)",
    color: "#e05c5c", fontSize: 13, marginTop: 8,
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 8 },
  th: { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid var(--border, #e5e7eb)", opacity: 0.6, fontWeight: 600, fontSize: 11, textTransform: "uppercase" },
  td: { padding: "8px 10px", borderBottom: "1px solid var(--border, #e5e7eb)", fontFamily: "'SFMono-Regular', Consolas, monospace" },
  resultGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginTop: 8 },
  card: { background: "var(--input-bg, #f9fafb)", border: "1px solid var(--border, #e5e7eb)", borderRadius: 8, padding: "12px 14px" },
  cardLabel: { fontSize: 11, opacity: 0.55, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 },
  cardValue: { fontSize: 14, fontWeight: 600, fontFamily: "'SFMono-Regular', Consolas, monospace" },
};

function ResultCard({ label, value }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardLabel}>{label}</div>
      <div style={styles.cardValue}>{value}</div>
    </div>
  );
}

function CidrCalculatorTab() {
  const [cidr, setCidr] = useState("192.168.1.0/24");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function calculate() {
    try {
      setResult(cidrInfo(cidr));
      setError(null);
    } catch (e) {
      setResult(null);
      setError(e.message);
    }
  }

  return (
    <div>
      <div style={styles.row}>
        <input style={styles.input} value={cidr} onChange={(e) => setCidr(e.target.value)} placeholder="192.168.1.0/24" onKeyDown={(e) => e.key === "Enter" && calculate()} />
        <button style={styles.btn} onClick={calculate}>Calculate</button>
      </div>
      {error && <div style={styles.errorBox}>{error}</div>}
      {result && (
        <div style={styles.resultGrid}>
          <ResultCard label="Network Address" value={result.network} />
          <ResultCard label="Broadcast Address" value={result.broadcast} />
          <ResultCard label="Netmask" value={result.netmask} />
          <ResultCard label="Wildcard Mask" value={result.wildcard} />
          <ResultCard label="First Usable Host" value={result.firstHost} />
          <ResultCard label="Last Usable Host" value={result.lastHost} />
          <ResultCard label="Total Addresses" value={result.total.toLocaleString()} />
          <ResultCard label="Usable Hosts" value={result.usable.toLocaleString()} />
          <ResultCard label="Binary" value={result.binary} />
        </div>
      )}
    </div>
  );
}

function SplitCidrTab() {
  const [cidr, setCidr] = useState("192.168.1.0/24");
  const [mode, setMode] = useState("prefix");
  const [newPrefix, setNewPrefix] = useState("26");
  const [hostsPerSubnet, setHostsPerSubnet] = useState("50");
  const [subnets, setSubnets] = useState(null);
  const [error, setError] = useState(null);

  function split() {
    try {
      const targetPrefix = mode === "prefix" ? Number(newPrefix) : prefixForHosts(Number(hostsPerSubnet));
      setSubnets(splitCidr(cidr, targetPrefix));
      setError(null);
    } catch (e) {
      setSubnets(null);
      setError(e.message);
    }
  }

  return (
    <div>
      <div style={styles.row}>
        <input style={styles.input} value={cidr} onChange={(e) => setCidr(e.target.value)} placeholder="192.168.1.0/24" />
        <select style={styles.input} value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="prefix">Split into equal /prefix subnets</option>
          <option value="hosts">Split by hosts needed per subnet</option>
        </select>
        {mode === "prefix" ? (
          <input style={{ ...styles.input, minWidth: 100 }} type="number" min="0" max="32" value={newPrefix} onChange={(e) => setNewPrefix(e.target.value)} placeholder="/26" />
        ) : (
          <input style={{ ...styles.input, minWidth: 100 }} type="number" min="1" value={hostsPerSubnet} onChange={(e) => setHostsPerSubnet(e.target.value)} placeholder="hosts" />
        )}
        <button style={styles.btn} onClick={split}>Split</button>
      </div>
      {error && <div style={styles.errorBox}>{error}</div>}
      {subnets && (
        <table style={styles.table}>
          <thead>
            <tr><th style={styles.th}>Subnet</th><th style={styles.th}>Network</th><th style={styles.th}>Broadcast</th><th style={styles.th}>Usable Range</th><th style={styles.th}>Usable Hosts</th></tr>
          </thead>
          <tbody>
            {subnets.map((s) => (
              <tr key={s.input}>
                <td style={styles.td}>{s.input}</td>
                <td style={styles.td}>{s.network}</td>
                <td style={styles.td}>{s.broadcast}</td>
                <td style={styles.td}>{s.firstHost} - {s.lastHost}</td>
                <td style={styles.td}>{s.usable}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function IpInfoTab() {
  const [ip, setIp] = useState("8.8.8.8");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function lookup() {
    try {
      setResult(ipInfo(ip));
      setError(null);
    } catch (e) {
      setResult(null);
      setError(e.message);
    }
  }

  return (
    <div>
      <div style={styles.row}>
        <input style={styles.input} value={ip} onChange={(e) => setIp(e.target.value)} placeholder="8.8.8.8" onKeyDown={(e) => e.key === "Enter" && lookup()} />
        <button style={styles.btn} onClick={lookup}>Look Up</button>
      </div>
      {error && <div style={styles.errorBox}>{error}</div>}
      {result && (
        <div style={styles.resultGrid}>
          <ResultCard label="Binary" value={result.binary} />
          <ResultCard label="Decimal (32-bit)" value={result.decimal.toLocaleString()} />
          <ResultCard label="Hex" value={result.hex} />
          <ResultCard label="Private or Public" value={result.isPrivate ? "Private" : "Public"} />
          <ResultCard label="Legacy Class" value={result.ipClass} />
          <ResultCard label="Reverse DNS Name" value={result.reverseDns} />
        </div>
      )}
    </div>
  );
}

function NetmaskTab() {
  const rows = netmaskTable();
  return (
    <table style={styles.table}>
      <thead>
        <tr><th style={styles.th}>CIDR</th><th style={styles.th}>Netmask</th><th style={styles.th}>Wildcard</th><th style={styles.th}>Total</th><th style={styles.th}>Usable Hosts</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.prefix}>
            <td style={styles.td}>/{r.prefix}</td>
            <td style={styles.td}>{r.netmask}</td>
            <td style={styles.td}>{r.wildcard}</td>
            <td style={styles.td}>{r.total.toLocaleString()}</td>
            <td style={styles.td}>{r.usable.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const TABS = [
  { id: "calc", label: "CIDR Calculator", Component: CidrCalculatorTab },
  { id: "split", label: "Split CIDR", Component: SplitCidrTab },
  { id: "ip", label: "IP Info", Component: IpInfoTab },
  { id: "netmask", label: "Netmask Table", Component: NetmaskTab },
];

const GLOSSARY = [
  { term: "CIDR (a.b.c.d/n)", meaning: "An IP address plus a prefix length — the /n says how many leading bits are the fixed \"network\" part; the rest are free for hosts." },
  { term: "Network Address", meaning: "The first address in the block (all host bits zero) — identifies the subnet itself, not a usable host." },
  { term: "Broadcast Address", meaning: "The last address in the block (all host bits one) — reaches every host on the subnet at once, also not usable for a single host." },
  { term: "Netmask", meaning: "The /n prefix written as a dotted-decimal address, e.g. /24 = 255.255.255.0 — same information, different notation." },
  { term: "Usable Hosts", meaning: "Total addresses minus the network and broadcast addresses (so /31 and /32 have none by this definition, though /31 is commonly used for point-to-point links)." },
  { term: "Private (RFC 1918)", meaning: "10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 — not routable on the public internet, safe to reuse internally." },
];

export default function IpCidrTool() {
  const [tab, setTab] = useState("calc");
  const Active = TABS.find((t) => t.id === tab).Component;

  return (
    <div style={styles.root}>
      <Header repoUrl={REPO_URL} />
      <div style={styles.content}>
      <h1 style={styles.title}>IP &amp; CIDR Toolkit</h1>
      <p style={styles.subtitle}>Subnet math, splitting, IP info, and a netmask reference — all computed locally, nothing leaves the browser.</p>
      <div style={styles.tabs}>
        {TABS.map((t) => (
          <button key={t.id} style={styles.tabBtn(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      <Active />

      <div style={styles.legendSection}>
        <div style={styles.sectionTitle}>Terms Explained</div>
        <table style={styles.legendTable}>
          <thead><tr><th style={styles.legendTh}>Term</th><th style={styles.legendTh}>Meaning</th></tr></thead>
          <tbody>
            {GLOSSARY.map((g) => (
              <tr key={g.term}><td style={styles.legendTd}>{g.term}</td><td style={{ ...styles.legendTd, fontFamily: "inherit" }}>{g.meaning}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
