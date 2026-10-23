
/**
 * IPv4 CIDR such as 10.0.0.0/16. Unlike the shell's isValidCIDR since 3.0.14, it rejects the short forms
 * (10.1/16), extra parts (10.0.0.0/24/1), zero-padded octets (010.0.0.0/8) and IPv6, which the network settings
 * don't support
 */
export function isValidCIDR(cidr) {
  return /^((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\/(3[0-2]|[12]?[0-9])$/.test(cidr || '');
}

export function isValidMac(value) {
  return /^[A-Fa-f0-9]{2}(-[A-Fa-f0-9]{2}){5}$|^[A-Fa-f0-9]{2}(:[A-Fa-f0-9]{2}){5}$/.test(value);
}

/**
 * RFC 1123
 * https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#dns-label-names
 */
export function isValidDNSLabelName(str) {
  const reg = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

  return reg.test(str);
}
