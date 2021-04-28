//require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ganache");
require("@nomiclabs/hardhat-web3");
require("@nomiclabs/hardhat-waffle");

task("balance", "Prints an account's balance")
    .addParam("account", "The account's address")
    .setAction(async taskArgs => {
      const account = web3.utils.toChecksumAddress(taskArgs.account);
      const balance = await web3.eth.getBalance(account);

      console.log("Got", web3.utils.fromWei(balance, "ether"), "ETH");
    });

task("blockNumber", "Prints latest block number")
    .setAction(async ()=> {
       console.log(await web3.eth.getBlockNumber());
    });

task("deployContract", "Deploys the contract")
    .setAction(async ()=> {

        await run("getMoney");

        const Vault = await ethers.getContractFactory("Vault");
        const vault = await Vault.deploy();

        const vaultContract = new web3.eth.Contract(require('./artifacts/contracts/Vault.sol/Vault').abi, vault.address);

        console.log("Approving Vault to transfer SLP");

        const slpContract = new web3.eth.Contract(require('./slp_abi'), '0x397FF1542f962076d0BFE58eA045FfA2d347ACa0');
        await slpContract.methods.approve(vault.address, web3.utils.toWei('1000', 'ether')).send({from: '0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5'});

        console.log("Vault can transfer", await slpContract.methods.allowance('0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5', vault.address).call(), "SLP");

        const slpBalance = await slpContract.methods.balanceOf('0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5').call({from: '0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5'});

        console.log("Deposit", slpBalance, "SLP to vault");

        await vaultContract.methods.deposit(slpBalance).send({from: '0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5'});

        const numOfBlocks = 10000;

        console.log(`Mining ${numOfBlocks} blocks...`);

        for (let i = 0; i < numOfBlocks; i++) {
            await network.provider.send("evm_mine")
        }
        console.log(`Done Mining ${numOfBlocks} blocks`);

        console.log("Running do hard work");

        await vaultContract.methods.doHardWork().send({from: '0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5'});

        console.log("Withdrawing...");

        await vaultContract.methods.withdraw(slpBalance).send({from: '0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5'});

        const newSlpBalance = await slpContract.methods.balanceOf('0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5').call({from: '0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5'});

        console.log(`OMG, I just made ${newSlpBalance - slpBalance} SLPs`);
    });

task ("getEther", "Get ether")
    .setAction(async () => {

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0x912fD21d7a69678227fE6d08C64222Db41477bA0"]}
        );
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5"]}
        );

        console.log("Getting ether...");

        await web3.eth.sendTransaction({
            from: '0x912fD21d7a69678227fE6d08C64222Db41477bA0',
            to: '0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5',
            value: web3.utils.toWei('100', 'ether')
        }).on('transactionHash', function(hash){
            // console.log("transactionHash");
        }).on('receipt', function(receipt){
            // console.log("receipt");
        }).on('confirmation', function(confirmationNumber, receipt){
            // console.log("confirmation");
        }).on('error', console.error); // If a out of gas error, the second parameter is the receipt.;

        await run("balance", {account: "0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5"});

    });

task("getMoney", "Gets money haha")
    .setAction(async () => {

        await run("getEther");

        const usdcContract = new web3.eth.Contract(require('./usdc_abi'), '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');

        console.log("Current USDC Balance", await usdcContract.methods.balanceOf('0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5').call({from: '0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5'}));

        console.log("Getting USDC...");

        await usdcContract.methods.transfer('0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5', web3.utils.toWei('100000', 'lovelace')).send({from: '0x912fD21d7a69678227fE6d08C64222Db41477bA0'});

        console.log("Got", await usdcContract.methods.balanceOf('0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5').call({from: '0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5'}), "USDC");

        const wEthContract = new web3.eth.Contract(require('./weth_abi'), '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2');

        console.log("Current wETH Balance", await wEthContract.methods.balanceOf('0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5').call({from: '0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5'}));

        await wEthContract.methods.deposit().send({from: '0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5', value: web3.utils.toWei('99', 'ether')});

        console.log("Got", await wEthContract.methods.balanceOf('0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5').call({from: '0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5'}), "wETH");

        const sushiSwapContract = new web3.eth.Contract(require('./sushi_swap_abi'), '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F');

        console.log("Approving Sushi Swap");

        await wEthContract.methods.approve(sushiSwapContract.options.address, web3.utils.toWei('1000', 'ether')).send({from: '0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5'});
        await usdcContract.methods.approve(sushiSwapContract.options.address, web3.utils.toWei('100000', 'lovelace')).send({from: '0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5'});

        const slpContract = new web3.eth.Contract(require('./slp_abi'), '0x397FF1542f962076d0BFE58eA045FfA2d347ACa0');

        console.log("Current SLP Balance", await slpContract.methods.balanceOf('0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5').call({from: '0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5'}));

        console.log("Adding USDC/ETH Liquidity...");

        await sushiSwapContract.methods.addLiquidity(
            wEthContract.options.address,
            usdcContract.options.address,
            web3.utils.toWei('10', 'ether'),
            web3.utils.toWei('50000', 'lovelace'),
            1, // min weth
            1, // min usdc
            '0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5', // to
            new Date().getTime() + (5 * 60 * 1000)
        ).send({from: '0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5'});

        console.log("Got", await slpContract.methods.balanceOf('0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5').call({from: '0xCADfB37bDADb4a5D486cfb1CaCbAA76E54e1F2c5'}), "SLP");

        //             await network.provider.send("evm_mine")

    });

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.0",
  networks: {
    hardhat: {
      forking: {
        url: "https://eth-mainnet.alchemyapi.io/v2/T2CqQfiMJI3yJa1BTnfQfPG6hcfir7Tn",
        blockNumber: 12225322
      }
    }
  }
};

