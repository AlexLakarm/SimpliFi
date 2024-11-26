const hre = require("hardhat");
const { updateAddresses } = require("../config/addresses");

async function main() {
    console.log("Starting deployment...");

    // 1. Déploiement de gUSDC
    console.log("\n1. Deploying gUSDC...");
    const initialSupply = ethers.parseUnits("1000000", 6); // 1M gUSDC avec 6 décimales
    const gUSDC = await hre.ethers.deployContract("gUSDC", [initialSupply]);
    await gUSDC.waitForDeployment();
    console.log(`gUSDC deployed to: ${gUSDC.target}`);

    // 2. Déploiement de PtgUSDC
    console.log("\n2. Deploying PtgUSDC...");
    const ptgUSDC = await hre.ethers.deployContract("PtgUSDC", []);
    await ptgUSDC.waitForDeployment();
    console.log(`PtgUSDC deployed to: ${ptgUSDC.target}`);

    // 3. Déploiement de l'Oracle
    console.log("\n3. Deploying MockPendleOracle...");
    const oracle = await hre.ethers.deployContract("MockPendleOracle", []);
    await oracle.waitForDeployment();
    console.log(`MockPendleOracle deployed to: ${oracle.target}`);

    // 4. Déploiement du Router
    console.log("\n4. Deploying MockPendleRouter...");
    const router = await hre.ethers.deployContract("MockPendleRouter", [
        gUSDC.target,
        ptgUSDC.target,
        oracle.target
    ]);
    await router.waitForDeployment();
    console.log(`MockPendleRouter deployed to: ${router.target}`);

    // 5. Configuration post-déploiement
    console.log("\n5. Starting post-deployment configuration...");

    // Transfert de l'ownership de PtgUSDC au Router
    await ptgUSDC.transferOwnership(router.target);
    console.log("✓ PtgUSDC ownership transferred to Router");

    // Configuration de l'Oracle avec les paramètres de test
    const yield = 10; // 10% annuel
    const duration = 180 * 24 * 60 * 60; // 180 jours en secondes
    
    await oracle.setRateAndPrice(ptgUSDC.target, yield);
    await oracle.setDuration(ptgUSDC.target, duration);
    console.log(`✓ Oracle configured with ${yield}% yield and ${duration} seconds duration (${180} days)`);

    // Configuration du Router dans gUSDC
    await gUSDC.setRouterAddress(router.target);
    console.log("✓ Router address set in gUSDC");

    console.log("\nDeployment and configuration completed successfully!");
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

    // Mise à jour du fichier de configuration
    updateAddresses(deployedAddresses);
    
    return deployedAddresses;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });