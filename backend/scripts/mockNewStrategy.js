const hre = require("hardhat");
const { ethers } = require("hardhat");
const { getAddresses } = require("../config/addresses");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Setting up new strategy...");

    // Récupérer les adresses
    const addresses = getAddresses();
    console.log("Using addresses:", addresses);

    // Connecter l'Oracle et récupérer le PtgUSDC
    const oracle = await ethers.getContractAt("MockPendleOracle", addresses.oracle);
    const ptgUSDC = addresses.ptgUSDC;

    // Paramètres de la stratégie
    const yield = 10; // 10% annuel
    const duration = 180 * 24 * 60 * 60; // 180 jours en secondes

    console.log("\nConfiguring strategy parameters...");
    console.log("Token:", ptgUSDC);
    console.log("Yield:", yield, "%");
    console.log("Duration:", duration, "seconds (", duration / (24 * 60 * 60), "days )");

    // Configuration de l'Oracle
    await oracle.setRateAndPrice(ptgUSDC, yield);
    await oracle.setDuration(ptgUSDC, duration);

    // Vérification des paramètres
    const configuredYield = await oracle.getYield(ptgUSDC);
    const configuredDuration = await oracle.getDuration(ptgUSDC);
    const configuredRate = await oracle.getPTRate(ptgUSDC);

    console.log("\nStrategy configured successfully!");
    console.log("Configured Yield:", configuredYield.toString(), "%");
    console.log("Configured Duration:", configuredDuration.toString(), "seconds");
    console.log("Configured Rate:", configuredRate.toString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 