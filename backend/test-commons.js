const axios = require('axios');

async function test() {
    try {
        const query = "apple";
        const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=3&prop=imageinfo&iiprop=url&format=json`;
        
        const response = await axios.get(searchUrl, {
            headers: { 'User-Agent': 'VisualMindAI/1.0 (contact@example.com)' }
        });
        
        const pages = response.data.query?.pages;
        if (pages) {
            console.log("Found images!");
            Object.values(pages).forEach(p => {
                console.log(p.imageinfo[0].url);
            });
        } else {
            console.log("No images found.");
        }
    } catch(e) {
        console.error(e);
    }
}
test();
