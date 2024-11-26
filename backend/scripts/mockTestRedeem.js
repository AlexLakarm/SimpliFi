const hre = require("hardhat");
const { ethers } = require("hardhat");
const { getAddresses } = require("../config/addresses");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Testing with account:", deployer.address);

    // Récupérer les adresses depuis le fichier
    const addresses = getAddresses();
    console.log("Using deployed addresses:", addresses);

    // Récupérer les contrats avec les adresses du fichier
    const gUSDC = await ethers.getContractAt("gUSDC", addresses.gUSDC);
    const ptgUSDC = await ethers.getContractAt("PtgUSDC", addresses.ptgUSDC);
    const router = await ethers.getContractAt("MockPendleRouter", addresses.router);

    console.log("\n1. Checking initial balances...");
    const initialGUSDC = await gUSDC.balanceOf(deployer.address);
    console.log("Initial gUSDC balance:", ethers.formatUnits(initialGUSDC, 6));

    // 2. Approuver et faire le swap
    console.log("\n2. Performing swap...");
    const swapAmount = ethers.parseUnits("100", 6);
    await gUSDC.approve(router.target, swapAmount);
    const swapTx = await router.swapExactTokenForPt(gUSDC.target, swapAmount);
    const swapReceipt = await swapTx.wait();

    const swapEvent = swapReceipt.logs.find(log => log.fragment && log.fragment.name === 'Swapped');
    const ptReceived = swapEvent.args.outputAmount;
    const maturityDate = swapEvent.args.maturityDate;

    console.log("\nSwap Details:");
    console.log("gUSDC spent:", ethers.formatUnits(swapAmount, 6));
    console.log("PT received:", ethers.formatUnits(ptReceived, 6));
    console.log("Maturity Date:", new Date(Number(maturityDate) * 1000).toLocaleString());

    // Vérifier les balances après le swap
    const postSwapGUSDC = await gUSDC.balanceOf(deployer.address);
    const postSwapPT = await ptgUSDC.balanceOf(deployer.address);
    console.log("\nPost-Swap Balances:");
    console.log("gUSDC balance:", ethers.formatUnits(postSwapGUSDC, 6));
    console.log("PT balance:", ethers.formatUnits(postSwapPT, 6));

    // 3. Avancer le temps
    console.log("\n3. Advancing time...");
    await ethers.provider.send("evm_increaseTime", [180 * 24 * 60 * 60]); // 180 jours
    await ethers.provider.send("evm_mine");
    console.log("Time advanced by 180 days");

    // 4. Approuver et redeem
    console.log("\n4. Performing redeem...");
    
    // Vérifier la balance PT et l'allowance avant l'approbation
    const ptBalanceBeforeApprove = await ptgUSDC.balanceOf(deployer.address);
    const currentAllowance = await ptgUSDC.allowance(deployer.address, router.target);
    console.log("\nBefore approval:");
    console.log("PT Balance:", ethers.formatUnits(ptBalanceBeforeApprove, 6));
    console.log("Current Allowance:", ethers.formatUnits(currentAllowance, 6));

    // Approuver en utilisant le montant de la stratégie
    const strategy = await router.getActiveStrategy(deployer.address, maturityDate);
    console.log("\nStrategy details:");
    console.log("Strategy Amount:", ethers.formatUnits(strategy.amount, 6));
    
    await ptgUSDC.approve(router.target, strategy.amount);
    console.log("Approved amount:", ethers.formatUnits(strategy.amount, 6));

    // Vérifier l'allowance après approbation
    const newAllowance = await ptgUSDC.allowance(deployer.address, router.target);
    console.log("New Allowance:", ethers.formatUnits(newAllowance, 6));

    const redeemTx = await router.redeemPyToToken(gUSDC.target, maturityDate);
    const redeemReceipt = await redeemTx.wait();

    // 5. Vérifier les résultats
    console.log("\n5. Final results:");
    const finalGUSDC = await gUSDC.balanceOf(deployer.address);
    const finalPT = await ptgUSDC.balanceOf(deployer.address);

    console.log("\nBalance Changes:");
    console.log("Initial gUSDC:", ethers.formatUnits(initialGUSDC, 6));
    console.log("Final gUSDC:", ethers.formatUnits(finalGUSDC, 6));
    console.log("Net gUSDC change:", ethers.formatUnits(finalGUSDC - initialGUSDC, 6));
    console.log("Final PT balance:", ethers.formatUnits(finalPT, 6));

    // Récupérer l'événement PtRedeemed
    const redeemEvent = redeemReceipt.logs.find(
        log => log.fragment && log.fragment.name === 'PtRedeemed'
    );

    console.log("\nRedeem Event Details:");
    console.log("Principal:", ethers.formatUnits(redeemEvent.args.principal, 6));
    console.log("Yield Amount:", ethers.formatUnits(redeemEvent.args.yieldAmount, 6));
    console.log("Total Amount:", ethers.formatUnits(redeemEvent.args.totalAmount, 6));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 