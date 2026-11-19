import type { IridiumConfig } from '@iridium-group/config';
import {
  getEffectivePort,
  isLoopbackAddress,
  isPrivateAddress,
  normalizeAddress,
  parseUrl,
  redactUrlCredentials,
} from '@iridium-group/utils';

export interface UrlCheck {
  /** The input with any credentials removed, safe to print. */
  input: string;
  /** True when the configuration lets the proxy fetch this URL. */
  allowed: boolean;
  /** Why the URL is allowed or blocked, one entry per rule that applied. */
  reasons: string[];
  protocol?: string;
  hostname?: string;
  port?: number;
}

const SCHEMES = new Set(['http:', 'https:', 'ws:', 'wss:']);

/** Whether `hostname` names the local machine without being an IP literal. */
function isLocalName(hostname: string): boolean {
  return hostname === 'localhost' || hostname.endsWith('.localhost');
}

/**
 * Decide what the given security settings do with a URL. Only the URL text is examined: a name
 * that resolves to a private address is not caught here, which is why the proxy checks again
 * after resolution.
 */
export function checkUrl(raw: string, config: Pick<IridiumConfig, 'security'>): UrlCheck {
  const result: UrlCheck = { input: redactUrlCredentials(raw), allowed: true, reasons: [] };
  const url = parseUrl(raw);
  if (!url) {
    return { ...result, allowed: false, reasons: ['not a valid absolute URL'] };
  }
  result.protocol = url.protocol;
  if (!SCHEMES.has(url.protocol)) {
    result.allowed = false;
    result.reasons.push(`scheme ${url.protocol} is not http, https, ws or wss`);
  }

  const bare = url.hostname.replace(/^\[|\]$/g, '');
  result.hostname = bare;
  const port = getEffectivePort(url);
  if (port !== undefined) result.port = port;

  const { security } = config;
  if (port !== undefined) {
    if (security.allowedPorts && !security.allowedPorts.includes(port)) {
      result.allowed = false;
      result.reasons.push(`port ${port} is not in allowedPorts`);
    } else if (security.blockedPorts.includes(port)) {
      result.allowed = false;
      result.reasons.push(`port ${port} is in blockedPorts`);
    }
  }

  const address = normalizeAddress(bare);
  const local = address
    ? isLoopbackAddress(address) || isPrivateAddress(address)
    : isLocalName(bare);
  if (local && security.blockPrivateAddresses) {
    result.allowed = false;
    result.reasons.push(`${bare} is a private or loopback address and blockPrivateAddresses is on`);
  } else if (local) {
    result.reasons.push(
      `${bare} is a private or loopback address, allowed because blockPrivateAddresses is off`,
    );
  }

  if (result.allowed && result.reasons.length === 0) {
    result.reasons.push('no security rule matched');
  }
  return result;
}
