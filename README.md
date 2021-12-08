# Lyra Vault

[![Coverage Status](https://coveralls.io/repos/github/rokusk/lyra-vaults/badge.svg?branch=master)](https://coveralls.io/github/rokusk/lyra-vaults?branch=master)

### Install

```bash
yarn install
```

### Test

```bash
yarn test

yarn coverage
```

### Lint

```
# run lint check
yarn lint

# fix contract
yarn prettier:sol
```

### Deploy
this project use [hardhat-deployment](https://github.com/wighawag/hardhat-deploy). You can find all the deployment script in `deploy/` folder.
```
npx hardhat deploy --network kovan
```

## Deployments
The project is still WIP, we only deploy to Kovan to test some simple on-chain behavior. Don't rely on these addresses for your own deployment ;) 

| Contract         | Address (Kovan Testnet)                                    |
|------------------|--------------------------------------------|
| MockOptionMarket | 0xB2e699aEb5c0204276C834f25b51E97776d06920 |
| MockSynthetix    | 0x21859659ffDfb57eA82E38D804a031D02046A95e |
| TestSUSD         | 0x4DA634E55c21fE2Da9c8F5DA49F9CfeB3F436dEb |
| TestSETH         | 0x1E5d64B650388A727E5dc68c0C70c2d3c7983c5e |
| LyraVault        | 0x763a570A50B4cE44B5897B2134010CFC4f770b2F |
| MockStrategy | 0x519c30A315b0E59FCecac65a626cA46016B5D413 | 
