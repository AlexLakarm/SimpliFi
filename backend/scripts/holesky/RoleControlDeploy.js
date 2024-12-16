const hre = require("hardhat");
const { updateAddresses } = require("../../config/addresses");

async function main() {
    // Récupérer le déployeur
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);
    console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());
    console.log("Network:", network.name);

    console.log("Starting RoleControl deployment on Holesky...");

    // Déploiement du contrat RoleControl
    console.log("\nDeploying RoleControl...");
    const roleControl = await hre.ethers.deployContract("RoleControl");
    await roleControl.waitForDeployment();
    const roleControlReceipt = await roleControl.deploymentTransaction().wait(2);
    
    console.log(`RoleControl deployed to: ${roleControl.target}`);
    console.log(`Gas used: ${roleControlReceipt.gasUsed}`);

    // Configuration des rôles
    console.log("\nConfiguring roles...");

    try {
        // Ajout de l'admin
        console.log("Adding admin...");
        const adminTx = await roleControl.addAdmin("0x4D1B8A7A48F347A6B8a3747e4990e6D1AE3dfAD6");
        await adminTx.wait(2);
        console.log("✓ Admin added successfully");

        // Ajout des CGPs
        console.log("Adding CGPs...");
        const cgpTx1 = await roleControl.addCGP("0x100C484CDf7a1CaDF7DeBCfBC5461EEcF6F79220");
        await cgpTx1.wait(2);
        console.log("✓ First CGP added successfully");

        const cgpTx2 = await roleControl.addCGP("0x578Ff9B339B765d1Dc27957b38397301C0BfC16c");
        await cgpTx2.wait(2);
        console.log("✓ Second CGP added successfully");

    } catch (error) {
        console.error("Error during role configuration:", error);
        throw error;
    }

    console.log("\nDeployment and configuration completed successfully!");
    console.log("\nDeployed Address on Holesky:");
    console.log("RoleControl:", roleControl.target);

    const deployedAddresses = {
        roleControl: roleControl.target
    };

    // Mise à jour du fichier de configuration avec les adresses Holesky
    updateAddresses(deployedAddresses, "holesky");
    
    // Vérification du contrat sur Etherscan
    console.log("\nVerifying contract on Etherscan...");
    try {
        await hre.run("verify:verify", {
            address: roleControl.target,
            constructorArguments: []
        });
        console.log("✓ Contract verified on Etherscan");
    } catch (error) {
        console.error("Error during contract verification:", error);
        console.log("You may need to verify the contract manually");
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