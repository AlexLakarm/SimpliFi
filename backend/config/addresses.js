const fs = require('fs');
const path = require('path');

const ADDRESS_FILE = path.join(__dirname, 'deployedAddresses.json');

function updateAddresses(newAddresses) {
    fs.writeFileSync(ADDRESS_FILE, JSON.stringify(newAddresses, null, 2));
}

function getAddresses() {
    if (!fs.existsSync(ADDRESS_FILE)) {
        return {
            gUSDC: "",
            ptgUSDC: "",
            oracle: "",
            router: ""
        };
    }
    return JSON.parse(fs.readFileSync(ADDRESS_FILE, 'utf8'));
}

module.exports = {
    updateAddresses,
    getAddresses
}; 