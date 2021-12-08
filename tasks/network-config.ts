export enum Networks {
  KOVAN_OVM = 'kovan-ovm',
  KOVAN = 'kovan',
}

export const lyraOptionMarket: { [key in Networks]: string | undefined } = {
  [Networks.KOVAN]: undefined,
  [Networks.KOVAN_OVM]: '0xb43285B5aF7cad80409e1267Ea21ECB44eEF4a0E',
};

export const sUSDAddress: { [key in Networks]: string | undefined } = {
  [Networks.KOVAN]: undefined,
  [Networks.KOVAN_OVM]: '0x84B6b512E8F416981a27d33E210A1886e29791aB',
};

export const sETHAddress: { [key in Networks]: string | undefined } = {
  [Networks.KOVAN]: undefined,
  [Networks.KOVAN_OVM]: '0x2818E5083696E6EB78613b40c0f18Eb47bE55701',
};

export const synthetixAddress: { [key in Networks]: string | undefined } = {
  [Networks.KOVAN]: undefined,
  [Networks.KOVAN_OVM]: '0x4194f283bC35521Ab503Fc2c4ee42E4Dc9aE10Ff',
};
