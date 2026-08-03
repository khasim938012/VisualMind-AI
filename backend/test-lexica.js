const axios = require('axios');

async function test() {
    try {
        const query = "Eiffel Tower";
        const url = `https://lexica.art/api/v1/search?q=${encodeURIComponent(query)}`;
        const response = await axios.get(url);
        
        console.log("Found images:", response.data.images.length);
        if (response.data.images.length > 0) {
            console.log("First image:", response.data.images[0].src);
        }
    } catch(e) {
        console.error(e);
    }
}
test();
