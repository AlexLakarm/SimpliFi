const hre = require("hardhat");
const { updateAddresses } = require("../../config/addresses");

async function main() {
    // Récupérer le déployeur
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());
    console.log("Network:", network.name);

    console.log("Starting deployment on Holesky...");

    // 1. Déploiement de gUSDC
    console.log("\n1. Deploying gUSDC...");
    const initialSupply = ethers.parseUnits("1000000", 6); // 1M gUSDC avec 6 décimales
    const gUSDC = await hre.ethers.deployContract("gUSDC", [initialSupply]);
    await gUSDC.waitForDeployment();
    // Attendre quelques confirmations sur testnet
    const gUSDCReceipt = await gUSDC.deploymentTransaction().wait(2);
    console.log(`gUSDC deployed to: ${gUSDC.target}`);
    console.log(`Gas used: ${gUSDCReceipt.gasUsed}`);

    // 2. Déploiement de PtgUSDC
    console.log("\n2. Deploying PtgUSDC...");
    const ptgUSDC = await hre.ethers.deployContract("PtgUSDC", []);
    await ptgUSDC.waitForDeployment();
    const ptgUSDCReceipt = await ptgUSDC.deploymentTransaction().wait(2);
    console.log(`PtgUSDC deployed to: ${ptgUSDC.target}`);
    console.log(`Gas used: ${ptgUSDCReceipt.gasUsed}`);

    // 3. Déploiement de l'Oracle
    console.log("\n3. Deploying MockPendleOracle...");
    const oracle = await hre.ethers.deployContract("MockPendleOracle", []);
    await oracle.waitForDeployment();
    const oracleReceipt = await oracle.deploymentTransaction().wait(2);
    console.log(`MockPendleOracle deployed to: ${oracle.target}`);
    console.log(`Gas used: ${oracleReceipt.gasUsed}`);

    // 4. Déploiement du Router
    console.log("\n4. Deploying MockPendleRouter...");
    const router = await hre.ethers.deployContract("MockPendleRouter", [
        gUSDC.target,
        ptgUSDC.target,
        oracle.target
    ]);
    await router.waitForDeployment();
    const routerReceipt = await router.deploymentTransaction().wait(2);
    console.log(`MockPendleRouter deployed to: ${router.target}`);
    console.log(`Gas used: ${routerReceipt.gasUsed}`);

    // 5. Configuration post-déploiement
    console.log("\n5. Starting post-deployment configuration...");

    try {
        // Transfert de l'ownership de PtgUSDC au Router
        console.log("Transferring PtgUSDC ownership to Router...");
        const transferTx = await ptgUSDC.transferOwnership(router.target);
        await transferTx.wait(2);
        console.log("✓ PtgUSDC ownership transferred to Router");

        // Configuration de l'Oracle avec les paramètres de test
        console.log("Configuring Oracle parameters...");
        const yield = 10; // 10% annuel
        const duration = 180 * 24 * 60 * 60; // 180 jours en secondes
        
        const setRateTx = await oracle.setRateAndPrice(ptgUSDC.target, yield);
        await setRateTx.wait(2);
        const setDurationTx = await oracle.setDuration(ptgUSDC.target, duration);
        await setDurationTx.wait(2);
        console.log(`✓ Oracle configured with ${yield}% yield and ${duration} seconds duration (${180} days)`);

        // Configuration du Router dans gUSDC
        console.log("Setting Router address in gUSDC...");
        const setRouterTx = await gUSDC.setRouterAddress(router.target);
        await setRouterTx.wait(2);
        console.log("✓ Router address set in gUSDC");

    } catch (error) {
        console.error("Error during post-deployment configuration:", error);
        throw error;
    }

    console.log("\nDeployment and configuration completed successfully on Holesky!");
    console.log("\nDeployed Addresses:");
    console.log("gUSDC:", gUSDC.target);
    console.log("PtgUSDC:", ptgUSDC.target);
    console.log("MockPendleOracle:", oracle.target);
    console.log("MockPendleRouter:", router.target);

    const deployedAddresses = {
        gUSDC: gUSDC.target,
        ptgUSDC: ptgUSDC.target,
        oracle: oracle.target,
        router: router.target
    };

    // Mise à jour du fichier de configuration avec les adresses Holesky
    updateAddresses(deployedAddresses, "holesky");
    
    // Vérification des contrats sur Etherscan
    console.log("\nVerifying contracts on Etherscan...");
    try {
        console.log("Verifying gUSDC...");
        await hre.run("verify:verify", {
            address: gUSDC.target,
            constructorArguments: [initialSupply],
        });

        console.log("Verifying PtgUSDC...");
        await hre.run("verify:verify", {
            address: ptgUSDC.target,
            constructorArguments: [],
        });

        console.log("Verifying MockPendleOracle...");
        await hre.run("verify:verify", {
            address: oracle.target,
            constructorArguments: [],
        });

        console.log("Verifying MockPendleRouter...");
        await hre.run("verify:verify", {
            address: router.target,
            constructorArguments: [gUSDC.target, ptgUSDC.target, oracle.target],
        });
        console.log("✓ All contracts verified on Etherscan");
    } catch (error) {
        console.error("Error during contract verification:", error);
        console.log("You may need to verify contracts manually");
    }

    return deployedAddresses;
}

// Gestion des erreurs améliorée
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error in deployment script:");
        console.error(error);
        process.exit(1);
    }); 