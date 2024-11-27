const { assert, expect } = require("chai"); 
const hre = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("StrategyOne Contract Tests", function () {
    // ::::::::::::: FIXTURES ::::::::::::: //  
    async function deployMockContractsFixture() {
        const [deployer] = await ethers.getSigners();
        
        // Déployer gUSDC avec supply initiale
        const gUSDC = await hre.ethers.deployContract("gUSDC", [ethers.parseUnits("1000000", 6)]);
        await gUSDC.waitForDeployment();

        // Déployer PtgUSDC
        const ptgUSDC = await hre.ethers.deployContract("PtgUSDC");
        await ptgUSDC.waitForDeployment();

        // Déployer MockPendleOracle
        const mockPendleOracle = await hre.ethers.deployContract("MockPendleOracle");
        await mockPendleOracle.waitForDeployment();

        // Déployer MockPendleRouter avec les bonnes adresses
        const mockPendleRouter = await hre.ethers.deployContract("MockPendleRouter", [
            gUSDC.target,
            ptgUSDC.target,
            mockPendleOracle.target
        ]);
        await mockPendleRouter.waitForDeployment();

        return { deployer, gUSDC, ptgUSDC, mockPendleOracle, mockPendleRouter };
    }

    async function configureMockContractsFixture() {
        const { deployer, gUSDC, ptgUSDC, mockPendleOracle, mockPendleRouter } = await loadFixture(deployMockContractsFixture);

        // Transférer l'ownership de PtgUSDC au router
        await ptgUSDC.transferOwnership(mockPendleRouter.target);

        // Configurer le router dans gUSDC
        await gUSDC.setRouterAddress(mockPendleRouter.target);

        return { deployer, gUSDC, ptgUSDC, mockPendleOracle, mockPendleRouter };
    }

    async function setMockStrategyFixture() {
        const { deployer, gUSDC, ptgUSDC, mockPendleOracle, mockPendleRouter } = await loadFixture(configureMockContractsFixture);

        // Configurer l'oracle
        const annualYieldPoints = 10; // 10%
        const duration = 180; // 180 jours
        
        await mockPendleOracle.setRateAndPrice(ptgUSDC.target, annualYieldPoints);
        await mockPendleOracle.setDuration(ptgUSDC.target, duration);

        return { deployer, gUSDC, ptgUSDC, mockPendleOracle, mockPendleRouter, annualYieldPoints, duration };
    }

    async function deploySimpliFiContractsFixture() {
        const { deployer, gUSDC, ptgUSDC, mockPendleOracle, mockPendleRouter, annualYieldPoints, duration } = 
            await loadFixture(setMockStrategyFixture);

        // Déployer RoleControl
        const roleControl = await hre.ethers.deployContract("RoleControl");
        await roleControl.waitForDeployment();

        // Déployer StrategyNFT
        const baseURI = "Qma6ADzGBX22147CfKycsbNE6DYewyRhMHonDn3khc2xA6";
        const strategyNFT = await hre.ethers.deployContract("StrategyNFT", [baseURI]);
        await strategyNFT.waitForDeployment();

        // Déployer StrategyOne
        const strategyOne = await hre.ethers.deployContract("StrategyOne", [
            mockPendleRouter.target,
            mockPendleOracle.target,
            roleControl.target,
            strategyNFT.target
        ]);
        await strategyOne.waitForDeployment();

        // Configurer StrategyNFT avec l'adresse de StrategyOne
        await strategyNFT.setStrategyContract(strategyOne.target);

        return { 
            deployer, gUSDC, ptgUSDC, mockPendleOracle, mockPendleRouter, 
            roleControl, strategyNFT, strategyOne, 
            annualYieldPoints, duration, baseURI 
        };
    }

    async function configureRoleControlFixture() {
        const { 
            deployer, gUSDC, ptgUSDC, mockPendleOracle, mockPendleRouter, 
            roleControl, strategyNFT, strategyOne, 
            annualYieldPoints, duration, baseURI 
        } = await loadFixture(deploySimpliFiContractsFixture);

        // Créer les signers pour les différents rôles
        const [, admin1, admin2, cgp1, cgp2, client1, client2] = await ethers.getSigners();

        // Configuration des rôles
        await roleControl.connect(deployer).addAdmin(admin1.address);
        await roleControl.connect(deployer).addAdmin(admin2.address);

        await roleControl.connect(admin1).addCGP(cgp1.address);
        await roleControl.connect(admin2).addCGP(cgp2.address);

        await roleControl.connect(cgp1).addClient(client1.address);
        await roleControl.connect(cgp2).addClient(client2.address);

        return { 
            deployer, admin1, admin2, cgp1, cgp2, client1, client2,
            gUSDC, ptgUSDC, mockPendleOracle, mockPendleRouter, 
            roleControl, strategyNFT, strategyOne,
            annualYieldPoints, duration, baseURI 
        };
    }

    async function enterStrategyFixture() {
        const { 
            deployer, admin1, admin2, cgp1, cgp2, client1, client2,
            gUSDC, ptgUSDC, mockPendleOracle, mockPendleRouter, 
            roleControl, strategyNFT, strategyOne,
            annualYieldPoints, duration
        } = await loadFixture(configureRoleControlFixture);

        // Montant pour la stratégie
        const amount = ethers.parseUnits("100", 6);

        // Configurer les fee points (1% chacun)
        await strategyOne.updateFeePoints(100, 100); // 100 basis points = 1%

        // Configurer un yield plus élevé dans l'oracle pour générer des fees
        await mockPendleOracle.setRateAndPrice(ptgUSDC.target, 50); // 50% au lieu de 1000%

        // Transférer des gUSDC au client1
        await gUSDC.transfer(client1.address, amount);
        
        // Approuver StrategyOne pour les gUSDC
        await gUSDC.connect(client1).approve(strategyOne.target, amount);

        // Approuver le router pour les gUSDC
        await gUSDC.connect(client1).approve(mockPendleRouter.target, amount);

        return { 
            deployer, admin1, admin2, cgp1, cgp2, client1, client2,
            gUSDC, ptgUSDC, mockPendleOracle, mockPendleRouter, 
            roleControl, strategyNFT, strategyOne,
            annualYieldPoints, duration, amount
        };
    }

    async function exitStrategyFixture() {
        const fixture = await loadFixture(enterStrategyFixture);

        // Entrer dans la stratégie
        const tx = await fixture.strategyOne.connect(fixture.client1).enterStrategy(fixture.amount);
        const receipt = await tx.wait();

        // Récupérer la position depuis l'événement
        const event = receipt.logs.find(
            log => {
                try {
                    const parsedLog = fixture.strategyOne.interface.parseLog(log);
                    return parsedLog && parsedLog.name === 'StrategyEntered';
                } catch {
                    return false;
                }
            }
        );
        const positionId = event.args.positionId;

        return { ...fixture, positionId };
    }

    // ::::::::::::: DEPLOYMENT TESTS ::::::::::::: //
    describe("Deployment and Configuration", function () {
        it("Should deploy all contracts with correct addresses", async function () {
            const { 
                strategyOne, mockPendleRouter, mockPendleOracle, 
                roleControl, strategyNFT 
            } = await loadFixture(configureRoleControlFixture);

            expect(await strategyOne.router()).to.equal(mockPendleRouter.target);
            expect(await strategyOne.oracle()).to.equal(mockPendleOracle.target);
            expect(await strategyOne.roleControl()).to.equal(roleControl.target);
            expect(await strategyOne.nftContract()).to.equal(strategyNFT.target);
        });

        it("Should configure roles correctly", async function () {
            const { 
                roleControl, admin1, admin2, cgp1, cgp2, client1, client2 
            } = await loadFixture(configureRoleControlFixture);

            expect(await roleControl.isAdmin(admin1.address)).to.be.true;
            expect(await roleControl.isAdmin(admin2.address)).to.be.true;
            expect(await roleControl.isCGP(cgp1.address)).to.be.true;
            expect(await roleControl.isCGP(cgp2.address)).to.be.true;
            expect(await roleControl.isClient(client1.address)).to.be.true;
            expect(await roleControl.isClient(client2.address)).to.be.true;
        });

        it("Should link clients to their CGPs correctly", async function () {
            const { 
                roleControl, cgp1, cgp2, client1, client2 
            } = await loadFixture(configureRoleControlFixture);

            expect(await roleControl.getClientCGP(client1.address)).to.equal(cgp1.address);
            expect(await roleControl.getClientCGP(client2.address)).to.equal(cgp2.address);
        });

        it("Should get the correct duration", async function () {
            const { 
                mockPendleOracle, ptgUSDC, duration 
            } = await loadFixture(configureRoleControlFixture);

            const oracleDuration = await mockPendleOracle.getDuration(ptgUSDC.target);
            expect(oracleDuration).to.equal(duration);
        });

        it("Should get correct rate and yield", async function () {
            const { 
                mockPendleOracle, ptgUSDC, annualYieldPoints 
            } = await loadFixture(configureRoleControlFixture);

            // Vérifier le yield
            const yield_ = await mockPendleOracle.getYield(ptgUSDC.target);
            expect(yield_).to.equal(annualYieldPoints);

            // Vérifier le rate (qui est calculé à partir du yield)
            const rate = await mockPendleOracle.getPTRate(ptgUSDC.target);
            
            // Calcul: rate = SCALE - ((yield * SCALE) / 100)
            const SCALE = BigInt("1000000000000000000"); // 1e18
            const expectedRate = SCALE - ((BigInt(annualYieldPoints) * SCALE) / 100n);
            
            expect(rate).to.equal(expectedRate);
        });
    });

    // ::::::::::::: STRATEGY ENTRY TESTS ::::::::::::: //
    describe("Strategy Entry", function () {
        describe("Position Creation", function () {
            it("Should allow client to enter strategy", async function () {
                const { strategyOne, client1, amount } = await loadFixture(enterStrategyFixture);
                await expect(strategyOne.connect(client1).enterStrategy(amount))
                    .to.emit(strategyOne, "StrategyEntered");
            });

            it("Should revert if non-client tries to enter", async function () {
                const { strategyOne, cgp1, amount } = await loadFixture(enterStrategyFixture);
                await expect(strategyOne.connect(cgp1).enterStrategy(amount))
                    .to.be.revertedWith("Caller is not a client");
            });

            it("Should revert if amount is zero", async function () {
                const { strategyOne, client1 } = await loadFixture(enterStrategyFixture);
                await expect(strategyOne.connect(client1).enterStrategy(0))
                    .to.be.revertedWith("Amount must be greater than 0");
            });
        });

        describe("Fee Management", function () {
            it("Should calculate and store correct fees", async function () {
                const { strategyOne, client1, cgp1, amount } = await loadFixture(enterStrategyFixture);
                
                await strategyOne.connect(client1).enterStrategy(amount);
                
                const protocolFees = await strategyOne.getProtocolFees();
                const cgpFees = await strategyOne.getCGPFees(cgp1.address);
                
                expect(protocolFees[0]).to.be.gt(0); // nonMaturedFees
                expect(cgpFees[0]).to.be.gt(0); // nonMaturedFees
            });

            it("Should emit PendingFeesUpdated event", async function () {
                const { strategyOne, client1, cgp1, amount } = await loadFixture(enterStrategyFixture);
                
                // D'abord faire le swap pour avoir les fees
                const tx = await strategyOne.connect(client1).enterStrategy(amount);
                const receipt = await tx.wait();

                // Trouver l'événement PendingFeesUpdated
                const pendingFeesEvent = receipt.logs.find(
                    log => {
                        try {
                            const parsedLog = strategyOne.interface.parseLog(log);
                            return parsedLog && parsedLog.name === 'PendingFeesUpdated';
                        } catch {
                            return false;
                        }
                    }
                );

                // Vérifier que l'événement existe et a les bonnes valeurs
                const parsedEvent = strategyOne.interface.parseLog(pendingFeesEvent);
                expect(parsedEvent.args.cgp).to.equal(cgp1.address);
                expect(parsedEvent.args.cgpPendingFees).to.be.gt(0);
                expect(parsedEvent.args.protocolPendingFees).to.be.gt(0);
            });
        });

        describe("NFT Minting", function () {
            it("Should mint NFT to client", async function () {
                const { strategyOne, strategyNFT, client1, amount } = await loadFixture(enterStrategyFixture);
                
                const tx = await strategyOne.connect(client1).enterStrategy(amount);
                const receipt = await tx.wait();

                // Vérifier l'événement de mint du NFT
                const mintEvent = receipt.logs.find(
                    log => {
                        try {
                            const parsedLog = strategyNFT.interface.parseLog(log);
                            return parsedLog && parsedLog.name === 'StrategyNFTMinted';
                        } catch {
                            return false;
                        }
                    }
                );
                const parsedEvent = strategyNFT.interface.parseLog(mintEvent);
                expect(parsedEvent.args.owner).to.equal(client1.address);
            });

            it("Should set correct NFT metadata", async function () {
                const { strategyOne, strategyNFT, client1, amount } = await loadFixture(enterStrategyFixture);
                
                await strategyOne.connect(client1).enterStrategy(amount);
                
                const tokenId = 1; // Premier NFT
                const tokenURI = await strategyNFT.tokenURI(tokenId);
                const metadata = JSON.parse(Buffer.from(tokenURI.split(',')[1], 'base64').toString());
                
                expect(metadata.attributes.find(a => a.trait_type === "Initial Amount").value)
                    .to.equal(amount.toString());
            });
        });
    });

    // ::::::::::::: STRATEGY EXIT TESTS ::::::::::::: //
    describe("Strategy Exit", function () {
        describe("Position Exit", function () {
            it("Should allow client to exit strategy at maturity", async function () {
                const { strategyOne, client1, positionId, duration } = await loadFixture(exitStrategyFixture);

                // Avancer le temps jusqu'à la maturité
                await ethers.provider.send("evm_increaseTime", [duration * 24 * 60 * 60]);
                await ethers.provider.send("evm_mine");

                await expect(strategyOne.connect(client1).exitStrategy(positionId))
                    .to.emit(strategyOne, "StrategyExited");
            });

            it("Should revert if trying to exit before maturity", async function () {
                const { strategyOne, client1, positionId, mockPendleRouter } = await loadFixture(exitStrategyFixture);
                await expect(strategyOne.connect(client1).exitStrategy(positionId))
                    .to.be.revertedWith("Strategy not yet mature");
            });

            it("Should revert if non-owner tries to exit", async function () {
                const { strategyOne, client1, client2, positionId, duration } = await loadFixture(exitStrategyFixture);
                
                // Vérifier que la position existe pour client1
                const positions = await strategyOne.getUserPositions(client1.address);
                expect(positions.length).to.be.gt(0);
                expect(positions[positionId].isActive).to.be.true;

                await ethers.provider.send("evm_increaseTime", [duration * 24 * 60 * 60]);
                await ethers.provider.send("evm_mine");

                // client2 essaie d'accéder à la position de client1
                await expect(strategyOne.connect(client2).exitStrategy(positionId))
                    .to.be.revertedWith("Not position owner");
            });
        });

        describe("Fee Distribution", function () {
            it("Should update fee statuses correctly", async function () {
                const { strategyOne, client1, cgp1, positionId, duration } = await loadFixture(exitStrategyFixture);

                // Vérifier les fees avant exit
                const initialProtocolFees = await strategyOne.getProtocolFees();
                const initialCgpFees = await strategyOne.getCGPFees(cgp1.address);
                expect(initialProtocolFees[0]).to.be.gt(0); // nonMaturedFees
                expect(initialCgpFees[0]).to.be.gt(0); // nonMaturedFees

                await ethers.provider.send("evm_increaseTime", [duration * 24 * 60 * 60]);
                await ethers.provider.send("evm_mine");

                await strategyOne.connect(client1).exitStrategy(positionId);

                // Vérifier les fees après exit
                const finalProtocolFees = await strategyOne.getProtocolFees();
                const finalCgpFees = await strategyOne.getCGPFees(cgp1.address);

                expect(finalProtocolFees[1]).to.be.gt(0); // maturedNonWithdrawnFees
                expect(finalCgpFees[1]).to.be.gt(0); // maturedNonWithdrawnFees
            });

            it("Should emit FeesCollected event", async function () {
                const { strategyOne, client1, cgp1, positionId, duration } = await loadFixture(exitStrategyFixture);

                await ethers.provider.send("evm_increaseTime", [duration * 24 * 60 * 60]);
                await ethers.provider.send("evm_mine");

                await expect(strategyOne.connect(client1).exitStrategy(positionId))
                    .to.emit(strategyOne, "FeesCollected");
            });
        });

        describe("NFT Burning", function () {
            it("Should burn NFT on exit", async function () {
                const { strategyOne, strategyNFT, client1, positionId, duration } = await loadFixture(exitStrategyFixture);

                await ethers.provider.send("evm_increaseTime", [duration * 24 * 60 * 60]);
                await ethers.provider.send("evm_mine");

                await strategyOne.connect(client1).exitStrategy(positionId);

                // Vérifier que le NFT n'existe plus
                await expect(strategyNFT.ownerOf(BigInt(positionId) + 1n))
                    .to.be.revertedWithCustomError(strategyNFT, "ERC721NonexistentToken");
            });
        });
    });
});