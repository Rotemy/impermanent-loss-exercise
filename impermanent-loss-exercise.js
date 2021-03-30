const Web3 = require("web3");
const provider = new Web3.providers.HttpProvider("https://mainnet.infura.io/v3/df6c26dac3864c87a31c336a2117ac32");
const Contract = require('web3-eth-contract');
Contract.setProvider(provider);

const TOKEN_TYPES = {
    stable: 0,
    volatile: 1
};

const minABI = [
    // decimals
    {
        "constant":true,
        "inputs":[],
        "name":"decimals",
        "outputs":[{"name":"","type":"uint8"}],
        "type":"function"
    }
];

const getContractDecimal = async (contract, fromAddress) => {
    const result = await contract.methods.decimals().call({from: fromAddress});
    return Number(`1e${result}`);
};

const getTokenDecimal = async (uniswapLPContract, tokenNumber, fromAddress) => {
    const tokenAddress = await uniswapLPContract.methods[`token${tokenNumber}`]().call({from: fromAddress});
    const contract = new Contract(minABI, tokenAddress);
    return getContractDecimal(contract, fromAddress);
};

const getTokenReserves = async (uniswapLPContract, fromAddress) => {
    const result = await uniswapLPContract.methods.getReserves().call({from: fromAddress});

    const tokenStableDecimal = await getTokenDecimal(uniswapLPContract, TOKEN_TYPES.stable, fromAddress);
    const tokenVolatileDecimal = await getTokenDecimal(uniswapLPContract, TOKEN_TYPES.volatile, fromAddress);

    return {
        stableTokenReserves: Number(result[TOKEN_TYPES.stable]) / tokenStableDecimal,
        volatileTokenReserves: Number(result[TOKEN_TYPES.volatile]) / tokenVolatileDecimal
    }
};

(async (uniswapLPContractABI, uniswapLPContractAddress, lpWalletAddress, stableCoinAmount, volatileCoinAmount) => {

    const uniswapLPContract = new Contract(uniswapLPContractABI, uniswapLPContractAddress);

    const reserves = await getTokenReserves(uniswapLPContract, lpWalletAddress);

    const volatileCoinPriceInUSD = reserves.stableTokenReserves / reserves.volatileTokenReserves;
    const contractDecimal = await getContractDecimal(uniswapLPContract, lpWalletAddress);
    const totalSupply = Number(await uniswapLPContract.methods.totalSupply().call({from: lpWalletAddress})) / contractDecimal;
    const pricePerUnit = ((reserves.volatileTokenReserves * volatileCoinPriceInUSD) + reserves.stableTokenReserves) / totalSupply;

    const lpBalance = Number(await uniswapLPContract.methods.balanceOf(lpWalletAddress).call({from: lpWalletAddress})) / contractDecimal;

    const currentValueInUSD = lpBalance * pricePerUnit;
    const couldHaveBeValueInUSD = stableCoinAmount + (volatileCoinAmount * volatileCoinPriceInUSD);

    console.log(`The impermanent loss is ${couldHaveBeValueInUSD - currentValueInUSD} USD`);

})(
    require('./uniswap-usdc-eth-lp-abi'),
    '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc',
    '0xFcd300AaFE1fDB3166cd1A3B46463144fc2D46ad',
    100,
    0.062
);