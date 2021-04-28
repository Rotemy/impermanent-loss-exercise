//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";
import "contracts/IMasterChef.sol";
import "contracts/IUniswapV2Pair.sol";
import "contracts/IUniswapV2Router02.sol";

contract Vault {

    using SafeMath for uint256;

    //address public constant uniswapRouterV2 = address(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);

    address internal slp = address(0x397FF1542f962076d0BFE58eA045FfA2d347ACa0);
    address internal master_chef = address(0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd);
    address internal sushi_token = address(0x6B3595068778DD592e39A122f4f5a5cF09C90fE2);
    address internal sushiswapRouterV2 = address(0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F);

    mapping (address => uint256) private _balances;
    uint256 internal _totalSupply;

    address[] routesToken0;
    address[] routesToken1;

    constructor () {
        address uniLPComponentToken0 = IUniswapV2Pair(underlying()).token0();
        address uniLPComponentToken1 = IUniswapV2Pair(underlying()).token1();

        routesToken0.push(sushi_token);
        routesToken0.push(uniLPComponentToken0);
        routesToken1.push(sushi_token);
        routesToken1.push(uniLPComponentToken1);
    }

    function doHardWork() external {
        console.log("- Vault -", "Do Hard Work");
        exitRewardPool();
        _liquidateReward();
        investAllUnderlying();
    }

    function deposit(uint256 amount) public {
        _mint(msg.sender, amount);
        IERC20(underlying()).transferFrom(msg.sender, address(this), amount);
        investAllUnderlying();
    }

    function withdraw(uint256 numberOfShares) external {
        require(totalSupply() > 0, "Vault has no shares");
        require(numberOfShares > 0, "numberOfShares must be greater than 0");
        require(numberOfShares <= _balances[msg.sender], "numberOfShares is greater than balance");
        uint256 totalSupply = totalSupply();
        _burn(msg.sender, numberOfShares);

        console.log("----");

        uint256 underlyingAmountToWithdraw = rewardPoolBalance().mul(numberOfShares).div(totalSupply);

        withdrawToVault(underlyingAmountToWithdraw);

        IERC20(underlying()).approve(address(this), 0);
        IERC20(underlying()).approve(address(this), underlyingAmountToWithdraw);
        IERC20(underlying()).transferFrom(address(this), msg.sender, underlyingAmountToWithdraw);
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    // ---------------------------------------------------------------------------------- //

    function withdrawToVault(uint256 amount) internal {
        IMasterChef(rewardPool()).withdraw(poolId(), amount);
    }

    function _liquidateReward() internal {
        uint256 remainingRewardBalance = IERC20(rewardToken()).balanceOf(address(this));
        console.log("- Vault -", "Sushi balance ", remainingRewardBalance);

        address uniLPComponentToken0 = IUniswapV2Pair(underlying()).token0();
        address uniLPComponentToken1 = IUniswapV2Pair(underlying()).token1();

        address routerV2 = sushiswapRouterV2;

        if (remainingRewardBalance > 0 // we have tokens to swap
        && routesToken0.length > 1 // and we have a route to do the swap
            && routesToken1.length > 1 // and we have a route to do the swap
        ) {

            // allow Uniswap to sell our reward
            uint256 amountOutMin = 1;

            IERC20(rewardToken()).approve(routerV2, 0);
            IERC20(rewardToken()).approve(routerV2, remainingRewardBalance);

            uint256 toToken0 = remainingRewardBalance / 2;
            uint256 toToken1 = remainingRewardBalance.sub(toToken0);

            // we sell to uni

            console.log("- Vault -", "Swapping", toToken0, "sushi to USDC");

            // sell Uni to token1
            // we can accept 1 as minimum because this is called only by a trusted role
            IUniswapV2Router02(routerV2).swapExactTokensForTokens(
                toToken0,
                amountOutMin,
                routesToken0,
                address(this),
                block.timestamp
            );
            uint256 token0Amount = IERC20(uniLPComponentToken0).balanceOf(address(this));

            console.log("- Vault - Got", token0Amount, "USDC");

            console.log("- Vault -", "Swapping", toToken1, "sushi to wETH");

            // sell Uni to token2
            // we can accept 1 as minimum because this is called only by a trusted role
            IUniswapV2Router02(routerV2).swapExactTokensForTokens(
                toToken1,
                amountOutMin,
                routesToken1,
                address(this),
                block.timestamp
            );
            uint256 token1Amount = IERC20(uniLPComponentToken1).balanceOf(address(this));

            console.log("- Vault -", "Got", token1Amount, "wETH");

            // provide token1 and token2 to SUSHI
            IERC20(uniLPComponentToken0).approve(sushiswapRouterV2, 0);
            IERC20(uniLPComponentToken0).approve(sushiswapRouterV2, token0Amount);

            IERC20(uniLPComponentToken1).approve(sushiswapRouterV2, 0);
            IERC20(uniLPComponentToken1).approve(sushiswapRouterV2, token1Amount);

            // we provide liquidity to sushi
            uint256 liquidity;
            (,,liquidity) = IUniswapV2Router02(sushiswapRouterV2).addLiquidity(
                uniLPComponentToken0,
                uniLPComponentToken1,
                token0Amount,
                token1Amount,
                1,  // we are willing to take whatever the pair gives us
                1,  // we are willing to take whatever the pair gives us
                address(this),
                block.timestamp
            );

            console.log("- Vault -", "added new liquidity, got", liquidity, "SLP");
        }
    }

    function rewardPoolBalance() internal view returns (uint256 bal) {
        return IMasterChef(rewardPool()).userInfo(poolId(), address(this)).amount;
    }

    function exitRewardPool() internal {
        uint256 bal = rewardPoolBalance();
        if (bal != 0) {
            console.log("- Vault -", "SLP Balance ", bal);
            IMasterChef(rewardPool()).withdraw(poolId(), bal);
        }
    }

    function investAllUnderlying() internal {
        if(underlyingBalanceInVault() > 0) {
            enterRewardPool();
        }
    }

    function underlyingBalanceInVault() internal view returns (uint256) {
        return IERC20(underlying()).balanceOf(address(this));
    }

    function enterRewardPool() internal {
        uint256 entireBalance = underlyingBalanceInVault();
        console.log("- Vault -", "SLP Balance", entireBalance);
        IERC20(underlying()).approve(rewardPool(), 0);
        IERC20(underlying()).approve(rewardPool(), entireBalance);
        IMasterChef(rewardPool()).deposit(poolId(), entireBalance);
        console.log("- Vault -", "Deposite SLP into masterchef", entireBalance);
    }

    function poolId() internal pure returns (uint16) {
        return 1;
    }

    function rewardToken() internal view returns (address) {
        return sushi_token;
    }

    function rewardPool() internal view returns (address) {
        return master_chef;
    }

    function underlying() internal view returns (address) {
        return slp;
    }

    function balanceOf() public view returns (uint256) {
        return _balances[msg.sender];
    }

    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: mint to the zero address");

        _totalSupply = _totalSupply.add(amount);
        _balances[account] = _balances[account].add(amount);
    }

    function _burn(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: burn from the zero address");

        _balances[account] = _balances[account].sub(amount, "ERC20: burn amount exceeds balance");
        _totalSupply = _totalSupply.sub(amount);
    }

}
