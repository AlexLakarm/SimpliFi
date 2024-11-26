const hre = require("hardhat");
const { ethers } = require("hardhat");
const { getAddresses } = require("../config/addresses");

async function main() {
    const [deployer, admin, cgp, client] = await ethers.getSigners();
    console.log("Testing with accounts:");
    console.log("Admin:", admin.address);
    console.log("CGP:", cgp.address);
    console.log("Client:", client.address);

    // Récupérer les adresses
    const addresses = getAddresses();
    console.log("\nUsing addresses:", addresses);

    // Connecter les contrats
    const gUSDC = await ethers.getContractAt("gUSDC", addresses.gUSDC);
    const strategyOne = await ethers.getContractAt("StrategyOne", addresses.strategyOne);
    const roleControl = await ethers.getContractAt("RoleControl", addresses.roleControl);

    // Configuration des rôles
    console.log("\nSetting up roles...");
    await roleControl.connect(deployer).addAdmin(admin.address);
    console.log("✓ Admin role granted to:", admin.address);
    await roleControl.connect(admin).addCGP(cgp.address);
    console.log("✓ CGP role granted to:", cgp.address);
    await roleControl.connect(cgp).addClient(client.address);
    console.log("✓ Client role granted to:", client.address);

    // Vérifier les rôles
    console.log("\nVerifying roles...");
    const isAdmin = await roleControl.isAdmin(admin.address);
    const isCGP = await roleControl.isCGP(cgp.address);
    const isClient = await roleControl.isClient(client.address);
    console.log("Admin role verified:", isAdmin);
    console.log("CGP role verified:", isCGP);
    console.log("Client role verified:", isClient);

    // Transférer des gUSDC au client
    const amount = ethers.parseUnits("100", 6);
    await gUSDC.transfer(client.address, amount);
    console.log("\nTransferred 100 gUSDC to client");

    // 1. Vérifier les détails de la stratégie
    console.log("\n1. Checking strategy details...");
    const details = await strategyOne.getStrategyDetails();
    console.log("Underlying Token:", details.underlyingToken);
    console.log("Current Yield:", details.currentYield.toString(), "%");
    console.log("Duration:", details.duration.toString(), "seconds");
    console.log("Rate:", details.rate.toString());

    // Vérifier les frais initiaux
    console.log("\nInitial Fees Status:");
    const initialProtocolFees = await strategyOne.getProtocolFees();
    const initialCGPFees = await strategyOne.getCGPFees(cgp.address);
    console.log("Protocol Non-Matured Fees:", ethers.formatUnits(initialProtocolFees.nonMaturedFees, 6));
    console.log("Protocol Matured Non-Withdrawn Fees:", ethers.formatUnits(initialProtocolFees.maturedNonWithdrawnFees, 6));
    console.log("Protocol Withdrawn Fees:", ethers.formatUnits(initialProtocolFees.withdrawnFees, 6));
    console.log("CGP Non-Matured Fees:", ethers.formatUnits(initialCGPFees.nonMaturedFees, 6));
    console.log("CGP Matured Non-Withdrawn Fees:", ethers.formatUnits(initialCGPFees.maturedNonWithdrawnFees, 6));
    console.log("CGP Withdrawn Fees:", ethers.formatUnits(initialCGPFees.withdrawnFees, 6));

    // 2. Entrer dans la stratégie
    console.log("\n2. Entering strategy...");
    await gUSDC.connect(client).approve(addresses.strategyOne, amount);
    console.log("Approved StrategyOne to spend gUSDC");

    const enterTx = await strategyOne.connect(client).enterStrategy(amount);
    const enterReceipt = await enterTx.wait();

    // Récupérer les événements
    const enterEvent = enterReceipt.logs.find(
        log => log.fragment && log.fragment.name === 'StrategyEntered'
    );
    const pendingFeesEvent = enterReceipt.logs.find(
        log => log.fragment && log.fragment.name === 'PendingFeesUpdated'
    );

    console.log("\nStrategy Entry Details:");
    console.log("Position ID:", enterEvent.args.positionId.toString());
    console.log("Amount Invested:", ethers.formatUnits(enterEvent.args.amount, 6), "gUSDC");
    console.log("PT Received:", ethers.formatUnits(enterEvent.args.ptReceived, 6), "PT");
    console.log("Entry Date:", new Date(Number(enterEvent.args.entryDate) * 1000).toLocaleString());
    console.log("Maturity Date:", new Date(Number(enterEvent.args.maturityDate) * 1000).toLocaleString());

    // Vérifier les frais après entrée
    console.log("\nPending Fees After Entry:");
    const postEntryProtocolFees = await strategyOne.getProtocolFees();
    const postEntryCGPFees = await strategyOne.getCGPFees(cgp.address);
    console.log("Protocol Pending Fees:", ethers.formatUnits(postEntryProtocolFees.nonMaturedFees, 6));
    console.log("CGP Pending Fees:", ethers.formatUnits(postEntryCGPFees.nonMaturedFees, 6));

    // 3. Avancer le temps
    console.log("\n3. Advancing time...");
    await ethers.provider.send("evm_increaseTime", [250 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");
    console.log("Time advanced by 250 days (70 days after maturity)");

    // 4. Sortir de la stratégie
    console.log("\n4. Exiting strategy...");
    const exitTx = await strategyOne.connect(client).exitStrategy(enterEvent.args.positionId);
    const exitReceipt = await exitTx.wait();

    const exitEvent = exitReceipt.logs.find(
        log => log.fragment && log.fragment.name === 'StrategyExited'
    );
    const feesCollectedEvent = exitReceipt.logs.find(
        log => log.fragment && log.fragment.name === 'FeesCollected'
    );

    console.log("\nStrategy Exit Details:");
    console.log("Initial Amount:", ethers.formatUnits(exitEvent.args.initialAmount, 6), "gUSDC");
    console.log("Final Amount:", ethers.formatUnits(exitEvent.args.finalAmount, 6), "gUSDC");
    console.log("Total Yield:", ethers.formatUnits(exitEvent.args.yieldEarned, 6), "gUSDC");

    console.log("\nAmount Distribution:");
    console.log("Total Received from Router:", ethers.formatUnits(exitEvent.args.finalAmount, 6), "gUSDC");
    console.log("Amount to Client:", ethers.formatUnits(exitEvent.args.finalAmount - feesCollectedEvent.args.cgpAmount - feesCollectedEvent.args.protocolAmount, 6), "gUSDC");
    console.log("CGP Fee:", ethers.formatUnits(feesCollectedEvent.args.cgpAmount, 6), "gUSDC");
    console.log("Protocol Fee:", ethers.formatUnits(feesCollectedEvent.args.protocolAmount, 6), "gUSDC");

    // Vérifier les frais finaux
    console.log("\nFinal Fees Status:");
    const finalProtocolFees = await strategyOne.getProtocolFees();
    const finalCGPFees = await strategyOne.getCGPFees(cgp.address);
    console.log("Protocol Non-Matured Fees:", ethers.formatUnits(finalProtocolFees.nonMaturedFees, 6));
    console.log("Protocol Matured Non-Withdrawn Fees:", ethers.formatUnits(finalProtocolFees.maturedNonWithdrawnFees, 6));
    console.log("Protocol Withdrawn Fees:", ethers.formatUnits(finalProtocolFees.withdrawnFees, 6));
    console.log("CGP Non-Matured Fees:", ethers.formatUnits(finalCGPFees.nonMaturedFees, 6));
    console.log("CGP Matured Non-Withdrawn Fees:", ethers.formatUnits(finalCGPFees.maturedNonWithdrawnFees, 6));
    console.log("CGP Withdrawn Fees:", ethers.formatUnits(finalCGPFees.withdrawnFees, 6));

    // 5. Test de retrait des frais
    console.log("\n5. Testing fee withdrawal...");
    
    // Admin retire les frais du protocole
    const protocolWithdrawTx = await strategyOne.connect(admin).withdrawProtocolFees();
    const protocolWithdrawReceipt = await protocolWithdrawTx.wait();
    
    // CGP retire ses frais
    const cgpWithdrawTx = await strategyOne.connect(cgp).withdrawCGPFees();
    const cgpWithdrawReceipt = await cgpWithdrawTx.wait();

    console.log("\nFees after withdrawal:");
    const afterWithdrawProtocolFees = await strategyOne.getProtocolFees();
    const afterWithdrawCGPFees = await strategyOne.getCGPFees(cgp.address);
    console.log("Protocol Collected Fees:", ethers.formatUnits(afterWithdrawProtocolFees.withdrawnFees, 6), "gUSDC");
    console.log("CGP Collected Fees:", ethers.formatUnits(afterWithdrawCGPFees.withdrawnFees, 6), "gUSDC");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 