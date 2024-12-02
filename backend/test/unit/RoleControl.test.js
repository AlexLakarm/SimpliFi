const { assert, expect } = require("chai"); 
const hre = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("RoleControl Contract Tests", function () {
    // ::::::::::::: FIXTURES ::::::::::::: //  
    async function deployRoleControlFixture() {
        const [deployer, admin, cgp, client, randomUser] = await ethers.getSigners();
        const RoleControl = await hre.ethers.deployContract("RoleControl");
        const roleControl = await RoleControl.waitForDeployment();
        return { deployer, admin, cgp, client, randomUser, roleControl };
    }

    // ::::::::::::: DEPLOYMENT TESTS ::::::::::::: //
    describe("Deployment", function () {
        it("Should set deployer as DEFAULT_ADMIN_ROLE and ADMIN_ROLE", async function () {
            const { deployer, roleControl } = await loadFixture(deployRoleControlFixture);
            const DEFAULT_ADMIN_ROLE = await roleControl.DEFAULT_ADMIN_ROLE();
            const ADMIN_ROLE = await roleControl.ADMIN_ROLE();
            
            expect(await roleControl.hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.true;
            expect(await roleControl.hasRole(ADMIN_ROLE, deployer.address)).to.be.true;
        });
    });

    // ::::::::::::: ROLE MANAGEMENT TESTS ::::::::::::: //
    describe("Role Management", function () {
        describe("Admin Management", function () {
            it("Should allow DEFAULT_ADMIN to add new admin", async function () {
                const { deployer, admin, roleControl } = await loadFixture(deployRoleControlFixture);
                await roleControl.connect(deployer).addAdmin(admin.address);
                expect(await roleControl.isAdmin(admin.address)).to.be.true;
            });

            it("Should emit AdminAdded event", async function () {
                const { deployer, admin, roleControl } = await loadFixture(deployRoleControlFixture);
                await expect(roleControl.connect(deployer).addAdmin(admin.address))
                    .to.emit(roleControl, "AdminAdded")
                    .withArgs(admin.address, deployer.address);
            });

            it("Should revert if non-DEFAULT_ADMIN tries to add admin", async function () {
                const { randomUser, admin, roleControl } = await loadFixture(deployRoleControlFixture);
                const DEFAULT_ADMIN_ROLE = await roleControl.DEFAULT_ADMIN_ROLE();
                await expect(roleControl.connect(randomUser).addAdmin(admin.address))
                    .to.be.revertedWithCustomError(roleControl, "AccessControlUnauthorizedAccount")
                    .withArgs(randomUser.address, DEFAULT_ADMIN_ROLE);
            });
        });

        describe("CGP Management", function () {
            it("Should allow admin to add new CGP", async function () {
                const { deployer, admin, cgp, roleControl } = await loadFixture(deployRoleControlFixture);
                await roleControl.connect(deployer).addAdmin(admin.address);
                await roleControl.connect(admin).addCGP(cgp.address);
                expect(await roleControl.isCGP(cgp.address)).to.be.true;
            });

            it("Should emit CGPAdded event", async function () {
                const { deployer, admin, cgp, roleControl } = await loadFixture(deployRoleControlFixture);
                await roleControl.connect(deployer).addAdmin(admin.address);
                await expect(roleControl.connect(admin).addCGP(cgp.address))
                    .to.emit(roleControl, "CGPAdded")
                    .withArgs(cgp.address, admin.address);
            });

            it("Should revert if non-admin tries to add CGP", async function () {
                const { randomUser, cgp, roleControl } = await loadFixture(deployRoleControlFixture);
                const ADMIN_ROLE = await roleControl.ADMIN_ROLE();
                await expect(roleControl.connect(randomUser).addCGP(cgp.address))
                    .to.be.revertedWithCustomError(roleControl, "AccessControlUnauthorizedAccount")
                    .withArgs(randomUser.address, ADMIN_ROLE);
            });
        });

        describe("Client Management", function () {
            it("Should allow CGP to add new client", async function () {
                const { deployer, admin, cgp, client, roleControl } = await loadFixture(deployRoleControlFixture);
                await roleControl.connect(deployer).addAdmin(admin.address);
                await roleControl.connect(admin).addCGP(cgp.address);
                await roleControl.connect(cgp).addClient(client.address);
                expect(await roleControl.isClient(client.address)).to.be.true;
            });

            it("Should emit ClientAdded event", async function () {
                const { deployer, admin, cgp, client, roleControl } = await loadFixture(deployRoleControlFixture);
                await roleControl.connect(deployer).addAdmin(admin.address);
                await roleControl.connect(admin).addCGP(cgp.address);
                await expect(roleControl.connect(cgp).addClient(client.address))
                    .to.emit(roleControl, "ClientAdded")
                    .withArgs(client.address, cgp.address);
            });

            it("Should revert if non-CGP tries to add client", async function () {
                const { randomUser, client, roleControl } = await loadFixture(deployRoleControlFixture);
                const CGP_ROLE = await roleControl.CGP_ROLE();
                await expect(roleControl.connect(randomUser).addClient(client.address))
                    .to.be.revertedWithCustomError(roleControl, "AccessControlUnauthorizedAccount")
                    .withArgs(randomUser.address, CGP_ROLE);
            });

            it("Should revert if client already has a CGP", async function () {
                const { deployer, admin, cgp, client, roleControl } = await loadFixture(deployRoleControlFixture);
                await roleControl.connect(deployer).addAdmin(admin.address);
                await roleControl.connect(admin).addCGP(cgp.address);
                await roleControl.connect(cgp).addClient(client.address);
                await expect(roleControl.connect(cgp).addClient(client.address))
                    .to.be.revertedWith("Client already has a CGP");
            });

            it("Should revert if CGP tries to be their own client", async function () {
                const { deployer, admin, cgp, roleControl } = await loadFixture(deployRoleControlFixture);
                await roleControl.connect(deployer).addAdmin(admin.address);
                await roleControl.connect(admin).addCGP(cgp.address);
                await expect(roleControl.connect(cgp).addClient(cgp.address))
                    .to.be.revertedWith("CGP cannot be their own client");
            });

            it("Should revert if trying to make a CGP a client", async function () {
                const { deployer, admin, cgp, roleControl } = await loadFixture(deployRoleControlFixture);
                const otherCGP = cgp; // Using same address for simplicity
                await roleControl.connect(deployer).addAdmin(admin.address);
                await roleControl.connect(admin).addCGP(cgp.address);
                await expect(roleControl.connect(cgp).addClient(otherCGP.address))
                    .to.be.revertedWith("CGP cannot be their own client");
            });
        });

        describe("Delete Functions", function () {
            it("Should allow DEFAULT_ADMIN to delete admin", async function () {
                const { deployer, admin, roleControl } = await loadFixture(deployRoleControlFixture);
                await roleControl.connect(deployer).addAdmin(admin.address);
                await roleControl.connect(deployer).deleteAdmin(admin.address);
                expect(await roleControl.isAdmin(admin.address)).to.be.false;
            });

            it("Should emit AdminRemoved event", async function () {
                const { deployer, admin, roleControl } = await loadFixture(deployRoleControlFixture);
                await roleControl.connect(deployer).addAdmin(admin.address);
                await expect(roleControl.connect(deployer).deleteAdmin(admin.address))
                    .to.emit(roleControl, "AdminRemoved")
                    .withArgs(admin.address, deployer.address);
            });

            it("Should not allow admin to delete themselves", async function () {
                const { deployer, roleControl } = await loadFixture(deployRoleControlFixture);
                await expect(roleControl.connect(deployer).deleteAdmin(deployer.address))
                    .to.be.revertedWith("Cannot remove self");
            });

            it("Should allow admin to delete CGP with no clients", async function () {
                const { deployer, admin, cgp, roleControl } = await loadFixture(deployRoleControlFixture);
                await roleControl.connect(deployer).addAdmin(admin.address);
                await roleControl.connect(admin).addCGP(cgp.address);
                await roleControl.connect(admin).deleteCGP(cgp.address);
                expect(await roleControl.isCGP(cgp.address)).to.be.false;
            });

            it("Should emit CGPRemoved event", async function () {
                const { deployer, admin, cgp, roleControl } = await loadFixture(deployRoleControlFixture);
                await roleControl.connect(deployer).addAdmin(admin.address);
                await roleControl.connect(admin).addCGP(cgp.address);
                await expect(roleControl.connect(admin).deleteCGP(cgp.address))
                    .to.emit(roleControl, "CGPRemoved")
                    .withArgs(cgp.address, admin.address);
            });

            it("Should not allow deleting CGP with active clients", async function () {
                const { deployer, admin, cgp, client, roleControl } = await loadFixture(deployRoleControlFixture);
                await roleControl.connect(deployer).addAdmin(admin.address);
                await roleControl.connect(admin).addCGP(cgp.address);
                await roleControl.connect(cgp).addClient(client.address);
                await expect(roleControl.connect(admin).deleteCGP(cgp.address))
                    .to.be.revertedWith("CGP still has clients");
            });

            it("Should allow CGP to delete their client", async function () {
                const { deployer, admin, cgp, client, roleControl } = await loadFixture(deployRoleControlFixture);
                await roleControl.connect(deployer).addAdmin(admin.address);
                await roleControl.connect(admin).addCGP(cgp.address);
                await roleControl.connect(cgp).addClient(client.address);
                await roleControl.connect(cgp).deleteClient(client.address);
                expect(await roleControl.isClient(client.address)).to.be.false;
            });

            it("Should not allow CGP to delete another CGP's client", async function () {
                const { deployer, admin, cgp, client, roleControl } = await loadFixture(deployRoleControlFixture);
                const otherCGP = admin; // Using admin as another CGP for simplicity
                await roleControl.connect(deployer).addAdmin(admin.address);
                await roleControl.connect(admin).addCGP(cgp.address);
                await roleControl.connect(admin).addCGP(otherCGP.address);
                await roleControl.connect(cgp).addClient(client.address);
                await expect(roleControl.connect(otherCGP).deleteClient(client.address))
                    .to.be.revertedWith("Not client's CGP");
            });
        });

        describe("New Getters", function () {
            it("Should return all admins correctly", async function () {
                const { deployer, admin, randomUser, roleControl } = await loadFixture(deployRoleControlFixture);
                await roleControl.connect(deployer).addAdmin(admin.address);
                await roleControl.connect(deployer).addAdmin(randomUser.address);
                
                const admins = await roleControl.getAllAdmins();
                expect(admins).to.have.lengthOf(3); // deployer + 2 new admins
                expect(admins).to.include(deployer.address);
                expect(admins).to.include(admin.address);
                expect(admins).to.include(randomUser.address);
            });

            it("Should return all CGPs correctly", async function () {
                const { deployer, admin, cgp, randomUser, roleControl } = await loadFixture(deployRoleControlFixture);
                await roleControl.connect(deployer).addAdmin(admin.address);
                await roleControl.connect(admin).addCGP(cgp.address);
                await roleControl.connect(admin).addCGP(randomUser.address);
                
                const cgps = await roleControl.getAllCGPs();
                expect(cgps).to.have.lengthOf(2);
                expect(cgps).to.include(cgp.address);
                expect(cgps).to.include(randomUser.address);
            });

            it("Should return all clients with their CGPs", async function () {
                const { deployer, admin, cgp, client, randomUser, roleControl } = await loadFixture(deployRoleControlFixture);
                await roleControl.connect(deployer).addAdmin(admin.address);
                await roleControl.connect(admin).addCGP(cgp.address);
                await roleControl.connect(cgp).addClient(client.address);
                await roleControl.connect(cgp).addClient(randomUser.address);
                
                const allClients = await roleControl.getAllClients();
                expect(allClients).to.have.lengthOf(2);
                
                const clientInfo = allClients.find(c => c.clientAddress === client.address);
                expect(clientInfo.cgpAddress).to.equal(cgp.address);
                expect(clientInfo.isActive).to.be.true;
            });

            it("Should handle deleted clients correctly in getAllClients", async function () {
                const { deployer, admin, cgp, client, roleControl } = await loadFixture(deployRoleControlFixture);
                await roleControl.connect(deployer).addAdmin(admin.address);
                await roleControl.connect(admin).addCGP(cgp.address);
                await roleControl.connect(cgp).addClient(client.address);
                await roleControl.connect(cgp).deleteClient(client.address);
                
                const allClients = await roleControl.getAllClients();
                const clientInfo = allClients.find(c => c.clientAddress === client.address);
                expect(clientInfo.isActive).to.be.false;
            });
        });
    });

    // ::::::::::::: GETTERS TESTS ::::::::::::: //
    describe("Getters", function () {
        it("Should correctly return CGP's clients", async function () {
            const { deployer, admin, cgp, client, roleControl } = await loadFixture(deployRoleControlFixture);
            await roleControl.connect(deployer).addAdmin(admin.address);
            await roleControl.connect(admin).addCGP(cgp.address);
            await roleControl.connect(cgp).addClient(client.address);
            
            const clients = await roleControl.getCGPClients(cgp.address);
            expect(clients).to.have.lengthOf(1);
            expect(clients[0]).to.equal(client.address);
        });

        it("Should correctly return client's CGP", async function () {
            const { deployer, admin, cgp, client, roleControl } = await loadFixture(deployRoleControlFixture);
            await roleControl.connect(deployer).addAdmin(admin.address);
            await roleControl.connect(admin).addCGP(cgp.address);
            await roleControl.connect(cgp).addClient(client.address);
            
            expect(await roleControl.getClientCGP(client.address)).to.equal(cgp.address);
        });

        it("Should return correct roles for addresses", async function () {
            const { deployer, admin, cgp, client, roleControl } = await loadFixture(deployRoleControlFixture);
            await roleControl.connect(deployer).addAdmin(admin.address);
            await roleControl.connect(admin).addCGP(cgp.address);
            await roleControl.connect(cgp).addClient(client.address);
            
            expect(await roleControl.getRoles(admin.address)).to.equal("ADMIN");
            expect(await roleControl.getRoles(cgp.address)).to.equal("CGP");
            expect(await roleControl.getRoles(client.address)).to.equal("CLIENT");
        });

        it("Should return all roles for an address", async function () {
            const { deployer, admin, cgp, client, roleControl } = await loadFixture(deployRoleControlFixture);
            await roleControl.connect(deployer).addAdmin(admin.address);
            await roleControl.connect(admin).addCGP(cgp.address);
            await roleControl.connect(cgp).addClient(client.address);
            
            const adminRoles = await roleControl.getAllRoles(admin.address);
            expect(adminRoles[0]).to.be.true; // ADMIN_ROLE
            expect(adminRoles[1]).to.be.false; // CGP_ROLE
            expect(adminRoles[2]).to.be.false; // CLIENT_ROLE
        });

        it("Should return correct CGP stats", async function () {
            const { deployer, admin, cgp, client, roleControl } = await loadFixture(deployRoleControlFixture);
            await roleControl.connect(deployer).addAdmin(admin.address);
            await roleControl.connect(admin).addCGP(cgp.address);
            await roleControl.connect(cgp).addClient(client.address);
            
            const stats = await roleControl.getCGPStats(cgp.address);
            expect(stats.clientCount).to.equal(1);
            expect(stats.clients).to.have.lengthOf(1);
            expect(stats.clients[0]).to.equal(client.address);
            expect(stats.activeClientsCount).to.equal(1);
        });

        it("Should return correct client info", async function () {
            const { deployer, admin, cgp, client, roleControl } = await loadFixture(deployRoleControlFixture);
            await roleControl.connect(deployer).addAdmin(admin.address);
            await roleControl.connect(admin).addCGP(cgp.address);
            await roleControl.connect(cgp).addClient(client.address);
            
            const info = await roleControl.getClientInfo(client.address);
            expect(info.isActive).to.be.true;
            expect(info.assignedCGP).to.equal(cgp.address);
            expect(info.assignmentDate).to.be.gt(0);
        });
    });

    describe("Edge Cases and Error Handling", function () {
        it("Should revert when trying to add zero address as admin", async function () {
            const { deployer, roleControl } = await loadFixture(deployRoleControlFixture);
            await expect(roleControl.connect(deployer).addAdmin(ethers.ZeroAddress))
                .to.be.revertedWith("Account is zero address");
        });

        it("Should revert when trying to add zero address as CGP", async function () {
            const { deployer, admin, roleControl } = await loadFixture(deployRoleControlFixture);
            await roleControl.connect(deployer).addAdmin(admin.address);
            await expect(roleControl.connect(admin).addCGP(ethers.ZeroAddress))
                .to.be.revertedWith("Account is zero address");
        });

        it("Should revert when trying to add zero address as client", async function () {
            const { deployer, admin, cgp, roleControl } = await loadFixture(deployRoleControlFixture);
            await roleControl.connect(deployer).addAdmin(admin.address);
            await roleControl.connect(admin).addCGP(cgp.address);
            await expect(roleControl.connect(cgp).addClient(ethers.ZeroAddress))
                .to.be.revertedWith("Account is zero address");
        });

        it("Should return NO_ROLE for address with no role", async function () {
            const { randomUser, roleControl } = await loadFixture(deployRoleControlFixture);
            expect(await roleControl.getRoles(randomUser.address)).to.equal("NO_ROLE");
        });

        it("Should handle multiple role checks correctly", async function () {
            const { deployer, admin, cgp, client, roleControl } = await loadFixture(deployRoleControlFixture);
            
            // Donner plusieurs rôles au même compte
            await roleControl.connect(deployer).addAdmin(admin.address);
            await roleControl.connect(admin).addCGP(admin.address); // Admin devient aussi CGP
            
            const roles = await roleControl.getAllRoles(admin.address);
            expect(roles[0]).to.be.true;  // ADMIN_ROLE
            expect(roles[1]).to.be.true;  // CGP_ROLE
            expect(roles[2]).to.be.false; // CLIENT_ROLE
        });

        it("Should return empty array for CGP with no clients", async function () {
            const { deployer, admin, cgp, roleControl } = await loadFixture(deployRoleControlFixture);
            await roleControl.connect(deployer).addAdmin(admin.address);
            await roleControl.connect(admin).addCGP(cgp.address);
            
            const clients = await roleControl.getCGPClients(cgp.address);
            expect(clients).to.be.an('array').that.is.empty;
        });

        it("Should revert when non-CGP tries to get clients", async function () {
            const { randomUser, roleControl } = await loadFixture(deployRoleControlFixture);
            await expect(roleControl.getCGPClients(randomUser.address))
                .to.be.revertedWith("Not a CGP");
        });

        it("Should revert when getting CGP of non-client", async function () {
            const { randomUser, roleControl } = await loadFixture(deployRoleControlFixture);
            await expect(roleControl.getClientCGP(randomUser.address))
                .to.be.revertedWith("Not a client");
        });

        it("Should return correct CGP stats with multiple clients", async function () {
            const { deployer, admin, cgp, client, randomUser, roleControl } = await loadFixture(deployRoleControlFixture);
            await roleControl.connect(deployer).addAdmin(admin.address);
            await roleControl.connect(admin).addCGP(cgp.address);
            await roleControl.connect(cgp).addClient(client.address);
            await roleControl.connect(cgp).addClient(randomUser.address);
            
            const stats = await roleControl.getCGPStats(cgp.address);
            expect(stats.clientCount).to.equal(2);
            expect(stats.clients).to.have.lengthOf(2);
            expect(stats.activeClientsCount).to.equal(2);
        });

        it("Should revert when getting stats of non-CGP", async function () {
            const { randomUser, roleControl } = await loadFixture(deployRoleControlFixture);
            await expect(roleControl.getCGPStats(randomUser.address))
                .to.be.revertedWith("Not a CGP");
        });
    });
});