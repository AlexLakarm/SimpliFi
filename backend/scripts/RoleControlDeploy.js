const hre = require("hardhat");
const { getAddresses, updateAddresses } = require("../config/addresses");

async function main() {
    const [deployer, admin, cgp, client] = await ethers.getSigners();
    console.log("Starting RoleControl deployment...");
    console.log("Using accounts:");
    console.log("Admin:", admin.address);
    console.log("CGP:", cgp.address);
    console.log("Client:", client.address);

    // Déployer RoleControl
    console.log("\nDeploying RoleControl...");
    const roleControl = await hre.ethers.deployContract("RoleControl");
    await roleControl.waitForDeployment();
    console.log(`RoleControl deployed to: ${roleControl.target}`);

    // Configuration des rôles
    console.log("\nSetting up roles...");
    await roleControl.connect(deployer).addAdmin(admin.address);
    console.log("✓ Admin role granted to:", admin.address);
    
    await roleControl.connect(admin).addCGP(cgp.address);
    console.log("✓ CGP role granted to:", cgp.address);
    
    await roleControl.connect(cgp).addClient(client.address);
    console.log("✓ Client role granted to:", client.address);

    // Ajouter le nouveau client
    const newClientAddress = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc";
    await roleControl.connect(cgp).addClient(newClientAddress);
    console.log("✓ Client role granted to:", newClientAddress);

    // Vérifier les rôles
    console.log("\nVerifying roles...");
    const isAdmin = await roleControl.isAdmin(admin.address);
    const isCGP = await roleControl.isCGP(cgp.address);
    const isClient = await roleControl.isClient(client.address);
    const isNewClient = await roleControl.isClient(newClientAddress);
    console.log("Admin role verified:", isAdmin);
    console.log("CGP role verified:", isCGP);
    console.log("Client role verified:", isClient);
    console.log("New client role verified:", isNewClient);

    // Sauvegarder l'adresse
    const addresses = getAddresses();
    const updatedAddresses = {
        ...addresses,
        roleControl: roleControl.target
    };
    updateAddresses(updatedAddresses);

    console.log("\nDeployment completed!");
    console.log("Updated addresses:", updatedAddresses);

    return updatedAddresses;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 