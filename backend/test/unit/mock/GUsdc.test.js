const { assert, expect } = require("chai"); 
const hre = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("GUsdc Contract Tests", function () {

    // ::::::::::::: FIXTURES ::::::::::::: //  

    async function deployGUsdcFixture() {
        const [deployer, router, user1, user2] = await ethers.getSigners();
        
        // Déployer le contrat gUSDC avec l'initial supply
        const initialSupply = ethers.parseUnits("1000000", 6); // 1M gUSDC
        const GUsdc = await hre.ethers.getContractFactory("gUSDC");
        const gUSDC = await GUsdc.deploy(initialSupply);
        await gUSDC.waitForDeployment();

        // Configurer le router
        await gUSDC.setRouterAddress(router.address);

        return { deployer, router, user1, user2, gUSDC, initialSupply };
    }

    // ::::::::::::: DEPLOYMENT TESTS ::::::::::::: //

    describe("Deployment", function () {
        it("Should deploy with correct name and symbol", async function () {
            const { gUSDC } = await loadFixture(deployGUsdcFixture);
            expect(await gUSDC.name()).to.equal("Gains USDC");
            expect(await gUSDC.symbol()).to.equal("gUSDC");
        });

        it("Should set correct decimals", async function () {
            const { gUSDC } = await loadFixture(deployGUsdcFixture);
            expect(await gUSDC.decimals()).to.equal(6);
        });

        it("Should mint initial supply to deployer", async function () {
            const { gUSDC, deployer, initialSupply } = await loadFixture(deployGUsdcFixture);
            expect(await gUSDC.balanceOf(deployer.address)).to.equal(initialSupply);
        });
    });

    // ::::::::::::: FUNCTIONALITY TESTS ::::::::::::: //

    describe("Router Management", function () {
        it("Should allow owner to set router address", async function () {
            const { gUSDC, user1 } = await loadFixture(deployGUsdcFixture);
            await gUSDC.setRouterAddress(user1.address);
        });

        it("Should revert if non-owner tries to set router", async function () {
            const { gUSDC, user1 } = await loadFixture(deployGUsdcFixture);
            await expect(gUSDC.connect(user1).setRouterAddress(user1.address))
                .to.be.revertedWithCustomError(gUSDC, "OwnableUnauthorizedAccount");
        });

        it("Should revert if setting zero address as router", async function () {
            const { gUSDC } = await loadFixture(deployGUsdcFixture);
            await expect(gUSDC.setRouterAddress(ethers.ZeroAddress))
                .to.be.revertedWith("Invalid router address");
        });
    });

    describe("Minting", function () {
        it("Should allow router to mint new tokens", async function () {
            const { gUSDC, router, user1 } = await loadFixture(deployGUsdcFixture);
            const mintAmount = ethers.parseUnits("100", 6);
            
            await gUSDC.connect(router).mint(user1.address, mintAmount);
            expect(await gUSDC.balanceOf(user1.address)).to.equal(mintAmount);
        });

        it("Should revert if non-router tries to mint", async function () {
            const { gUSDC, user1 } = await loadFixture(deployGUsdcFixture);
            const mintAmount = ethers.parseUnits("100", 6);
            
            await expect(gUSDC.connect(user1).mint(user1.address, mintAmount))
                .to.be.revertedWith("Only Router can mint");
        });
    });

    describe("Transfers", function () {
        it("Should transfer tokens between accounts", async function () {
            const { gUSDC, deployer, user1 } = await loadFixture(deployGUsdcFixture);
            const transferAmount = ethers.parseUnits("100", 6);
            
            await gUSDC.transfer(user1.address, transferAmount);
            expect(await gUSDC.balanceOf(user1.address)).to.equal(transferAmount);
        });

        it("Should fail if sender doesn't have enough tokens", async function () {
            const { gUSDC, user1, user2 } = await loadFixture(deployGUsdcFixture);
            const transferAmount = ethers.parseUnits("100", 6);
            
            await expect(gUSDC.connect(user1).transfer(user2.address, transferAmount))
                .to.be.revertedWithCustomError(gUSDC, "ERC20InsufficientBalance");
        });
    });
});