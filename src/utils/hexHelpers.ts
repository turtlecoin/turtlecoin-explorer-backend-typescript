export const hexToIp = (hex: string) => {
  const octets = [];
  for (const o of hex.match(/.{1,2}/g)!) {
    octets.push(parseInt(o, 16));
  }
  return octets.join('.');
};

export const hexToPort = (hex: string) => parseInt(hex, 16);
