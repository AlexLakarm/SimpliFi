const { assert, expect } = require("chai"); 
const hre = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("PtGUsdc Contract Tests", function () {
    async function deployPtGUsdcFixture() {
        const [deployer, router, user1, user2] = await ethers.getSigners();
        
        // Déployer le contrat PtgUSDC avec la syntaxe moderne
        const ptgUSDC = await hre.ethers.deployContract("PtgUSDC");
        await ptgUSDC.waitForDeployment();

        // Transférer l'ownership au router
        await ptgUSDC.transferOwnership(router.address);

        // Obtenir le timestamp actuel de la blockchain
        const currentBlock = await ethers.provider.getBlock('latest');
        const currentTimestamp = currentBlock.timestamp;

        // Calculer la date de maturité (180 jours à partir de maintenant)
        const maturityTimestamp = currentTimestamp + (180 * 24 * 60 * 60);

        return { deployer, router, user1, user2, ptgUSDC, maturityTimestamp };
    }

    describe("Deployment", function () {
        it("Should deploy with correct name and symbol", async function () {
            const { ptgUSDC } = await loadFixture(deployPtGUsdcFixture);
            expect(await ptgUSDC.name()).to.equal("Principal Token gUSDC");
            expect(await ptgUSDC.symbol()).to.equal("PT-gUSDC");
        });

        it("Should set correct decimals", async function () {
            const { ptgUSDC } = await loadFixture(deployPtGUsdcFixture);
            expect(await ptgUSDC.decimals()).to.equal(6);
        });

        it("Should transfer ownership to router", async function () {
            const { ptgUSDC, router } = await loadFixture(deployPtGUsdcFixture);
            expect(await ptgUSDC.owner()).to.equal(router.address);
        });
    });

    describe("Minting", function () {
        it("Should allow router to mint new tokens", async function () {
            const { ptgUSDC, router, user1, maturityTimestamp } = await loadFixture(deployPtGUsdcFixture);
            const mintAmount = ethers.parseUnits("100", 6);
            
            // Avancer le temps pour s'assurer que la date de maturité est dans le futur
            const currentBlock = await ethers.provider.getBlock('latest');
            await ethers.provider.send("evm_setNextBlockTimestamp", [currentBlock.timestamp + 1]);
            await ethers.provider.send("evm_mine");
            
            await ptgUSDC.connect(router).mint(user1.address, mintAmount, maturityTimestamp);
            expect(await ptgUSDC.balanceOf(user1.address)).to.equal(mintAmount);
        });

        it("Should emit Transfer event on mint", async function () {
            const { ptgUSDC, router, user1, maturityTimestamp } = await loadFixture(deployPtGUsdcFixture);
            const mintAmount = ethers.parseUnits("100", 6);
            
            // Avancer le temps pour s'assurer que la date de maturité est dans le futur
            const currentBlock = await ethers.provider.getBlock('latest');
            await ethers.provider.send("evm_setNextBlockTimestamp", [currentBlock.timestamp + 1]);
            await ethers.provider.send("evm_mine");
            
            await expect(ptgUSDC.connect(router).mint(user1.address, mintAmount, maturityTimestamp))
                .to.emit(ptgUSDC, "Transfer")
                .withArgs(ethers.ZeroAddress, user1.address, mintAmount);
        });

        it("Should revert if non-router tries to mint", async function () {
            const { ptgUSDC, user1, maturityTimestamp } = await loadFixture(deployPtGUsdcFixture);
            const mintAmount = ethers.parseUnits("100", 6);
            
            await expect(ptgUSDC.connect(user1).mint(user1.address, mintAmount, maturityTimestamp))
                .to.be.revertedWithCustomError(ptgUSDC, "OwnableUnauthorizedAccount")
                .withArgs(user1.address);
        });
    });

    describe("Burning", function () {
        it("Should allow router to burn tokens", async function () {
            const { ptgUSDC, router, user1, maturityTimestamp } = await loadFixture(deployPtGUsdcFixture);
            const amount = ethers.parseUnits("100", 6);
            
            // Avancer le temps pour s'assurer que la date de maturité est dans le futur
            const currentBlock = await ethers.provider.getBlock('latest');
            await ethers.provider.send("evm_setNextBlockTimestamp", [currentBlock.timestamp + 1]);
            await ethers.provider.send("evm_mine");
            
            await ptgUSDC.connect(router).mint(user1.address, amount, maturityTimestamp);
            await ptgUSDC.connect(router).burn(user1.address, amount);
            expect(await ptgUSDC.balanceOf(user1.address)).to.equal(0);
        });

        it("Should revert if non-router tries to burn", async function () {
            const { ptgUSDC, router, user1, maturityTimestamp } = await loadFixture(deployPtGUsdcFixture);
            const amount = ethers.parseUnits("100", 6);
            
            // Avancer le temps pour s'assurer que la date de maturité est dans le futur
            const currentBlock = await ethers.provider.getBlock('latest');
            await ethers.provider.send("evm_setNextBlockTimestamp", [currentBlock.timestamp + 1]);
            await ethers.provider.send("evm_mine");
            
            await ptgUSDC.connect(router).mint(user1.address, amount, maturityTimestamp);
            await expect(ptgUSDC.connect(user1).burn(user1.address, amount))
                .to.be.revertedWithCustomError(ptgUSDC, "OwnableUnauthorizedAccount")
                .withArgs(user1.address);
        });
    });

    describe("Transfers", function () {
        it("Should transfer tokens between accounts", async function () {
            const { ptgUSDC, router, user1, user2, maturityTimestamp } = await loadFixture(deployPtGUsdcFixture);
            const amount = ethers.parseUnits("100", 6);
            
            // Avancer le temps pour s'assurer que la date de maturité est dans le futur
            const currentBlock = await ethers.provider.getBlock('latest');
            await ethers.provider.send("evm_setNextBlockTimestamp", [currentBlock.timestamp + 1]);
            await ethers.provider.send("evm_mine");
            
            await ptgUSDC.connect(router).mint(user1.address, amount, maturityTimestamp);
            await ptgUSDC.connect(user1).transfer(user2.address, amount);
            expect(await ptgUSDC.balanceOf(user2.address)).to.equal(amount);
        });

        it("Should fail if sender doesn't have enough tokens", async function () {
            const { ptgUSDC, user1, user2 } = await loadFixture(deployPtGUsdcFixture);
            const amount = ethers.parseUnits("100", 6);
            
            await expect(ptgUSDC.connect(user1).transfer(user2.address, amount))
                .to.be.revertedWithCustomError(ptgUSDC, "ERC20InsufficientBalance");
        });
    });

    describe("Router Management", function () {
        it("Should allow router (owner) to mint", async function () {
            const { ptgUSDC, router, user1, maturityTimestamp } = await loadFixture(deployPtGUsdcFixture);
            const mintAmount = ethers.parseUnits("100", 6);
            
            // Avancer le temps pour s'assurer que la date de maturité est dans le futur
            const currentBlock = await ethers.provider.getBlock('latest');
            await ethers.provider.send("evm_setNextBlockTimestamp", [currentBlock.timestamp + 1]);
            await ethers.provider.send("evm_mine");
            
            await ptgUSDC.connect(router).mint(user1.address, mintAmount, maturityTimestamp);
            expect(await ptgUSDC.balanceOf(user1.address)).to.equal(mintAmount);
        });

        it("Should revert if non-owner tries to mint", async function () {
            const { ptgUSDC, user1, maturityTimestamp } = await loadFixture(deployPtGUsdcFixture);
            const mintAmount = ethers.parseUnits("100", 6);
            
            await expect(ptgUSDC.connect(user1).mint(user1.address, mintAmount, maturityTimestamp))
                .to.be.revertedWithCustomError(ptgUSDC, "OwnableUnauthorizedAccount");
        });
    });
});