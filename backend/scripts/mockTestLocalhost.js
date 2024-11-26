const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);

    // 1. Déploiement
    console.log("\n1. Deploying contracts...");
    
    const gUSDC = await hre.ethers.deployContract("gUSDC", [ethers.parseUnits("1000000", 6)]);
    await gUSDC.waitForDeployment();
    console.log("gUSDC deployed to:", gUSDC.target);

    const ptgUSDC = await hre.ethers.deployContract("PtgUSDC", []);
    await ptgUSDC.waitForDeployment();
    console.log("PtgUSDC deployed to:", ptgUSDC.target);

    const oracle = await hre.ethers.deployContract("MockPriceOracle", []);
    await oracle.waitForDeployment();
    console.log("Oracle deployed to:", oracle.target);

    const router = await hre.ethers.deployContract("MockPendleRouter", [
        gUSDC.target,
        ptgUSDC.target,
        oracle.target
    ]);
    await router.waitForDeployment();
    console.log("Router deployed to:", router.target);

    // 2. Configuration
    console.log("\n2. Setting up contracts...");
    
    await ptgUSDC.transferOwnership(router.target);
    console.log("PtgUSDC ownership transferred to Router");

    const yield = 10; // 10%
    const duration = 180 * 24 * 60 * 60; // 180 days
    await oracle.setRateAndPrice(ptgUSDC.target, yield);
    await oracle.setDuration(ptgUSDC.target, duration);
    console.log("Oracle configured with yield:", yield, "% and duration:", duration, "seconds");

    // 3. Test Swap
    console.log("\n3. Testing swap...");
    
    const swapAmount = ethers.parseUnits("100", 6);
    await gUSDC.approve(router.target, swapAmount);
    console.log("Approved Router to spend gUSDC");

    const swapTx = await router.swapExactTokenForPt(gUSDC.target, swapAmount);
    const swapReceipt = await swapTx.wait();
    
    const swapEvent = swapReceipt.logs.find(
        log => log.fragment && log.fragment.name === 'Swapped'
    );

    console.log("\nSwap Results:");
    console.log("Input Amount (gUSDC):", ethers.formatUnits(swapEvent.args.inputAmount, 6));
    console.log("Output Amount (PT):", ethers.formatUnits(swapEvent.args.outputAmount, 6));
    console.log("Maturity Date:", new Date(Number(swapEvent.args.maturityDate) * 1000).toLocaleString());

    // 4. Get Strategy Details
    const strategy = await router.getActiveStrategy(deployer.address, swapEvent.args.maturityDate);
    console.log("\nStrategy Details:");
    console.log("Annual Yield:", strategy.annualYield.toString(), "%");
    console.log("Duration:", strategy.duration.toString(), "seconds");
    console.log("Entry Rate:", strategy.entryRate.toString());
    console.log("Amount:", ethers.formatUnits(strategy.amount, 6));

    return {
        gUSDC: gUSDC.target,
        ptgUSDC: ptgUSDC.target,
        oracle: oracle.target,
        router: router.target,
        maturityDate: swapEvent.args.maturityDate
    };
}

main()
    .then((addresses) => {
        console.log("\nDeployed Addresses:", addresses);
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 